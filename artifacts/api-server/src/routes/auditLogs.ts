import { Router, type IRouter } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

export async function createAuditLog(data: {
  userId?: number | null;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: number | null;
  changes?: string | null;
}) {
  await db.insert(auditLogsTable).values(data);
}

router.get("/audit-logs", async (req, res): Promise<void> => {
  const { action, userId } = req.query;

  const conditions = [];
  if (action) conditions.push(eq(auditLogsTable.action, String(action)));
  if (userId) conditions.push(eq(auditLogsTable.userId, Number(userId)));

  let query = db.select().from(auditLogsTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  const logs = await query.orderBy(auditLogsTable.createdAt);

  res.json(logs.map(l => ({
    id: l.id,
    userId: l.userId,
    userName: l.userName,
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    changes: l.changes,
    createdAt: l.createdAt.toISOString(),
  })).reverse());
});

export default router;
