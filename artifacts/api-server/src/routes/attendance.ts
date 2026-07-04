import { Router, type IRouter } from "express";
import { db, attendanceTable, employeesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

function formatRecord(r: typeof attendanceTable.$inferSelect, employeeName?: string | null, employeeCode?: string | null) {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: employeeName ?? null,
    employeeCode: employeeCode ?? null,
    date: r.date,
    status: r.status,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    workingHours: r.workingHours ? Number(r.workingHours) : null,
    breakTime: r.breakTime ? Number(r.breakTime) : null,
    lateMinutes: r.lateMinutes,
    overtimeHours: r.overtimeHours ? Number(r.overtimeHours) : null,
    remarks: r.remarks,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/attendance", async (req, res): Promise<void> => {
  const { employeeId, branchId, date, month, status } = req.query;

  const conditions = [];
  if (employeeId) conditions.push(eq(attendanceTable.employeeId, Number(employeeId)));
  if (date) conditions.push(eq(attendanceTable.date, String(date)));
  if (month) {
    conditions.push(sql`${attendanceTable.date} like ${String(month) + "%"}`);
  }
  if (status) conditions.push(eq(attendanceTable.status, String(status)));

  let query = db.select().from(attendanceTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  const records = await query.orderBy(attendanceTable.date);

  // Enrich with employee names
  const result = await Promise.all(
    records.map(async (r) => {
      const [emp] = await db
        .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName, employeeId: employeesTable.employeeId })
        .from(employeesTable)
        .where(eq(employeesTable.id, r.employeeId));
      return formatRecord(
        r,
        emp ? `${emp.firstName} ${emp.lastName}` : null,
        emp?.employeeId ?? null
      );
    })
  );

  res.json(result);
});

router.post("/attendance", async (req, res): Promise<void> => {
  const { employeeId, date, status, checkIn, checkOut, workingHours, breakTime, lateMinutes, overtimeHours, remarks } = req.body;
  if (!employeeId || !date || !status) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [record] = await db
    .insert(attendanceTable)
    .values({
      employeeId: Number(employeeId),
      date,
      status,
      checkIn: checkIn ?? null,
      checkOut: checkOut ?? null,
      workingHours: workingHours != null ? String(workingHours) : null,
      breakTime: breakTime != null ? String(breakTime) : null,
      lateMinutes: lateMinutes ?? null,
      overtimeHours: overtimeHours != null ? String(overtimeHours) : null,
      remarks: remarks ?? null,
    })
    .returning();

  const [emp] = await db
    .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName, employeeId: employeesTable.employeeId })
    .from(employeesTable)
    .where(eq(employeesTable.id, record.employeeId));

  res.status(201).json(formatRecord(record, emp ? `${emp.firstName} ${emp.lastName}` : null, emp?.employeeId ?? null));
});

router.get("/attendance/calendar", async (req, res): Promise<void> => {
  const { employeeId, month } = req.query;
  if (!employeeId || !month) {
    res.status(400).json({ error: "employeeId and month required" });
    return;
  }

  const records = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.employeeId, Number(employeeId)),
        sql`${attendanceTable.date} like ${String(month) + "%"}`
      )
    )
    .orderBy(attendanceTable.date);

  res.json(
    records.map((r) => ({
      date: r.date,
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      workingHours: r.workingHours ? Number(r.workingHours) : null,
      lateMinutes: r.lateMinutes,
      overtimeHours: r.overtimeHours ? Number(r.overtimeHours) : null,
    }))
  );
});

router.get("/attendance/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [record] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id));
  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.json(formatRecord(record));
});

router.patch("/attendance/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const updates: Record<string, unknown> = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.checkIn !== undefined) updates.checkIn = req.body.checkIn;
  if (req.body.checkOut !== undefined) updates.checkOut = req.body.checkOut;
  if (req.body.workingHours !== undefined) updates.workingHours = req.body.workingHours != null ? String(req.body.workingHours) : null;
  if (req.body.breakTime !== undefined) updates.breakTime = req.body.breakTime != null ? String(req.body.breakTime) : null;
  if (req.body.lateMinutes !== undefined) updates.lateMinutes = req.body.lateMinutes;
  if (req.body.overtimeHours !== undefined) updates.overtimeHours = req.body.overtimeHours != null ? String(req.body.overtimeHours) : null;
  if (req.body.remarks !== undefined) updates.remarks = req.body.remarks;

  const [record] = await db
    .update(attendanceTable)
    .set(updates)
    .where(eq(attendanceTable.id, id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.json(formatRecord(record));
});

router.delete("/attendance/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(attendanceTable).where(eq(attendanceTable.id, id));
  res.sendStatus(204);
});

export default router;
