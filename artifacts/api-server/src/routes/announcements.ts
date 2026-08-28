import { Router, type IRouter } from "express";
import { db, announcementsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

async function formatAnnouncement(
  a: typeof announcementsTable.$inferSelect,
  preFetchedCreatorName?: string | null
) {
  let creatorName = preFetchedCreatorName;
  if (creatorName === undefined) {
    const [creator] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, a.createdById));
    creatorName = creator?.name ?? null;
  }

  return {
    id: a.id,
    title: a.title,
    content: a.content,
    targetRole: a.targetRole,
    branchId: a.branchId,
    createdById: a.createdById,
    createdByName: creatorName ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/announcements", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      announcement: announcementsTable,
      creatorName: usersTable.name,
    })
    .from(announcementsTable)
    .leftJoin(usersTable, eq(announcementsTable.createdById, usersTable.id))
    .orderBy(announcementsTable.createdAt);

  const result = await Promise.all(
    rows.map((r) => formatAnnouncement(r.announcement, r.creatorName))
  );
  res.json(result.reverse());
});

router.post("/announcements", async (req, res): Promise<void> => {
  const { title, content, targetRole, branchId } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: "Title and content required" });
    return;
  }

  const [announcement] = await db
    .insert(announcementsTable)
    .values({
      title,
      content,
      targetRole: targetRole ?? null,
      branchId: branchId ?? null,
      createdById: 1, // Default to super admin
    })
    .returning();

  res.status(201).json(await formatAnnouncement(announcement));
});

router.get("/announcements/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [announcement] = await db.select().from(announcementsTable).where(eq(announcementsTable.id, id));
  if (!announcement) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }
  res.json(await formatAnnouncement(announcement));
});

router.patch("/announcements/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const updates: Record<string, unknown> = {};
  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.content !== undefined) updates.content = req.body.content;
  if (req.body.targetRole !== undefined) updates.targetRole = req.body.targetRole;
  if (req.body.branchId !== undefined) updates.branchId = req.body.branchId;

  const [announcement] = await db
    .update(announcementsTable)
    .set(updates)
    .where(eq(announcementsTable.id, id))
    .returning();

  if (!announcement) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }
  res.json(await formatAnnouncement(announcement));
});

router.delete("/announcements/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  res.sendStatus(204);
});

export default router;
