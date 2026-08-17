import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

function formatNotification(n: typeof notificationsTable.$inferSelect) {
  return {
    id: n.id,
    type: n.type,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

router.get("/notifications", async (req, res): Promise<void> => {
  // Generate month-end notification if day >= 28
  const today = new Date();
  const day = today.getDate();
  if (day >= 28) {
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM
    const msg = `Month-End Export Reminder for ${currentMonth}: Please export the monthly reports.`;
    
    // Check if notification exists
    const [existing] = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, 1), eq(notificationsTable.message, msg)));
      
    if (!existing) {
      await db.insert(notificationsTable).values({
        userId: 1,
        type: "month_end_export",
        message: msg,
        isRead: false,
      });
    }
  }

  // Return notifications for user id 1 (simplified - in prod use auth middleware)
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, 1))
    .orderBy(notificationsTable.createdAt);

  res.json(notifications.map(formatNotification).reverse());
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, id))
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(formatNotification(notification));
});

router.patch("/notifications/read-all", async (req, res): Promise<void> => {
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, 1));
  res.json({ ok: true });
});

export default router;
