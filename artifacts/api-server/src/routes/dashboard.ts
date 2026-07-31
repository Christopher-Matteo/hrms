import { Router, type IRouter } from "express";
import { db, employeesTable, attendanceTable, payrollTable, branchesTable, auditLogsTable } from "@workspace/db";
import { eq, and, sql, gte } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const todayDate = new Date();
  const today = todayDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const currentMonth = today.slice(0, 7);
  const thirtyDaysAgoDate = new Date(todayDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = thirtyDaysAgoDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [totalEmp] = await db.select({ count: sql<number>`count(*)` }).from(employeesTable).where(eq(employeesTable.status, "active"));
  const [totalBranches] = await db.select({ count: sql<number>`count(*)` }).from(branchesTable);

  const todayAttendance = await db.select().from(attendanceTable).where(eq(attendanceTable.date, today));
  const presentToday = todayAttendance.filter(a => ["present", "late", "overtime"].includes(a.status)).length;
  const absentToday = todayAttendance.filter(a => a.status === "absent").length;
  const weeklyOffToday = todayAttendance.filter(a => a.status === "weekly_off").length;
  const leaveToday = todayAttendance.filter(a => ["paid_leave", "sick_leave"].includes(a.status)).length;
  const lateArrivals = todayAttendance.filter(a => a.status === "late").length;
  const overtimeEmployees = todayAttendance.filter(a => a.status === "overtime").length;

  const [monthPayroll] = await db
    .select({ total: sql<number>`coalesce(sum(net_salary), 0)` })
    .from(payrollTable)
    .where(eq(payrollTable.month, currentMonth));

  // New employees in last 30 days
  const newEmployees = await db
    .select({ count: sql<number>`count(*)` })
    .from(employeesTable)
    .where(sql`${employeesTable.joiningDate} >= ${thirtyDaysAgo}`);

  // Salary expense (active employees monthly salary sum)
  const [salaryExpense] = await db
    .select({ total: sql<number>`coalesce(sum(salary), 0)` })
    .from(employeesTable)
    .where(eq(employeesTable.status, "active"));

  res.json({
    totalEmployees: Number(totalEmp?.count ?? 0),
    presentToday,
    absentToday,
    weeklyOffToday,
    leaveToday,
    lateArrivals,
    overtimeEmployees,
    totalBranches: Number(totalBranches?.count ?? 0),
    monthlyPayroll: Number(monthPayroll?.total ?? 0),
    newEmployees: Number(newEmployees[0]?.count ?? 0),
    salaryExpense: Number(salaryExpense?.total ?? 0),
  });
});

router.get("/dashboard/attendance-trend", async (req, res): Promise<void> => {
  // Last 14 days trend
  const result = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const date = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const records = await db.select().from(attendanceTable).where(eq(attendanceTable.date, date));
    result.push({
      date,
      present: records.filter(r => ["present", "late", "overtime"].includes(r.status)).length,
      absent: records.filter(r => r.status === "absent").length,
      leave: records.filter(r => ["paid_leave", "sick_leave", "half_day"].includes(r.status)).length,
      weeklyOff: records.filter(r => r.status === "weekly_off").length,
    });
  }
  res.json(result);
});

router.get("/dashboard/payroll-trend", async (req, res): Promise<void> => {
  const result = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const month = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

    const [total] = await db
      .select({ total: sql<number>`coalesce(sum(net_salary), 0)`, count: sql<number>`count(*)` })
      .from(payrollTable)
      .where(eq(payrollTable.month, month));

    result.push({
      month,
      totalPayroll: Number(total?.total ?? 0),
      employeeCount: Number(total?.count ?? 0),
    });
  }
  res.json(result);
});

router.get("/dashboard/department-distribution", async (req, res): Promise<void> => {
  const result = await db
    .select({ department: employeesTable.department, count: sql<number>`count(*)` })
    .from(employeesTable)
    .where(eq(employeesTable.status, "active"))
    .groupBy(employeesTable.department);

  res.json(result.map(r => ({ department: r.department, count: Number(r.count) })));
});

router.get("/dashboard/recent-activities", async (req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(auditLogsTable)
    .orderBy(auditLogsTable.createdAt)
    .limit(20);

  res.json(logs.reverse().map(l => ({
    id: l.id,
    action: l.action,
    description: `${l.action} ${l.entity}${l.entityId ? ` #${l.entityId}` : ""}`,
    userName: l.userName,
    createdAt: l.createdAt.toISOString(),
  })));
});

router.get("/dashboard/upcoming-birthdays", async (req, res): Promise<void> => {
  const today = new Date();
  const employees = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.status, "active"), sql`${employeesTable.dob} is not null`));

  const withBirthdays = employees
    .filter(e => e.dob)
    .map(e => {
      const dob = new Date(e.dob!);
      const nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);
      const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        dob: e.dob,
        department: e.department,
        photoUrl: e.photoUrl,
        daysUntil,
      };
    })
    .filter(e => e.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 10);

  res.json(withBirthdays);
});

export default router;
