import { Router, type IRouter } from "express";
import { db, shiftsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function formatShift(s: typeof shiftsTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    gracePeriodMinutes: s.gracePeriodMinutes,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/shifts", async (req, res): Promise<void> => {
  const shifts = await db.select().from(shiftsTable).orderBy(shiftsTable.name);
  res.json(shifts.map(formatShift));
});

router.post("/shifts", async (req, res): Promise<void> => {
  const { name, startTime, endTime, gracePeriodMinutes } = req.body;
  if (!name || !startTime || !endTime) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [shift] = await db
    .insert(shiftsTable)
    .values({ name, startTime, endTime, gracePeriodMinutes: gracePeriodMinutes ?? 15 })
    .returning();

  res.status(201).json(formatShift(shift));
});

router.get("/shifts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id));
  if (!shift) {
    res.status(404).json({ error: "Shift not found" });
    return;
  }
  res.json(formatShift(shift));
});

router.patch("/shifts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.startTime !== undefined) updates.startTime = req.body.startTime;
  if (req.body.endTime !== undefined) updates.endTime = req.body.endTime;
  if (req.body.gracePeriodMinutes !== undefined) updates.gracePeriodMinutes = req.body.gracePeriodMinutes;

  const [shift] = await db
    .update(shiftsTable)
    .set(updates)
    .where(eq(shiftsTable.id, id))
    .returning();

  if (!shift) {
    res.status(404).json({ error: "Shift not found" });
    return;
  }
  res.json(formatShift(shift));
});

router.delete("/shifts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(shiftsTable).where(eq(shiftsTable.id, id));
  res.sendStatus(204);
});

export default router;
