import { Router, type IRouter } from "express";
import { db, payrollTable, employeesTable, attendanceTable, advancesTable, continueDutiesTable, branchesTable, settingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

async function formatPayroll(p: typeof payrollTable.$inferSelect) {
  const [emp] = await db
    .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName, employeeId: employeesTable.employeeId, department: employeesTable.department, branchId: employeesTable.branchId })
    .from(employeesTable)
    .where(eq(employeesTable.id, p.employeeId));

  let branchName: string | null = null;
  if (emp?.branchId) {
    const [branch] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, emp.branchId));
    branchName = branch?.name ?? null;
  }

  return {
    id: p.id,
    employeeId: p.employeeId,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
    employeeCode: emp?.employeeId ?? null,
    branchName,
    department: emp?.department ?? null,
    month: p.month,
    basicSalary: Number(p.basicSalary),
    workingDays: p.workingDays,
    expectedWorkingDays: p.expectedWorkingDays,
    presentDays: p.presentDays,
    absentDays: p.absentDays,
    weeklyOffDays: p.weeklyOffDays,
    leaveDays: p.leaveDays,
    continueDutyDays: p.continueDutyDays,
    continueDutyAmount: Number(p.continueDutyAmount),
    overtimeHours: Number(p.overtimeHours),
    overtimeAmount: Number(p.overtimeAmount),
    bonus: Number(p.bonus),
    allowances: Number(p.allowances),
    advanceDeduction: Number(p.advanceDeduction),
    absentDeduction: Number(p.absentDeduction),
    lateDeduction: Number(p.lateDeduction),
    grossSalary: Number(p.grossSalary),
    totalDeductions: Number(p.totalDeductions),
    netSalary: Number(p.netSalary),
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  };
}

function getDaysInMonth(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m, 0).getDate();
}

router.get("/payroll", async (req, res): Promise<void> => {
  const { month, branchId, employeeId, status } = req.query;

  const conditions = [];
  if (month) conditions.push(eq(payrollTable.month, String(month)));
  if (employeeId) conditions.push(eq(payrollTable.employeeId, Number(employeeId)));
  if (status) conditions.push(eq(payrollTable.status, String(status)));

  let query = db.select().from(payrollTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  const records = await query.orderBy(payrollTable.createdAt);

  const result = await Promise.all(records.map(formatPayroll));
  res.json(result);
});

router.post("/payroll", async (req, res): Promise<void> => {
  const { month, branchId, employeeId } = req.body;
  if (!month) {
    res.status(400).json({ error: "Month required" });
    return;
  }

  // Get settings
  const [settings] = await db.select().from(settingsTable).limit(1);
  const overtimeRate = settings ? Number(settings.overtimeRatePerHour) : 50;
  const continueDutyRate = settings ? Number(settings.continueDutyRate) : 500;
  const lateDeductionPerMin = settings ? Number(settings.lateDeductionPerMinute) : 2;

  // Get employees to generate payroll for
  const empConditions = [];
  if (branchId) empConditions.push(eq(employeesTable.branchId, Number(branchId)));
  if (employeeId) empConditions.push(eq(employeesTable.id, Number(employeeId)));
  empConditions.push(eq(employeesTable.status, "active"));

  let empQuery = db.select().from(employeesTable).$dynamic();
  if (empConditions.length > 0) empQuery = empQuery.where(and(...empConditions));
  const employees = await empQuery;

  const totalDays = getDaysInMonth(month);
  const generated = [];

  for (const emp of employees) {
    // Check if payroll already exists
    const existing = await db.select().from(payrollTable)
      .where(and(eq(payrollTable.employeeId, emp.id), eq(payrollTable.month, month)));
    if (existing.length > 0) continue;

    // Get attendance for the month
    const attendance = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.employeeId, emp.id), sql`${attendanceTable.date} like ${month + "%"}`));

    const presentDays = attendance.filter(a => ["present", "late", "overtime"].includes(a.status)).length;
    const absentDays = attendance.filter(a => a.status === "absent").length;
    const weeklyOffDays = attendance.filter(a => a.status === "weekly_off").length;
    const leaveDays = attendance.filter(a => ["paid_leave", "sick_leave", "half_day"].includes(a.status)).length;
    const continueDutyCount = attendance.filter(a => a.status === "continue_duty").length;
    const totalLateMinutes = attendance.reduce((sum, a) => sum + (a.lateMinutes ?? 0), 0);
    const totalOvertimeHours = attendance.reduce((sum, a) => sum + Number(a.overtimeHours ?? 0), 0);

    // Get continue duties
    const cdEntries = await db.select().from(continueDutiesTable)
      .where(and(eq(continueDutiesTable.employeeId, emp.id), sql`${continueDutiesTable.date} like ${month + "%"}`));
    const cdAmount = cdEntries.reduce((sum, cd) => sum + Number(cd.amount), 0);

    // Get pending advances
    const approvedAdvances = await db.select().from(advancesTable)
      .where(and(eq(advancesTable.employeeId, emp.id), eq(advancesTable.status, "approved")));
    const advanceDeduction = approvedAdvances.reduce((sum, a) => sum + Number(a.remainingBalance), 0);

    const basicSalary = Number(emp.salary);
    const expectedWorkingDays = totalDays - weeklyOffDays;
    const perDayRate = basicSalary / (expectedWorkingDays || 26);

    const absentDeduction = absentDays * perDayRate;
    const lateDeduction = totalLateMinutes * lateDeductionPerMin;
    const overtimeAmount = totalOvertimeHours * overtimeRate;
    const continueDutyAmount = cdAmount || (continueDutyCount * continueDutyRate);

    const grossSalary = basicSalary + overtimeAmount + continueDutyAmount;
    const totalDeductions = absentDeduction + lateDeduction + advanceDeduction;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    const [payrollRecord] = await db.insert(payrollTable).values({
      employeeId: emp.id,
      month,
      basicSalary: String(basicSalary),
      workingDays: presentDays + leaveDays + continueDutyCount,
      expectedWorkingDays,
      presentDays,
      absentDays,
      weeklyOffDays,
      leaveDays,
      continueDutyDays: continueDutyCount,
      continueDutyAmount: String(continueDutyAmount),
      overtimeHours: String(totalOvertimeHours),
      overtimeAmount: String(overtimeAmount),
      bonus: "0",
      allowances: "0",
      advanceDeduction: String(advanceDeduction),
      absentDeduction: String(absentDeduction),
      lateDeduction: String(lateDeduction),
      grossSalary: String(grossSalary),
      totalDeductions: String(totalDeductions),
      netSalary: String(netSalary),
      status: "draft",
    }).returning();

    generated.push(await formatPayroll(payrollRecord));
  }

  res.status(201).json(generated);
});

router.get("/payroll/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [record] = await db.select().from(payrollTable).where(eq(payrollTable.id, id));
  if (!record) {
    res.status(404).json({ error: "Payroll record not found" });
    return;
  }
  res.json(await formatPayroll(record));
});

router.patch("/payroll/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const updates: Record<string, unknown> = {};
  if (req.body.bonus !== undefined) updates.bonus = String(req.body.bonus);
  if (req.body.allowances !== undefined) updates.allowances = String(req.body.allowances);
  if (req.body.overtimeAmount !== undefined) updates.overtimeAmount = String(req.body.overtimeAmount);
  if (req.body.status !== undefined) updates.status = req.body.status;

  // Recalculate net salary if needed
  const [existing] = await db.select().from(payrollTable).where(eq(payrollTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Payroll record not found" });
    return;
  }

  const bonus = updates.bonus != null ? Number(updates.bonus) : Number(existing.bonus);
  const allowances = updates.allowances != null ? Number(updates.allowances) : Number(existing.allowances);
  const grossSalary = Number(existing.basicSalary) + Number(existing.overtimeAmount) + Number(existing.continueDutyAmount) + bonus + allowances;
  const netSalary = Math.max(0, grossSalary - Number(existing.totalDeductions));
  updates.grossSalary = String(grossSalary);
  updates.netSalary = String(netSalary);

  const [record] = await db
    .update(payrollTable)
    .set(updates)
    .where(eq(payrollTable.id, id))
    .returning();

  res.json(await formatPayroll(record));
});

router.patch("/payroll/:id/approve", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [record] = await db
    .update(payrollTable)
    .set({ status: "approved" })
    .where(eq(payrollTable.id, id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Payroll record not found" });
    return;
  }
  res.json(await formatPayroll(record));
});

export default router;
