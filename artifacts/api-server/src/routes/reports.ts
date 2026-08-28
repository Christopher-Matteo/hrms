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

  let empQuery = db
    .select({
      employee: employeesTable,
      branchName: branchesTable.name,
    })
    .from(employeesTable)
    .leftJoin(branchesTable, eq(employeesTable.branchId, branchesTable.id))
    .$dynamic();

  if (conditions.length > 0) empQuery = empQuery.where(and(...conditions));
  const employees = await empQuery;

  // Bulk fetch attendance for the month
  const attendanceRecords = await db
    .select()
    .from(attendanceTable)
    .where(sql`${attendanceTable.date}::text like ${String(month) + "%"}`);

  const attendanceMap = new Map<number, typeof attendanceRecords>();
  for (const r of attendanceRecords) {
    if (!attendanceMap.has(r.employeeId)) {
      attendanceMap.set(r.employeeId, []);
    }
    attendanceMap.get(r.employeeId)!.push(r);
  }

  const result = employees.map(({ employee, branchName }) => {
    const attendance = attendanceMap.get(employee.id) || [];
    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeCode: employee.employeeId,
      department: employee.department,
      branchName: branchName ?? "",
      presentDays: attendance.filter(a => ["present", "late", "overtime"].includes(a.status)).length,
      absentDays: attendance.filter(a => a.status === "absent").length,
      weeklyOffDays: attendance.filter(a => a.status === "weekly_off").length,
      leaveDays: attendance.filter(a => ["paid_leave", "sick_leave", "half_day"].includes(a.status)).length,
      lateDays: attendance.filter(a => a.status === "late").length,
      overtimeHours: attendance.reduce((sum, a) => sum + Number(a.overtimeHours ?? 0), 0),
      workingHours: attendance.reduce((sum, a) => sum + Number(a.workingHours ?? 0), 0),
    };
  });

  res.json(result);
});

router.get("/reports/payroll", async (req, res): Promise<void> => {
  const { month, branchId } = req.query;
  if (!month) {
    res.status(400).json({ error: "Month required" });
    return;
  }

  const conditions = [eq(payrollTable.month, String(month))];
  if (branchId) conditions.push(eq(employeesTable.branchId, Number(branchId)));

  let query = db
    .select({
      payroll: payrollTable,
      employeeFirstName: employeesTable.firstName,
      employeeLastName: employeesTable.lastName,
      employeeCode: employeesTable.employeeId,
      department: employeesTable.department,
      branchName: branchesTable.name,
    })
    .from(payrollTable)
    .leftJoin(employeesTable, eq(payrollTable.employeeId, employeesTable.id))
    .leftJoin(branchesTable, eq(employeesTable.branchId, branchesTable.id))
    .$dynamic();

  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query;

  const result = rows.map((r) => ({
    employeeId: r.payroll.employeeId,
    employeeName: r.employeeFirstName && r.employeeLastName ? `${r.employeeFirstName} ${r.employeeLastName}` : "",
    employeeCode: r.employeeCode ?? "",
    department: r.department ?? "",
    branchName: r.branchName ?? "",
    basicSalary: Number(r.payroll.basicSalary),
    grossSalary: Number(r.payroll.grossSalary),
    totalDeductions: Number(r.payroll.totalDeductions),
    netSalary: Number(r.payroll.netSalary),
    month: r.payroll.month,
    status: r.payroll.status,
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

  let query = db
    .select({
      leave: leavesTable,
      employeeFirstName: employeesTable.firstName,
      employeeLastName: employeesTable.lastName,
      employeeCode: employeesTable.employeeId,
      department: employeesTable.department,
    })
    .from(leavesTable)
    .leftJoin(employeesTable, eq(leavesTable.employeeId, employeesTable.id))
    .$dynamic();

  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query;

  // Group by employee
  const byEmployee = new Map<number, { employeeName: string; employeeCode: string; department: string; leaves: typeof leavesTable.$inferSelect[] }>();
  for (const row of rows) {
    const empId = row.leave.employeeId;
    if (!byEmployee.has(empId)) {
      byEmployee.set(empId, {
        employeeName: row.employeeFirstName && row.employeeLastName ? `${row.employeeFirstName} ${row.employeeLastName}` : "",
        employeeCode: row.employeeCode ?? "",
        department: row.department ?? "",
        leaves: [],
      });
    }
    byEmployee.get(empId)!.leaves.push(row.leave);
  }

  const result = Array.from(byEmployee.entries()).map(([empId, info]) => {
    const empLeaves = info.leaves;
    return {
      employeeId: empId,
      employeeName: info.employeeName,
      employeeCode: info.employeeCode,
      department: info.department,
      casualLeaves: empLeaves.filter(l => l.leaveType === "casual").length,
      sickLeaves: empLeaves.filter(l => l.leaveType === "sick").length,
      earnedLeaves: empLeaves.filter(l => l.leaveType === "earned").length,
      lossOfPayLeaves: empLeaves.filter(l => l.leaveType === "loss_of_pay").length,
      totalLeaves: empLeaves.length,
      pendingLeaves: empLeaves.filter(l => l.status === "pending").length,
      approvedLeaves: empLeaves.filter(l => l.status === "approved").length,
    };
  });

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
    const attRows = await db
      .select({
        attendance: attendanceTable,
        employeeCode: employeesTable.employeeId,
        firstName: employeesTable.firstName,
        lastName: employeesTable.lastName,
      })
      .from(attendanceTable)
      .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
      .where(sql`${attendanceTable.date}::text like ${month + "%"}`);

    for (const r of attRows) {
      csvLines.push([
        cell(r.attendance.date),
        cell(r.employeeCode),
        cell(r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : ""),
        cell(r.attendance.status),
        cell(r.attendance.checkIn),
        cell(r.attendance.checkOut),
        cell(r.attendance.workingHours),
        cell(r.attendance.lateMinutes),
        cell(r.attendance.overtimeHours)
      ].join(","));
    }
    csvLines.push("");

    // 2. Payroll & Payslips
    csvLines.push("=== PAYROLL & PAYSLIPS SECTION ===");
    csvLines.push("Month,Employee Code,Employee Name,Basic Salary,Gross Salary,Total Deductions,Net Salary,Status");
    const payRows = await db
      .select({
        payroll: payrollTable,
        employeeCode: employeesTable.employeeId,
        firstName: employeesTable.firstName,
        lastName: employeesTable.lastName,
      })
      .from(payrollTable)
      .leftJoin(employeesTable, eq(payrollTable.employeeId, employeesTable.id))
      .where(eq(payrollTable.month, month));

    for (const r of payRows) {
      csvLines.push([
        cell(r.payroll.month),
        cell(r.employeeCode),
        cell(r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : ""),
        cell(r.payroll.basicSalary),
        cell(r.payroll.grossSalary),
        cell(r.payroll.totalDeductions),
        cell(r.payroll.netSalary),
        cell(r.payroll.status)
      ].join(","));
    }
    csvLines.push("");

    // 3. Leave Requests
    csvLines.push("=== LEAVE SECTION ===");
    csvLines.push("Leave Type,Employee Code,Employee Name,Start Date,End Date,Days,Status,Reason");
    const leaveRows = await db
      .select({
        leave: leavesTable,
        employeeCode: employeesTable.employeeId,
        firstName: employeesTable.firstName,
        lastName: employeesTable.lastName,
      })
      .from(leavesTable)
      .leftJoin(employeesTable, eq(leavesTable.employeeId, employeesTable.id))
      .where(sql`${leavesTable.startDate}::text like ${month + "%"}`);

    for (const r of leaveRows) {
      csvLines.push([
        cell(r.leave.leaveType),
        cell(r.employeeCode),
        cell(r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : ""),
        cell(r.leave.startDate),
        cell(r.leave.endDate),
        cell(r.leave.days),
        cell(r.leave.status),
        cell(r.leave.reason)
      ].join(","));
    }
    csvLines.push("");

    // 4. Advances
    csvLines.push("=== ADVANCES SECTION ===");
    csvLines.push("Date,Employee Code,Employee Name,Amount,Status,Reason");
    const advRows = await db
      .select({
        advance: advancesTable,
        employeeCode: employeesTable.employeeId,
        firstName: employeesTable.firstName,
        lastName: employeesTable.lastName,
      })
      .from(advancesTable)
      .leftJoin(employeesTable, eq(advancesTable.employeeId, employeesTable.id))
      .where(sql`${advancesTable.date}::text like ${month + "%"}`);

    for (const r of advRows) {
      csvLines.push([
        cell(r.advance.date),
        cell(r.employeeCode),
        cell(r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : ""),
        cell(r.advance.amount),
        cell(r.advance.status),
        cell(r.advance.reason)
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
