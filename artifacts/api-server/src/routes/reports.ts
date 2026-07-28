import { Router, type IRouter } from "express";
import { db, employeesTable, attendanceTable, payrollTable, leavesTable, branchesTable, advancesTable, expensesTable, incomeTable } from "@workspace/db";
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
        sql`${attendanceTable.date}::text like ${String(month) + "%"}`
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

  const conditions = [sql`${leavesTable.startDate}::text like ${String(month) + "%"}`];
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

router.get("/reports/month-end-export", async (req, res): Promise<void> => {
  const { month } = req.query;
  if (!month || typeof month !== "string") {
    res.status(400).json({ error: "Month (YYYY-MM) is required" });
    return;
  }

  try {
    const csvLines: string[] = [];
    const cell = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    // 1. Attendance
    csvLines.push("=== ATTENDANCE SECTION ===");
    csvLines.push("Date,Employee Code,Employee Name,Status,Check In,Check Out,Working Hours,Late Minutes,Overtime Hours");
    const attRecs = await db.select().from(attendanceTable)
      .where(sql`${attendanceTable.date}::text like ${month + "%"}`);
    for (const a of attRecs) {
      const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, a.employeeId));
      csvLines.push([
        cell(a.date),
        cell(emp?.employeeId),
        cell(emp ? `${emp.firstName} ${emp.lastName}` : ""),
        cell(a.status),
        cell(a.checkIn),
        cell(a.checkOut),
        cell(a.workingHours),
        cell(a.lateMinutes),
        cell(a.overtimeHours)
      ].join(","));
    }
    csvLines.push("");

    // 2. Payroll & Payslips
    csvLines.push("=== PAYROLL & PAYSLIPS SECTION ===");
    csvLines.push("Month,Employee Code,Employee Name,Basic Salary,Gross Salary,Total Deductions,Net Salary,Status");
    const payRecs = await db.select().from(payrollTable)
      .where(eq(payrollTable.month, month));
    for (const p of payRecs) {
      const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, p.employeeId));
      csvLines.push([
        cell(p.month),
        cell(emp?.employeeId),
        cell(emp ? `${emp.firstName} ${emp.lastName}` : ""),
        cell(p.basicSalary),
        cell(p.grossSalary),
        cell(p.totalDeductions),
        cell(p.netSalary),
        cell(p.status)
      ].join(","));
    }
    csvLines.push("");

    // 3. Leave Requests
    csvLines.push("=== LEAVE SECTION ===");
    csvLines.push("Leave Type,Employee Code,Employee Name,Start Date,End Date,Days,Status,Reason");
    const leaveRecs = await db.select().from(leavesTable)
      .where(sql`${leavesTable.startDate}::text like ${month + "%"}`);
    for (const l of leaveRecs) {
      const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, l.employeeId));
      csvLines.push([
        cell(l.leaveType),
        cell(emp?.employeeId),
        cell(emp ? `${emp.firstName} ${emp.lastName}` : ""),
        cell(l.startDate),
        cell(l.endDate),
        cell(l.days),
        cell(l.status),
        cell(l.reason)
      ].join(","));
    }
    csvLines.push("");

    // 4. Advances
    csvLines.push("=== ADVANCES SECTION ===");
    csvLines.push("Date,Employee Code,Employee Name,Amount,Status,Reason");
    const advRecs = await db.select().from(advancesTable)
      .where(sql`${advancesTable.date}::text like ${month + "%"}`);
    for (const ad of advRecs) {
      const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, ad.employeeId));
      csvLines.push([
        cell(ad.date),
        cell(emp?.employeeId),
        cell(emp ? `${emp.firstName} ${emp.lastName}` : ""),
        cell(ad.amount),
        cell(ad.status),
        cell(ad.reason)
      ].join(","));
    }
    csvLines.push("");

    // 5. Expenses
    csvLines.push("=== EXPENSES SECTION ===");
    csvLines.push("Date,Title,Category,Amount,Status");
    const expRecs = await db.select().from(expensesTable)
      .where(sql`${expensesTable.date}::text like ${month + "%"}`);
    for (const e of expRecs) {
      csvLines.push([
        cell(e.date),
        cell(e.title),
        cell(e.category),
        cell(e.amount),
        cell(e.status)
      ].join(","));
    }
    csvLines.push("");

    // 6. Income
    csvLines.push("=== INCOME SECTION ===");
    csvLines.push("Date,Title,Category,Amount,Status");
    const incRecs = await db.select().from(incomeTable)
      .where(sql`${incomeTable.date}::text like ${month + "%"}`);
    for (const i of incRecs) {
      csvLines.push([
        cell(i.date),
        cell(i.title),
        cell(i.category),
        cell(i.amount),
        cell(i.status)
      ].join(","));
    }

    const csvContent = csvLines.join("\n");
    res.setHeader("Content-Type", "text/csv;charset=utf-8;");
    res.setHeader("Content-Disposition", `attachment; filename="month_end_export_${month}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error("Month end export error:", error);
    res.status(500).json({ error: "Failed to generate monthly export" });
  }
});

export default router;
