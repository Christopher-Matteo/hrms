import { Router, type IRouter } from "express";
import { db, advancesTable, employeesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

async function formatAdvance(
  a: typeof advancesTable.$inferSelect,
  preFetchedEmp?: { firstName: string; lastName: string } | null
) {
  let emp = preFetchedEmp;
  if (emp === undefined) {
    const [dbEmp] = await db
      .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
      .from(employeesTable)
      .where(eq(employeesTable.id, a.employeeId));
    emp = dbEmp ?? null;
  }

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

  let query = db
    .select({
      advance: advancesTable,
      employeeFirstName: employeesTable.firstName,
      employeeLastName: employeesTable.lastName,
    })
    .from(advancesTable)
    .leftJoin(employeesTable, eq(advancesTable.employeeId, employeesTable.id))
    .$dynamic();

  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(advancesTable.createdAt);

  const result = await Promise.all(
    rows.map((r) =>
      formatAdvance(
        r.advance,
        r.employeeFirstName && r.employeeLastName
          ? {
              firstName: r.employeeFirstName,
              lastName: r.employeeLastName,
            }
          : null
      )
    )
  );
  res.json(result);
});

router.post("/advances", async (req, res): Promise<void> => {
  const { employeeId, amount, reason, date } = req.body;
  if (!employeeId || !amount || !reason) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [advance] = await db
    .insert(advancesTable)
    .values({
      employeeId: Number(employeeId),
      amount: String(amount),
      reason,
      status: "approved",
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
  if (req.body.remainingBalance !== undefined) {
    updates.remainingBalance = String(req.body.remainingBalance);
  }
  if (req.body.amount !== undefined) {
    updates.amount = String(req.body.amount);
    if (req.body.remainingBalance === undefined) {
      updates.remainingBalance = String(req.body.amount);
    }
  }
  if (req.body.reason !== undefined) updates.reason = req.body.reason;
  if (req.body.date !== undefined) updates.date = req.body.date;

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

router.delete("/advances/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(advancesTable).where(eq(advancesTable.id, id));
  res.sendStatus(204);
});

export default router;
