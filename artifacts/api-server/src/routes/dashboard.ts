import { Router, type IRouter } from "express";
import { db, employeesTable, attendanceTable, payrollTable, branchesTable, auditLogsTable, holidaysTable, weeklyOffPoliciesTable, shiftsTable, shiftScheduleTable } from "@workspace/db";
import { eq, and, sql, gte, inArray } from "drizzle-orm";
import { isEmployeeWeeklyOff } from "../lib/weeklyOffHelper";

const router: IRouter = Router();

function parseTimeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.endsWith("PM");
  const isAM = clean.endsWith("AM");
  let timePart = clean.replace(/(AM|PM)/g, "").trim();
  if (!timePart.includes(":")) {
    timePart = `${timePart}:00`;
  }
  const parts = timePart.split(":");
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
}

function isLateByMoreThanTwoHours(shiftStartStr: string, checkInStr: string): boolean {
  const shiftMinutes = parseTimeToMinutes(shiftStartStr);
  const checkInMinutes = parseTimeToMinutes(checkInStr);
  let diff = checkInMinutes - shiftMinutes;
  if (diff < -720) {
    diff += 1440;
  }
  return diff > 120;
}



router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const todayDate = new Date();
  const today = todayDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const currentMonth = today.slice(0, 7);
  const thirtyDaysAgoDate = new Date(todayDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = thirtyDaysAgoDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const activeEmployees = await db.select().from(employeesTable).where(eq(employeesTable.status, "active"));
  const [totalBranches] = await db.select({ count: sql<number>`count(*)` }).from(branchesTable);

  const todayAttendance = await db.select().from(attendanceTable).where(eq(attendanceTable.date, today));
  const holidays = await db.select().from(holidaysTable);
  const policies = await db.select().from(weeklyOffPoliciesTable);
  const shifts = await db.select().from(shiftsTable);

  // Fetch custom schedules for today
  const todaySchedules = await db
    .select()
    .from(shiftScheduleTable)
    .where(eq(shiftScheduleTable.date, today));
  const todayScheduleMap = new Map(todaySchedules.map(s => [s.employeeId, s.shiftId]));

  let presentToday = 0;
  let absentToday = 0;
  let weeklyOffToday = 0;
  let leaveToday = 0;
  let lateArrivals = 0;
  let overtimeEmployees = 0;

  const [year, m, d] = today.split("-").map(Number);
  const todayObj = new Date(year, m - 1, d);
  const todayDayName = todayObj.toLocaleDateString("en-US", { weekday: "long" });

  for (const emp of activeEmployees) {
    const att = todayAttendance.find(a => a.employeeId === emp.id);
    let status = "absent";

    if (att) {
      status = att.status;
    } else {
      const isHoliday = holidays.some(h => h.date === today && (!h.branchId || h.branchId === emp.branchId));
      if (isHoliday) {
        status = "public_holiday";
      } else {
        if (isEmployeeWeeklyOff(today, emp, policies)) {
          status = "weekly_off";
        } else {
          let isPastWindow = true;
          let startTimeStr = "09:00";
          const customShiftId = todayScheduleMap.get(emp.id);
          const targetShiftId = customShiftId !== undefined ? customShiftId : emp.shiftId;
          if (targetShiftId) {
            const sh = shifts.find(s => s.id === targetShiftId);
            if (sh?.startTime) {
              startTimeStr = sh.startTime;
            }
          }
          const currentISTTimeStr = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
          isPastWindow = isLateByMoreThanTwoHours(startTimeStr, currentISTTimeStr);

          if (isPastWindow) {
            status = "absent";
          } else {
            status = "pending";
          }
        }
      }
    }

    if (["present", "late", "overtime"].includes(status)) presentToday++;
    if (status === "absent") absentToday++;
    if (status === "weekly_off") weeklyOffToday++;
    if (["paid_leave", "sick_leave", "half_day"].includes(status)) leaveToday++;
    if (status === "late") lateArrivals++;
    if (status === "overtime") overtimeEmployees++;
  }

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
    totalEmployees: activeEmployees.length,
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
  const activeEmployees = await db.select().from(employeesTable).where(eq(employeesTable.status, "active"));
  const holidays = await db.select().from(holidaysTable);
  const policies = await db.select().from(weeklyOffPoliciesTable);
  const shifts = await db.select().from(shiftsTable);

  const result = [];
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const fourteenDaysAgoDate = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  const startDateStr = fourteenDaysAgoDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  // Bulk fetch attendance records for the last 14 days
  const allRecords = await db
    .select()
    .from(attendanceTable)
    .where(sql`${attendanceTable.date} >= ${startDateStr}`);

  // Fetch custom schedules for today
  const todaySchedules = await db
    .select()
    .from(shiftScheduleTable)
    .where(eq(shiftScheduleTable.date, todayStr));
  const todayScheduleMap = new Map(todaySchedules.map(s => [s.employeeId, s.shiftId]));

  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const date = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const records = allRecords.filter(r => r.date === date);

    const [year, m, day] = date.split("-").map(Number);
    const dateObj = new Date(year, m - 1, day);
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });

    let present = 0;
    let absent = 0;
    let leave = 0;
    let weeklyOff = 0;

    for (const emp of activeEmployees) {
      const att = records.find(r => r.employeeId === emp.id);
      let status = "absent";

      if (att) {
        status = att.status;
      } else {
        const isHoliday = holidays.some(h => h.date === date && (!h.branchId || h.branchId === emp.branchId));
        if (isHoliday) {
          status = "public_holiday";
        } else {
          if (isEmployeeWeeklyOff(date, emp, policies)) {
            status = "weekly_off";
          } else {
            const isPastDate = date < todayStr;
            const isToday = date === todayStr;
            let isPastWindow = isPastDate;

            if (isToday) {
              let startTimeStr = "09:00";
              const customShiftId = todayScheduleMap.get(emp.id);
              const targetShiftId = customShiftId !== undefined ? customShiftId : emp.shiftId;
              if (targetShiftId) {
                const sh = shifts.find(s => s.id === targetShiftId);
                if (sh?.startTime) {
                  startTimeStr = sh.startTime;
                }
              }
              const currentISTTimeStr = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
              isPastWindow = isLateByMoreThanTwoHours(startTimeStr, currentISTTimeStr);
            }

            if (isPastWindow) {
              status = "absent";
            } else {
              status = "pending";
            }
          }
        }
      }

      if (["present", "late", "overtime"].includes(status)) present++;
      if (status === "absent") absent++;
      if (["paid_leave", "sick_leave", "half_day"].includes(status)) leave++;
      if (status === "weekly_off") weeklyOff++;
    }

    result.push({
      date,
      present,
      absent,
      leave,
      weeklyOff,
    });
  }
  res.json(result);
});

router.get("/dashboard/payroll-trend", async (req, res): Promise<void> => {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7));
  }

  const totals = await db
    .select({
      month: payrollTable.month,
      total: sql<number>`coalesce(sum(net_salary), 0)`,
      count: sql<number>`count(*)`
    })
    .from(payrollTable)
    .where(inArray(payrollTable.month, months))
    .groupBy(payrollTable.month);

  const totalMap = new Map(totals.map(t => [t.month, t]));

  const result = months.map(month => {
    const total = totalMap.get(month);
    return {
      month,
      totalPayroll: Number(total?.total ?? 0),
      employeeCount: Number(total?.count ?? 0),
    };
  });

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
  res.json([]);
});

export default router;
