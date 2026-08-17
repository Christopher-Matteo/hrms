import { Router, type IRouter } from "express";
import { db, continueDutiesTable, employeesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

async function formatDuty(d: typeof continueDutiesTable.$inferSelect) {
  const [emp] = await db
    .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
    .from(employeesTable)
    .where(eq(employeesTable.id, d.employeeId));

  return {
    id: d.id,
    employeeId: d.employeeId,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
    date: d.date,
    amount: Number(d.amount),
    remarks: d.remarks,
    createdAt: d.createdAt.toISOString(),
  };
}

router.get("/continue-duties", async (req, res): Promise<void> => {
  const { employeeId, month } = req.query;

  const conditions = [];
  if (employeeId) conditions.push(eq(continueDutiesTable.employeeId, Number(employeeId)));
  if (month) conditions.push(sql`${continueDutiesTable.date}::text like ${String(month) + "%"}`);

  let query = db.select().from(continueDutiesTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  const duties = await query.orderBy(continueDutiesTable.date);

  const result = await Promise.all(duties.map(formatDuty));
  res.json(result);
});

router.post("/continue-duties", async (req, res): Promise<void> => {
  const { employeeId, date, amount, remarks } = req.body;
  if (!employeeId || !date || !amount) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [duty] = await db
    .insert(continueDutiesTable)
    .values({
      employeeId: Number(employeeId),
      date,
      amount: String(amount),
      remarks: remarks ?? null,
    })
    .returning();

  res.status(201).json(await formatDuty(duty));
});

router.get("/continue-duties/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [duty] = await db.select().from(continueDutiesTable).where(eq(continueDutiesTable.id, id));
  if (!duty) {
    res.status(404).json({ error: "Continue duty not found" });
    return;
  }
  res.json(await formatDuty(duty));
});

router.patch("/continue-duties/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const updates: Record<string, unknown> = {};
  if (req.body.date !== undefined) updates.date = req.body.date;
  if (req.body.amount !== undefined) updates.amount = String(req.body.amount);
  if (req.body.remarks !== undefined) updates.remarks = req.body.remarks;

  const [duty] = await db
    .update(continueDutiesTable)
    .set(updates)
    .where(eq(continueDutiesTable.id, id))
    .returning();

  if (!duty) {
    res.status(404).json({ error: "Continue duty not found" });
    return;
  }
  res.json(await formatDuty(duty));
});

router.delete("/continue-duties/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(continueDutiesTable).where(eq(continueDutiesTable.id, id));
  res.sendStatus(204);
});

export default router;
