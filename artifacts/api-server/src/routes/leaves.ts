import { Router, type IRouter } from "express";
import { db, leavesTable, employeesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

async function formatLeave(l: typeof leavesTable.$inferSelect) {
  const [emp] = await db
    .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName, employeeId: employeesTable.employeeId })
    .from(employeesTable)
    .where(eq(employeesTable.id, l.employeeId));

  return {
    id: l.id,
    employeeId: l.employeeId,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
    employeeCode: emp?.employeeId ?? null,
    leaveType: l.leaveType,
    startDate: l.startDate,
    endDate: l.endDate,
    days: l.days,
    status: l.status,
    reason: l.reason,
    managerComment: l.managerComment,
    approvedById: l.approvedById,
    createdAt: l.createdAt.toISOString(),
  };
}

router.get("/leaves", async (req, res): Promise<void> => {
  const { employeeId, status } = req.query;

  const conditions = [];
  if (employeeId) conditions.push(eq(leavesTable.employeeId, Number(employeeId)));
  if (status) conditions.push(eq(leavesTable.status, String(status)));

  let query = db.select().from(leavesTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  const leaves = await query.orderBy(leavesTable.createdAt);

  const result = await Promise.all(leaves.map(formatLeave));
  res.json(result);
});

router.post("/leaves", async (req, res): Promise<void> => {
  const { employeeId, leaveType, startDate, endDate, reason } = req.body;
  if (!employeeId || !leaveType || !startDate || !endDate || !reason) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Calculate days
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const [leave] = await db
    .insert(leavesTable)
    .values({
      employeeId: Number(employeeId),
      leaveType,
      startDate,
      endDate,
      days,
      status: "pending",
      reason,
      managerComment: null,
      approvedById: null,
    })
    .returning();

  res.status(201).json(await formatLeave(leave));
});

router.get("/leaves/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [leave] = await db.select().from(leavesTable).where(eq(leavesTable.id, id));
  if (!leave) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }
  res.json(await formatLeave(leave));
});

router.patch("/leaves/:id/approve", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [leave] = await db
    .update(leavesTable)
    .set({ status: "approved", managerComment: req.body.comment ?? null })
    .where(eq(leavesTable.id, id))
    .returning();

  if (!leave) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }
  res.json(await formatLeave(leave));
});

router.patch("/leaves/:id/reject", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [leave] = await db
    .update(leavesTable)
    .set({ status: "rejected", managerComment: req.body.comment ?? null })
    .where(eq(leavesTable.id, id))
    .returning();

  if (!leave) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }
  res.json(await formatLeave(leave));
});

export default router;
