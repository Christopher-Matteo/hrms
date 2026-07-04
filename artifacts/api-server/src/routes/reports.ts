import { Router, type IRouter } from "express";
import { db, employeesTable, attendanceTable, payrollTable, leavesTable, branchesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reports/attendance", async (req, res): Promise<void> => {
  const { month, branchId, departmentId, employeeId } = req.query;
  if (!month) {
    res.status(400).json({ error: "Month required" });
    return;
  }

  const conditions = [eq(employeesTable.status, "active")];
  if (branchId) conditions.push(eq(employeesTable.branchId, Number(branchId)));
  if (employeeId) conditions.push(eq(employeesTable.id, Number(employeeId)));

  let empQuery = db.select().from(employeesTable).$dynamic();
  if (conditions.length > 0) empQuery = empQuery.where(and(...conditions));
  const employees = await empQuery;

  const result = await Promise.all(employees.map(async (emp) => {
    const attendance = await db.select().from(attendanceTable)
      .where(and(
        eq(attendanceTable.employeeId, emp.id),
        sql`${attendanceTable.date} like ${String(month) + "%"}`
      ));

    const branchName = emp.branchId
      ? (await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, emp.branchId)))[0]?.name ?? ""
      : "";

    return {
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      employeeCode: emp.employeeId,
      department: emp.department,
      branchName,
      presentDays: attendance.filter(a => ["present", "late", "overtime"].includes(a.status)).length,
      absentDays: attendance.filter(a => a.status === "absent").length,
      weeklyOffDays: attendance.filter(a => a.status === "weekly_off").length,
      leaveDays: attendance.filter(a => ["paid_leave", "sick_leave", "half_day"].includes(a.status)).length,
      lateDays: attendance.filter(a => a.status === "late").length,
      overtimeHours: attendance.reduce((sum, a) => sum + Number(a.overtimeHours ?? 0), 0),
      workingHours: attendance.reduce((sum, a) => sum + Number(a.workingHours ?? 0), 0),
    };
  }));

  res.json(result);
});

router.get("/reports/payroll", async (req, res): Promise<void> => {
  const { month, branchId } = req.query;
  if (!month) {
    res.status(400).json({ error: "Month required" });
    return;
  }

  const conditions = [eq(payrollTable.month, String(month))];
  let query = db.select().from(payrollTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  const records = await query;

  const result = await Promise.all(records.map(async (p) => {
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, p.employeeId));
    const branchName = emp?.branchId
      ? (await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, emp.branchId)))[0]?.name ?? ""
      : "";

    return {
      employeeId: p.employeeId,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "",
      employeeCode: emp?.employeeId ?? "",
      department: emp?.department ?? "",
      branchName,
      basicSalary: Number(p.basicSalary),
      grossSalary: Number(p.grossSalary),
      totalDeductions: Number(p.totalDeductions),
      netSalary: Number(p.netSalary),
      month: p.month,
      status: p.status,
    };
  }));

  res.json(result);
});

router.get("/reports/leave", async (req, res): Promise<void> => {
  const { month, employeeId } = req.query;
  if (!month) {
    res.status(400).json({ error: "Month required" });
    return;
  }

  const conditions = [sql`${leavesTable.startDate} like ${String(month) + "%"}`];
  if (employeeId) conditions.push(eq(leavesTable.employeeId, Number(employeeId)));

  let query = db.select().from(leavesTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  const leaves = await query;

  // Group by employee
  const byEmployee = new Map<number, typeof leaves>();
  for (const leave of leaves) {
    if (!byEmployee.has(leave.employeeId)) byEmployee.set(leave.employeeId, []);
    byEmployee.get(leave.employeeId)!.push(leave);
  }

  const result = await Promise.all(Array.from(byEmployee.entries()).map(async ([empId, empLeaves]) => {
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, empId));
    return {
      employeeId: empId,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "",
      employeeCode: emp?.employeeId ?? "",
      department: emp?.department ?? "",
      casualLeaves: empLeaves.filter(l => l.leaveType === "casual").length,
      sickLeaves: empLeaves.filter(l => l.leaveType === "sick").length,
      earnedLeaves: empLeaves.filter(l => l.leaveType === "earned").length,
      lossOfPayLeaves: empLeaves.filter(l => l.leaveType === "loss_of_pay").length,
      totalLeaves: empLeaves.length,
      pendingLeaves: empLeaves.filter(l => l.status === "pending").length,
      approvedLeaves: empLeaves.filter(l => l.status === "approved").length,
    };
  }));

  res.json(result);
});

export default router;
