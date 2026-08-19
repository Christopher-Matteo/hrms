import { Router, type IRouter } from "express";
import { db, payrollTable, employeesTable, attendanceTable, advancesTable, continueDutiesTable, branchesTable, settingsTable, holidaysTable, documentsTable, weeklyOffPoliciesTable, shiftsTable, shiftScheduleTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { generatePayslipPdf, uploadFile } from "../lib/storage";
import { isDateWeeklyOff } from "../lib/weeklyOffHelper";

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

function getDaysInMonth(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m, 0).getDate();
}

async function syncDraftPayroll(
  record: typeof payrollTable.$inferSelect,
  preFetched?: {
    settings?: typeof settingsTable.$inferSelect;
    holidays?: (typeof holidaysTable.$inferSelect)[];
  }
) {
  if (record.status !== "draft") {
    return record;
  }

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, record.employeeId));
  if (!emp) return record;

  const shifts = await db.select().from(shiftsTable);
  const customSchedules = await db.select().from(shiftScheduleTable)
    .where(and(eq(shiftScheduleTable.employeeId, emp.id), sql`${shiftScheduleTable.date}::text like ${record.month + "%"}`));
  const customScheduleMap = new Map(customSchedules.map(s => [s.date, s.shiftId]));

  const settings = preFetched?.settings ?? (await db.select().from(settingsTable).limit(1))[0];
  const overtimeRate = settings ? Number(settings.overtimeRatePerHour) : 50;
  const lateDeductionPerMin = settings ? Number(settings.lateDeductionPerMinute) : 2;

  const attendanceRaw = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, emp.id), sql`${attendanceTable.date}::text like ${record.month + "%"}`));

  const attendance = attendanceRaw.map(a => {
    let status = a.status;
    let overtimeHours = a.overtimeHours;
    let lateMinutes = a.lateMinutes;

    const customShiftId = customScheduleMap.get(a.date);
    const targetShiftId = customShiftId !== undefined ? customShiftId : emp.shiftId;
    const shift = targetShiftId ? shifts.find(s => s.id === targetShiftId) : null;

    if (a.faceVerificationStatus === "Not Verified" || a.faceVerificationStatus === "Mismatched") {
      status = "absent";
      overtimeHours = null;
      lateMinutes = null;
    } else if (a.checkIn && shift && shift.startTime) {
      if (isLateByMoreThanTwoHours(shift.startTime, a.checkIn)) {
        status = "absent";
        overtimeHours = null;
        lateMinutes = null;
      }
    }

    return {
      ...a,
      status,
      overtimeHours,
      lateMinutes,
    };
  });

  // Load employee's weekly off policy
  let policy: any = null;
  if (emp.weeklyOffPolicyId) {
    [policy] = await db.select().from(weeklyOffPoliciesTable).where(eq(weeklyOffPoliciesTable.id, emp.weeklyOffPolicyId));
  }

  // Load holidays
  const holidays = preFetched?.holidays ?? (await db.select().from(holidaysTable));
  const employeeHolidays = holidays.filter(h => !h.branchId || h.branchId === emp.branchId);
  const holidayDates = new Set(employeeHolidays.map(h => h.date));

  // Determine statuses for every day of the month to handle missing attendance logs
  const totalDays = getDaysInMonth(record.month);
  
  const dayStatuses: { dateStr: string; status: string; dayName: string }[] = [];
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${record.month}-${String(day).padStart(2, "0")}`;
    const [year, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(year, m - 1, d);
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });

    const att = attendance.find(a => a.date === dateStr);
    
    let status = "absent";
    if (att) {
      status = att.status;
    } else if (holidayDates.has(dateStr)) {
      status = "public_holiday";
    } else if (isDateWeeklyOff(dateObj, policy)) {
      status = "weekly_off";
    }

    dayStatuses.push({ dateStr, status, dayName });
  }

  // Handle weekly off forfeiture if enabled
  const enableForfeiture = settings ? !!settings.enableWeeklyOffForfeiture : true;
  if (enableForfeiture) {
    const initialAbsentCount = dayStatuses.filter(d => d.status === "absent").length;
    if (initialAbsentCount > 4) {
      // Over 4 absences: forfeit ALL weekly offs
      for (const day of dayStatuses) {
        if (day.status === "weekly_off") {
          day.status = "absent";
        }
      }
    } else {
      // 4 or fewer absences: check week-by-week (Monday to Sunday)
      for (let i = 0; i < dayStatuses.length; i++) {
        const current = dayStatuses[i];
        if (current.status === "weekly_off") {
          const [year, m, d] = current.dateStr.split("-").map(Number);
          const targetDate = new Date(year, m - 1, d);
          
          let dayOfWeek = targetDate.getDay();
          if (dayOfWeek === 0) dayOfWeek = 7;
          
          const mondayOffset = dayOfWeek - 1;
          const mondayDate = new Date(targetDate);
          mondayDate.setDate(targetDate.getDate() - mondayOffset);

          const weekDatesStr: string[] = [];
          for (let offset = 0; offset < 7; offset++) {
            const checkDate = new Date(mondayDate);
            checkDate.setDate(mondayDate.getDate() + offset);
            
            const checkYear = checkDate.getFullYear();
            const checkMonth = String(checkDate.getMonth() + 1).padStart(2, "0");
            const checkDay = String(checkDate.getDate()).padStart(2, "0");
            weekDatesStr.push(`${checkYear}-${checkMonth}-${checkDay}`);
          }

          const hasAbsence = dayStatuses.some(day => 
            weekDatesStr.includes(day.dateStr) && day.status === "absent"
          );

          if (hasAbsence) {
            current.status = "absent";
          }
        }
      }
    }
  }

  // Count final statuses
  let presentDays = 0;
  let absentDaysCount = 0;
  let halfDayCount = 0;
  let weeklyOffDays = 0;
  let leaveDays = 0;
  let holidayDays = 0;

  for (const day of dayStatuses) {
    const status = day.status;
    if (["present", "late", "overtime", "continue_duty"].includes(status)) {
      presentDays++;
    } else if (status === "absent") {
      absentDaysCount++;
    } else if (status === "half_day") {
      halfDayCount++;
    } else if (status === "weekly_off") {
      weeklyOffDays++;
    } else if (status === "public_holiday") {
      holidayDays++;
    } else if (["paid_leave", "sick_leave"].includes(status)) {
      leaveDays++;
    }
  }

  const manualAttendanceCount = attendance.filter(a => a.source === "MANUAL").length;

  const basicSalary = Number(emp.salary);
  const calculationMethod = settings?.dailySalaryCalculationMethod ?? "calendar_days";
  const divisorDays = calculationMethod === "30_days" ? 30 : totalDays;
  const dailySalary = basicSalary / divisorDays;

  // Paid days: worked days, paid leaves, weekly offs, and public holidays
  const paidDays = presentDays + weeklyOffDays + holidayDays + leaveDays + 0.5 * halfDayCount;
  const unpaidDays = Math.max(0, totalDays - paidDays);

  const absentDeduction = Number((dailySalary * unpaidDays).toFixed(2));

  // Calculate extra weekly off pay (if they worked on their weekly off)
  const policyType = policy?.policyType ?? "one_day_per_week";
  const isHousekeeping = emp.department?.toLowerCase() === "housekeeping";
  let maxWeekoffs = 4;
  if (policyType === "one_week_per_month" || policyType === "one_day_per_month" || isHousekeeping) {
    maxWeekoffs = 1;
  }
  const unusedWeekoffs = Math.max(0, maxWeekoffs - weeklyOffDays);
  const extraWeeklyOffPay = Number((unusedWeekoffs * dailySalary).toFixed(2));

  const earnedSalary = Number((basicSalary - absentDeduction + extraWeeklyOffPay).toFixed(2));
  const payableDays = paidDays;

  const duties = await db.select().from(continueDutiesTable)
    .where(and(
      eq(continueDutiesTable.employeeId, emp.id),
      sql`${continueDutiesTable.date}::text like ${record.month + "%"}`
    ));
  const continueDutyDays = duties.length;
  const continueDutyAmount = Number(duties.reduce((sum, d) => sum + Number(d.amount), 0).toFixed(2));

  const overtimeHours = Number(attendance.reduce((sum, a) => sum + Number(a.overtimeHours ?? 0), 0).toFixed(2));
  const overtimeAmount = Number((overtimeHours * overtimeRate).toFixed(2));

  const totalLateMinutes = attendance.reduce((sum, a) => sum + Number(a.lateMinutes ?? 0), 0);
  const lateDeduction = Number((totalLateMinutes * lateDeductionPerMin).toFixed(2));

  const approvedAdvances = await db.select().from(advancesTable)
    .where(and(eq(advancesTable.employeeId, emp.id), eq(advancesTable.status, "approved")));
  const totalAdvanceBalance = approvedAdvances.reduce((sum, a) => sum + Number(a.remainingBalance), 0);

  const bonus = Number(record.bonus);
  const allowances = Number(record.allowances);
  const grossSalary = Number((earnedSalary + continueDutyAmount + overtimeAmount + bonus + allowances).toFixed(2));

  const maxDeductible = Math.max(0, grossSalary - lateDeduction);
  const advanceDeduction = Number(Math.min(maxDeductible, totalAdvanceBalance).toFixed(2));

  const totalDeductions = Number((advanceDeduction + lateDeduction + absentDeduction).toFixed(2));
  const netSalary = Number(Math.max(0, grossSalary - (advanceDeduction + lateDeduction)).toFixed(2));

  const hasChanged = 
    record.workingDays !== payableDays ||
    record.expectedWorkingDays !== totalDays ||
    record.presentDays !== presentDays ||
    record.absentDays !== absentDaysCount ||
    record.weeklyOffDays !== weeklyOffDays ||
    record.leaveDays !== (leaveDays + halfDayCount) ||
    record.manualAttendanceCount !== manualAttendanceCount ||
    record.continueDutyDays !== continueDutyDays ||
    Math.abs(Number(record.continueDutyAmount) - continueDutyAmount) > 0.01 ||
    Math.abs(Number(record.overtimeHours) - overtimeHours) > 0.01 ||
    Math.abs(Number(record.overtimeAmount) - overtimeAmount) > 0.01 ||
    Math.abs(Number(record.lateDeduction) - lateDeduction) > 0.01 ||
    Math.abs(Number(record.absentDeduction) - absentDeduction) > 0.01 ||
    Math.abs(Number(record.advanceDeduction) - advanceDeduction) > 0.01 ||
    Math.abs(Number(record.grossSalary) - grossSalary) > 0.01 ||
    Math.abs(Number(record.totalDeductions) - totalDeductions) > 0.01 ||
    Math.abs(Number(record.netSalary) - netSalary) > 0.01;

  if (hasChanged) {
    const [updated] = await db
      .update(payrollTable)
      .set({
        workingDays: payableDays,
        expectedWorkingDays: totalDays,
        presentDays,
        absentDays: absentDaysCount,
        weeklyOffDays,
        leaveDays: leaveDays + halfDayCount,
        manualAttendanceCount,
        continueDutyDays,
        continueDutyAmount: String(continueDutyAmount),
        overtimeHours: String(overtimeHours),
        overtimeAmount: String(overtimeAmount),
        lateDeduction: String(lateDeduction),
        absentDeduction: String(absentDeduction),
        advanceDeduction: String(advanceDeduction),
        grossSalary: String(grossSalary),
        totalDeductions: String(totalDeductions),
        netSalary: String(netSalary),
      })
      .where(eq(payrollTable.id, record.id))
      .returning();
    return updated;
  }

  return record;
}

async function formatPayroll(p: typeof payrollTable.$inferSelect) {
  // Sync if draft
  const record = p.status === "draft" ? await syncDraftPayroll(p) : p;

  const [emp] = await db
    .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName, employeeId: employeesTable.employeeId, department: employeesTable.department, branchId: employeesTable.branchId })
    .from(employeesTable)
    .where(eq(employeesTable.id, record.employeeId));

  let branchName: string | null = null;
  if (emp?.branchId) {
    const [branch] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, emp.branchId));
    branchName = branch?.name ?? null;
  }

  return {
    id: record.id,
    employeeId: record.employeeId,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
    employeeCode: emp?.employeeId ?? null,
    branchName,
    department: emp?.department ?? null,
    month: record.month,
    basicSalary: Number(record.basicSalary),
    workingDays: record.workingDays,
    expectedWorkingDays: record.expectedWorkingDays,
    presentDays: record.presentDays,
    absentDays: record.absentDays,
    weeklyOffDays: record.weeklyOffDays,
    leaveDays: record.leaveDays,
    continueDutyDays: record.continueDutyDays,
    continueDutyAmount: Number(record.continueDutyAmount),
    overtimeHours: Number(record.overtimeHours),
    overtimeAmount: Number(record.overtimeAmount),
    bonus: Number(record.bonus),
    allowances: Number(record.allowances),
    advanceDeduction: Number(record.advanceDeduction),
    absentDeduction: Number(record.absentDeduction),
    lateDeduction: Number(record.lateDeduction),
    grossSalary: Number(record.grossSalary),
    totalDeductions: Number(record.totalDeductions),
    netSalary: Number(record.netSalary),
    status: record.status,
    createdAt: record.createdAt.toISOString(),
  };
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

  // Get settings and holidays for optimization
  const [settings] = await db.select().from(settingsTable).limit(1);
  const holidays = await db.select().from(holidaysTable);

  // Get employees to generate payroll for
  const empConditions = [];
  if (branchId) empConditions.push(eq(employeesTable.branchId, Number(branchId)));
  if (employeeId) empConditions.push(eq(employeesTable.id, Number(employeeId)));
  empConditions.push(eq(employeesTable.status, "active"));

  let empQuery = db.select().from(employeesTable).$dynamic();
  if (empConditions.length > 0) empQuery = empQuery.where(and(...empConditions));
  const employees = await empQuery;

  const generated = [];

  for (const emp of employees) {
    // Check if payroll already exists
    const existing = await db.select().from(payrollTable)
      .where(and(eq(payrollTable.employeeId, emp.id), eq(payrollTable.month, month)));
    
    if (existing.length > 0) {
      if (existing[0].status === "draft") {
        // Delete the existing draft to regenerate
        await db.delete(payrollTable).where(eq(payrollTable.id, existing[0].id));
      } else {
        // If it's already approved or paid, skip regeneration to protect locked records
        generated.push(await formatPayroll(existing[0]));
        continue;
      }
    }

    const [payrollRecord] = await db.insert(payrollTable).values({
      employeeId: emp.id,
      month,
      basicSalary: String(emp.salary),
      status: "draft",
    }).returning();

    const synced = await syncDraftPayroll(payrollRecord, { settings, holidays });
    generated.push(await formatPayroll(synced));
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
  if (req.body.status !== undefined) updates.status = req.body.status;

  const [existing] = await db.select().from(payrollTable).where(eq(payrollTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Payroll record not found" });
    return;
  }

  const [updatedRecord] = await db
    .update(payrollTable)
    .set(updates)
    .where(eq(payrollTable.id, id))
    .returning();

  // Run syncDraftPayroll to calculate correct gross/net based on new values
  const synced = await syncDraftPayroll(updatedRecord);

  res.json(await formatPayroll(synced));
});

router.patch("/payroll/:id/approve", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(payrollTable).where(eq(payrollTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Payroll record not found" });
    return;
  }

  // Sync first if draft to capture all latest details
  await syncDraftPayroll(existing);

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

router.patch("/payroll/:id/pay", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [record] = await db.select().from(payrollTable).where(eq(payrollTable.id, id));
  if (!record) {
    res.status(404).json({ error: "Payroll record not found" });
    return;
  }

  if (record.status !== "approved") {
    res.status(400).json({ error: "Only approved payroll can be marked as paid" });
    return;
  }

  // Update payroll status to paid
  const [updatedRecord] = await db
    .update(payrollTable)
    .set({ status: "paid" })
    .where(eq(payrollTable.id, id))
    .returning();

  // Recover advance balance in db
  let amountToDeduct = Number(record.advanceDeduction);
  if (amountToDeduct > 0) {
    const approvedAdvances = await db
      .select()
      .from(advancesTable)
      .where(and(eq(advancesTable.employeeId, record.employeeId), eq(advancesTable.status, "approved")))
      .orderBy(advancesTable.createdAt);

    for (const adv of approvedAdvances) {
      const bal = Number(adv.remainingBalance);
      if (bal <= 0) continue;

      if (amountToDeduct >= bal) {
        amountToDeduct -= bal;
        await db
          .update(advancesTable)
          .set({ remainingBalance: "0", status: "recovered" })
          .where(eq(advancesTable.id, adv.id));
      } else {
        const newBal = bal - amountToDeduct;
        amountToDeduct = 0;
        await db
          .update(advancesTable)
          .set({ remainingBalance: String(newBal) })
          .where(eq(advancesTable.id, adv.id));
        break;
      }
    }
  }

  res.json(await formatPayroll(updatedRecord));
});

router.post("/payroll/:id/share", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  try {
    const [record] = await db.select().from(payrollTable).where(eq(payrollTable.id, id));
    if (!record) {
      res.status(404).json({ error: "Payroll record not found" });
      return;
    }

    const title = `Payslip - ${record.month}`;

    const [existingDoc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.employeeId, record.employeeId), eq(documentsTable.title, title)));

    if (existingDoc) {
      res.json({ success: true, message: "Payslip already shared", document: existingDoc });
      return;
    }

    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, record.employeeId));
    if (!emp) {
      res.status(404).json({ error: "Employee record not found" });
      return;
    }

    const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, emp.branchId));

    // 1. Generate payslip PDF
    const pdfBuffer = await generatePayslipPdf(record, emp, branch);

    // 2. Upload PDF to Storage (Supabase or Local)
    const storageKey = `payslips/${record.id}.pdf`;
    const uploadResult = await uploadFile(storageKey, pdfBuffer, "application/pdf");

    const [doc] = await db
      .insert(documentsTable)
      .values({
        employeeId: record.employeeId,
        title,
        category: "payslip",
        storageProvider: uploadResult.provider,
        storageKey: uploadResult.key,
        mimeType: "application/pdf",
        fileSize: pdfBuffer.length,
        uploadedAt: new Date()
      })
      .returning();

    res.json({ success: true, message: "Payslip shared successfully with employee", document: doc });
  } catch (error) {
    console.error("Error sharing payslip:", error);
    res.status(500).json({ error: "Failed to share payslip" });
  }
});

export default router;
