import { Router, type IRouter } from "express";
import { db, advancesTable, employeesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

async function formatAdvance(a: typeof advancesTable.$inferSelect) {
  const [emp] = await db
    .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
    .from(employeesTable)
    .where(eq(employeesTable.id, a.employeeId));

  return {
    id: a.id,
    employeeId: a.employeeId,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
    amount: Number(a.amount),
    reason: a.reason,
    status: a.status,
    approvedById: a.approvedById,
    remainingBalance: Number(a.remainingBalance),
    date: a.date,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/advances", async (req, res): Promise<void> => {
  const { employeeId, status } = req.query;

  const conditions = [];
  if (employeeId) conditions.push(eq(advancesTable.employeeId, Number(employeeId)));
  if (status) conditions.push(eq(advancesTable.status, String(status)));

  let query = db.select().from(advancesTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  const advances = await query.orderBy(advancesTable.createdAt);

  const result = await Promise.all(advances.map(formatAdvance));
  res.json(result);
});

router.post("/advances", async (req, res): Promise<void> => {
  const { employeeId, amount, reason, date } = req.body;
  if (!employeeId || !amount || !reason) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const [advance] = await db
    .insert(advancesTable)
    .values({
      employeeId: Number(employeeId),
      amount: String(amount),
      reason,
      status: "pending",
      approvedById: null,
      remainingBalance: String(amount),
      date: date ?? today,
    })
    .returning();

  res.status(201).json(await formatAdvance(advance));
});

router.get("/advances/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [advance] = await db.select().from(advancesTable).where(eq(advancesTable.id, id));
  if (!advance) {
    res.status(404).json({ error: "Advance not found" });
    return;
  }
  res.json(await formatAdvance(advance));
});

router.patch("/advances/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const updates: Record<string, unknown> = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.approvedById !== undefined) updates.approvedById = req.body.approvedById;
  if (req.body.remainingBalance !== undefined) updates.remainingBalance = String(req.body.remainingBalance);

  const [advance] = await db
    .update(advancesTable)
    .set(updates)
    .where(eq(advancesTable.id, id))
    .returning();

  if (!advance) {
    res.status(404).json({ error: "Advance not found" });
    return;
  }
  res.json(await formatAdvance(advance));
});

export default router;
