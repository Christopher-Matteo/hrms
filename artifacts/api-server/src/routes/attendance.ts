import { Router, type IRouter } from "express";
import { db, attendanceTable, employeesTable, auditLogsTable, attendanceCorrectionsTable, attendanceCorrectionHistoryTable, branchesTable, shiftsTable, holidaysTable, weeklyOffPoliciesTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";

const router: IRouter = Router();

function formatTo12HourStr(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.endsWith("PM");
  const isAM = clean.endsWith("AM");
  let timePart = clean.replace(/(AM|PM)/g, "").trim();
  if (!timePart.includes(":")) {
    timePart = `${timePart}:00`;
  }
  const parts = timePart.split(":");
  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10) || 0;
  if (isNaN(hours)) return timeStr;
  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }
  const suffix = hours >= 12 ? "PM" : "AM";
  let displayHours = hours % 12;
  if (displayHours === 0) displayHours = 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  return `${displayHours}:${displayMinutes} ${suffix}`;
}

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

function getEmployeeOffDays(emp: any, policies: any[]): string[] {
  if (emp.weeklyOffPolicyId) {
    const policy = policies.find(p => p.id === emp.weeklyOffPolicyId);
    if (policy?.offDays) {
      try {
        return JSON.parse(policy.offDays);
      } catch (e) {
        // fallback
      }
    }
  }
  return ["Sunday"];
}

function formatRecord(
  r: typeof attendanceTable.$inferSelect,
  employeeName?: string | null,
  employeeCode?: string | null,
  homeBranchName?: string | null,
  attendanceBranchName?: string | null
) {
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
    checkInPhoto: r.checkInPhoto,
    checkOutPhoto: r.checkOutPhoto,
    photoVerified: r.photoVerified,
    faceVerificationStatus: r.faceVerificationStatus,
    source: r.source,
    homeBranchId: r.homeBranchId,
    attendanceBranchId: r.attendanceBranchId,
    homeBranchName: homeBranchName ?? null,
    attendanceBranchName: attendanceBranchName ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/attendance", async (req, res): Promise<void> => {
  const { employeeId, branchId, date, month, status } = req.query;

  const conditions = [];
  if (employeeId) conditions.push(eq(attendanceTable.employeeId, Number(employeeId)));
  if (date) conditions.push(eq(attendanceTable.date, String(date)));
  if (month) {
    conditions.push(sql`${attendanceTable.date}::text like ${String(month) + "%"}`);
  }
  // Only apply database-level status filtering if we aren't querying by date, 
  // as date queries require us to load all records to compute virtual absences.
  if (status && !date) conditions.push(eq(attendanceTable.status, String(status)));

  let query = db.select().from(attendanceTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  const records = await query.orderBy(attendanceTable.date);

  // Enrich with employee names and branch names
  const result = await Promise.all(
    records.map(async (r) => {
      const [emp] = await db
        .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName, employeeId: employeesTable.employeeId })
        .from(employeesTable)
        .where(eq(employeesTable.id, r.employeeId));

      let homeBranchName = null;
      if (r.homeBranchId) {
        const [hb] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, r.homeBranchId));
        homeBranchName = hb?.name ?? null;
      }

      let attendanceBranchName = null;
      if (r.attendanceBranchId) {
        const [ab] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, r.attendanceBranchId));
        attendanceBranchName = ab?.name ?? null;
      }

      return formatRecord(
        r,
        emp ? `${emp.firstName} ${emp.lastName}` : null,
        emp?.employeeId ?? null,
        homeBranchName,
        attendanceBranchName
      );
    })
  );

  let finalResult = result;

  if (date) {
    // Fetch active employees matching optional branch or employee filters
    const empConditions = [
      eq(employeesTable.status, "active"),
      eq(employeesTable.accountStatus, "active")
    ];
    if (employeeId) empConditions.push(eq(employeesTable.id, Number(employeeId)));
    if (branchId) empConditions.push(eq(employeesTable.branchId, Number(branchId)));

    const activeEmployees = await db
      .select()
      .from(employeesTable)
      .where(and(...empConditions));

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const isPastDate = String(date) < todayStr;
    const isToday = String(date) === todayStr;

    if (isPastDate || isToday) {
      const holidays = await db.select().from(holidaysTable);
      const policies = await db.select().from(weeklyOffPoliciesTable);
      const existingEmployeeIds = new Set(records.map(r => r.employeeId));
      const virtualRecords: any[] = [];

      for (const emp of activeEmployees) {
        if (!existingEmployeeIds.has(emp.id)) {
          const [yearNum, mNum, dayNum] = String(date).split("-").map(Number);
          const dateObj = new Date(yearNum, mNum - 1, dayNum);
          const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });

          const isHoliday = holidays.some(h => h.date === String(date) && (!h.branchId || h.branchId === emp.branchId));
          const offDays = getEmployeeOffDays(emp, policies);
          const isWeeklyOff = offDays.includes(dayName);

          let finalStatus = "absent";
          let remarksText = "System: Absent due to missing check-in past 2-hour window";
          let shouldInclude = false;

          if (isHoliday) {
            finalStatus = "public_holiday";
            remarksText = "Public Holiday";
            shouldInclude = true;
          } else if (isWeeklyOff) {
            finalStatus = "weekly_off";
            remarksText = "Weekly Off";
            shouldInclude = true;
          } else {
            let isPastWindow = isPastDate;
            if (isToday) {
              let startTimeStr = "09:00"; // default fallback
              if (emp.shiftId) {
                const [sh] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, emp.shiftId));
                if (sh?.startTime) {
                  startTimeStr = sh.startTime;
                }
              }
              const currentISTTimeStr = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
              isPastWindow = isLateByMoreThanTwoHours(startTimeStr, currentISTTimeStr);
            }
            if (isPastWindow) {
              finalStatus = "absent";
              remarksText = "System: Absent due to missing check-in past 2-hour window";
              shouldInclude = true;
            }
          }

          if (shouldInclude) {
            let homeBranchName = null;
            if (emp.branchId) {
              const [hb] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, emp.branchId));
              homeBranchName = hb?.name ?? null;
            }

            virtualRecords.push({
              id: -emp.id, // virtual ID
              employeeId: emp.id,
              employeeName: `${emp.firstName} ${emp.lastName}`,
              employeeCode: emp.employeeId,
              date: String(date),
              status: finalStatus,
              checkIn: null,
              checkOut: null,
              workingHours: null,
              breakTime: null,
              lateMinutes: null,
              overtimeHours: null,
              remarks: remarksText,
              checkInPhoto: null,
              checkOutPhoto: null,
              photoVerified: false,
              faceVerificationStatus: "Not Verified",
              source: "SYSTEM",
              homeBranchId: emp.branchId,
              attendanceBranchId: null,
              homeBranchName,
              attendanceBranchName: null,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      finalResult = [...result, ...virtualRecords];
    }
  }

  // Apply memory status filter if filtering by status on a date-specific query
  if (status && date) {
    finalResult = finalResult.filter(r => r.status === String(status));
  }

  res.json(finalResult);
});

router.post("/attendance", async (req, res): Promise<void> => {
  const { employeeId, date, status, checkIn, checkOut, workingHours, breakTime, lateMinutes, overtimeHours, remarks, source, adminName, adminId } = req.body;
  if (!employeeId || !date || !status) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Check if attendance already exists for this employee and date
  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.employeeId, Number(employeeId)),
        eq(attendanceTable.date, date)
      )
    );

  let record;
  const sourceValue = source || "MANUAL";

  if (existing) {
    [record] = await db
      .update(attendanceTable)
      .set({
        status,
        checkIn: formatTo12HourStr(checkIn),
        checkOut: formatTo12HourStr(checkOut),
        workingHours: workingHours != null ? String(workingHours) : null,
        breakTime: breakTime != null ? String(breakTime) : null,
        lateMinutes: lateMinutes ?? null,
        overtimeHours: overtimeHours != null ? String(overtimeHours) : null,
        remarks: remarks ?? null,
        source: sourceValue,
        gpsVerified: true,
        faceVerified: true,
        livenessVerified: true,
      })
      .where(eq(attendanceTable.id, existing.id))
      .returning();
  } else {
    [record] = await db
      .insert(attendanceTable)
      .values({
        employeeId: Number(employeeId),
        date,
        status,
        checkIn: formatTo12HourStr(checkIn),
        checkOut: formatTo12HourStr(checkOut),
        workingHours: workingHours != null ? String(workingHours) : null,
        breakTime: breakTime != null ? String(breakTime) : null,
        lateMinutes: lateMinutes ?? null,
        overtimeHours: overtimeHours != null ? String(overtimeHours) : null,
        remarks: remarks ?? null,
        source: sourceValue,
        gpsVerified: true,
        faceVerified: true,
        livenessVerified: true,
      })
      .returning();
  }

  // Audit logging for manual updates
  if (sourceValue === "MANUAL") {
    await db.insert(auditLogsTable).values({
      userId: adminId ? Number(adminId) : null,
      userName: adminName || "Admin/HR",
      action: existing ? "updated" : "created",
      entity: "attendance",
      entityId: record.id,
      changes: JSON.stringify({
        date,
        status,
        reason: remarks,
        addedBy: adminName || "Admin/HR",
      }),
    });
  }

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
        sql`${attendanceTable.date}::text like ${String(month) + "%"}`
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
  if (req.body.checkIn !== undefined) updates.checkIn = formatTo12HourStr(req.body.checkIn);
  if (req.body.checkOut !== undefined) updates.checkOut = formatTo12HourStr(req.body.checkOut);
  if (req.body.workingHours !== undefined) updates.workingHours = req.body.workingHours != null ? String(req.body.workingHours) : null;
  if (req.body.breakTime !== undefined) updates.breakTime = req.body.breakTime != null ? String(req.body.breakTime) : null;
  if (req.body.lateMinutes !== undefined) updates.lateMinutes = req.body.lateMinutes;
  if (req.body.overtimeHours !== undefined) updates.overtimeHours = req.body.overtimeHours != null ? String(req.body.overtimeHours) : null;
  if (req.body.remarks !== undefined) updates.remarks = req.body.remarks;
  if (req.body.faceVerificationStatus !== undefined) updates.faceVerificationStatus = req.body.faceVerificationStatus;
  if (req.body.photoVerified !== undefined) updates.photoVerified = req.body.photoVerified;

  const [record] = await db
    .update(attendanceTable)
    .set(updates)
    .where(eq(attendanceTable.id, id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  let homeBranchName = null;
  if (record.homeBranchId) {
    const [hb] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, record.homeBranchId));
    homeBranchName = hb?.name ?? null;
  }

  let attendanceBranchName = null;
  if (record.attendanceBranchId) {
    const [ab] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, record.attendanceBranchId));
    attendanceBranchName = ab?.name ?? null;
  }

  res.json(formatRecord(record, null, null, homeBranchName, attendanceBranchName));
});

router.delete("/attendance/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(attendanceTable).where(eq(attendanceTable.id, id));
  res.sendStatus(204);
});

router.post("/attendance/:id/verify-photos", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { faceVerificationStatus } = req.body;

  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }

  const targetStatus = faceVerificationStatus || "Verified";
  const isVerified = targetStatus === "Verified" || targetStatus === "Matched";

  const updatedRemarks = existing.remarks
    ? `${existing.remarks} [Face verification: ${targetStatus}]`
    : `[Face verification: ${targetStatus}]`;

  const updates: any = {
    faceVerificationStatus: targetStatus === "Matched" ? "Verified" : targetStatus,
    photoVerified: isVerified,
    remarks: updatedRemarks,
  };

  if (isVerified) {
    updates.faceVerificationStatus = "Verified";
    updates.checkInPhoto = null;
    updates.checkOutPhoto = null;
  } else if (targetStatus === "Mismatched") {
    updates.status = "absent";
    updates.checkIn = null;
    updates.checkOut = null;
    updates.workingHours = null;
    updates.breakTime = null;
    updates.lateMinutes = null;
    updates.overtimeHours = null;
    updates.checkInPhoto = null;
    updates.checkOutPhoto = null;
    updates.photoVerified = false;
  }

  const [record] = await db
    .update(attendanceTable)
    .set(updates)
    .where(eq(attendanceTable.id, id))
    .returning();

  let homeBranchName = null;
  if (record.homeBranchId) {
    const [hb] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, record.homeBranchId));
    homeBranchName = hb?.name ?? null;
  }

  let attendanceBranchName = null;
  if (record.attendanceBranchId) {
    const [ab] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, record.attendanceBranchId));
    attendanceBranchName = ab?.name ?? null;
  }

  res.json({ success: true, record: formatRecord(record, null, null, homeBranchName, attendanceBranchName) });
});

router.get("/attendance-corrections", async (req, res): Promise<void> => {
  try {
    const list = await db
      .select({
        id: attendanceCorrectionsTable.id,
        employeeId: attendanceCorrectionsTable.employeeId,
        attendanceId: attendanceCorrectionsTable.attendanceId,
        date: attendanceCorrectionsTable.date,
        requestedCheckIn: attendanceCorrectionsTable.requestedCheckIn,
        requestedCheckOut: attendanceCorrectionsTable.requestedCheckOut,
        reason: attendanceCorrectionsTable.reason,
        status: attendanceCorrectionsTable.status,
        createdAt: attendanceCorrectionsTable.createdAt,
        employeeName: sql<string>`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`,
        employeeCode: employeesTable.employeeId
      })
      .from(attendanceCorrectionsTable)
      .innerJoin(employeesTable, eq(attendanceCorrectionsTable.employeeId, employeesTable.id))
      .orderBy(sql`${attendanceCorrectionsTable.createdAt} desc`);
    
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load corrections list" });
  }
});

router.patch("/attendance-corrections/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, remarks } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  try {
    const [correction] = await db
      .select()
      .from(attendanceCorrectionsTable)
      .where(eq(attendanceCorrectionsTable.id, id));

    if (!correction) {
      res.status(404).json({ error: "Correction request not found" });
      return;
    }

    if (correction.status !== "pending") {
      res.status(400).json({ error: "Request is already processed" });
      return;
    }

    if (status === "approved") {
      const checkIn = formatTo12HourStr(correction.requestedCheckIn);
      const checkOut = formatTo12HourStr(correction.requestedCheckOut);

      const [existingAttendance] = await db
        .select()
        .from(attendanceTable)
        .where(and(eq(attendanceTable.employeeId, correction.employeeId), eq(attendanceTable.date, correction.date)));

      if (existingAttendance) {
        await db
          .update(attendanceTable)
          .set({
            checkIn,
            checkOut,
            status: "present",
            source: "MANUAL",
            remarks: remarks || correction.reason
          })
          .where(eq(attendanceTable.id, existingAttendance.id));
      } else {
        await db.insert(attendanceTable).values({
          employeeId: correction.employeeId,
          date: correction.date,
          checkIn,
          checkOut,
          status: "present",
          source: "MANUAL",
          remarks: remarks || correction.reason,
          gpsVerified: false,
          faceVerified: false,
          livenessVerified: false
        });
      }
    }

    const [updatedCorrection] = await db
      .update(attendanceCorrectionsTable)
      .set({ status })
      .where(eq(attendanceCorrectionsTable.id, id))
      .returning();

    await db.insert(attendanceCorrectionHistoryTable).values({
      correctionId: id,
      action: status === "approved" ? "hr_approved" : "rejected",
      newValue: JSON.stringify({ status, remarks }),
    });

    await db.insert(auditLogsTable).values({
      action: status === "approved" ? "approve_correction" : "reject_correction",
      entity: "attendance",
      entityId: correction.employeeId,
      changes: JSON.stringify({ correctionId: id, date: correction.date, status, remarks }),
      userName: "HR/Admin"
    });

    res.json({ success: true, correction: updatedCorrection });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process correction request" });
  }
});

export default router;
