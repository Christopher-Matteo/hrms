import { Router, type IRouter, type NextFunction } from "express";
import {
  db,
  usersTable,
  employeesTable,
  attendanceTable,
  leavesTable,
  leaveApprovalHistoryTable,
  announcementsTable,
  announcementTargetsTable,
  announcementReadsTable,
  attendanceCorrectionsTable,
  attendanceCorrectionHistoryTable,
  documentsTable,
  supportTicketsTable,
  notificationDeliveryTable,
  notificationsTable,
  trustedDevicesTable,
  employeeBranchHistoryTable,
  branchOperatingHoursTable,
  attendanceRulesTable,
  shiftScheduleTable,
  shiftSwapRequestsTable,
  branchesTable,
  shiftsTable,
  payrollTable,
  holidaysTable
} from "@workspace/db";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import jwt from "jsonwebtoken";
import PDFDocument from "pdfkit";

const router: IRouter = Router();

const SIGNED_URL_SECRET = "red_fox_signed_url_secret_2026";

// Helper to calculate days between dates
function getDaysCount(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// ----------------------------------------------------
// 1. EMPLOYEES ENDPOINTS
// ----------------------------------------------------

// Get personal profile details
router.get("/employees/me", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee record" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, req.user.employeeId));

  if (!employee) {
    res.status(404).json({ error: "Employee record not found" });
    return;
  }

  const [branch] = await db
    .select({ name: branchesTable.name })
    .from(branchesTable)
    .where(eq(branchesTable.id, employee.branchId));

  res.json({
    ...employee,
    name: `${employee.firstName} ${employee.lastName}`,
    branchName: branch?.name ?? "Unknown Branch",
  });
});

// Update personal details (restricted fields)
router.patch("/employees/me", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const { phone, email, emergencyContact, address } = req.body;
  const updates: Record<string, any> = {};
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact;
  if (address !== undefined) updates.address = address;

  const [updated] = await db
    .update(employeesTable)
    .set(updates)
    .where(eq(employeesTable.id, req.user.employeeId))
    .returning();

  res.json(updated);
});

// Get branch transfer history
router.get("/employees/branch-history", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const history = await db
    .select({
      id: employeeBranchHistoryTable.id,
      branchId: employeeBranchHistoryTable.branchId,
      branchName: branchesTable.name,
      effectiveFrom: employeeBranchHistoryTable.effectiveFrom,
      effectiveTo: employeeBranchHistoryTable.effectiveTo,
      isCurrent: employeeBranchHistoryTable.isCurrent,
    })
    .from(employeeBranchHistoryTable)
    .innerJoin(branchesTable, eq(employeeBranchHistoryTable.branchId, branchesTable.id))
    .where(eq(employeeBranchHistoryTable.employeeId, req.user.employeeId))
    .orderBy(desc(employeeBranchHistoryTable.effectiveFrom));

  res.json(history);
});

// ----------------------------------------------------
// 2. ATTENDANCE ENDPOINTS
// ----------------------------------------------------

// List filtered attendance history (Weekly, Monthly, Yearly)
router.get("/attendance/history", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const { filter } = req.query; // 'weekly' | 'monthly' | 'yearly'
  let dateCondition = sql`1=1`;

  const today = new Date();
  if (filter === "weekly") {
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    dateCondition = sql`${attendanceTable.date} >= ${lastWeek.toISOString().split("T")[0]}`;
  } else if (filter === "monthly") {
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM
    dateCondition = sql`to_char(${attendanceTable.date}, 'YYYY-MM') = ${currentMonth}`;
  } else if (filter === "yearly") {
    const currentYear = today.getFullYear().toString(); // YYYY
    dateCondition = sql`to_char(${attendanceTable.date}, 'YYYY') = ${currentYear}`;
  }

  const history = await db
    .select({
      id: attendanceTable.id,
      date: attendanceTable.date,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      status: attendanceTable.status,
      workingHours: attendanceTable.workingHours,
      overtimeHours: attendanceTable.overtimeHours,
      verificationScore: attendanceTable.verificationScore,
      gpsVerified: attendanceTable.gpsVerified,
      faceVerified: attendanceTable.faceVerified,
      livenessVerified: attendanceTable.livenessVerified,
      source: attendanceTable.source,
      branchName: branchesTable.name,
    })
    .from(attendanceTable)
    .leftJoin(branchesTable, eq(attendanceTable.attendanceBranchId, branchesTable.id))
    .where(and(eq(attendanceTable.employeeId, req.user.employeeId), dateCondition))
    .orderBy(desc(attendanceTable.date));

  res.json(history);
});

// Request an attendance correction
router.post("/attendance/correction", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const { date, requestedCheckIn, requestedCheckOut, reason, attendanceId } = req.body;
  if (!date || !reason) {
    res.status(400).json({ error: "Date and reason are required" });
    return;
  }

  const [correction] = await db
    .insert(attendanceCorrectionsTable)
    .values({
      employeeId: req.user.employeeId,
      attendanceId: attendanceId ? Number(attendanceId) : null,
      date,
      requestedCheckIn,
      requestedCheckOut,
      reason,
      status: "pending",
    })
    .returning();

  // Create correction audit history log
  await db.insert(attendanceCorrectionHistoryTable).values({
    correctionId: correction.id,
    action: "requested",
    newValue: JSON.stringify({ requestedCheckIn, requestedCheckOut, reason }),
    performedBy: req.user.id,
  });

  res.status(201).json(correction);
});

// View correction history requests
router.get("/attendance/corrections", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const list = await db
    .select()
    .from(attendanceCorrectionsTable)
    .where(eq(attendanceCorrectionsTable.employeeId, req.user.employeeId))
    .orderBy(desc(attendanceCorrectionsTable.createdAt));

  res.json(list);
});

// ----------------------------------------------------
// 3. LEAVES ENDPOINTS
// ----------------------------------------------------

// Get leave balances
router.get("/leaves/balance", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  // Calculate used leaves from approved requests in database
  const approvedLeaves = await db
    .select({ days: leavesTable.days })
    .from(leavesTable)
    .where(and(eq(leavesTable.employeeId, req.user.employeeId), eq(leavesTable.status, "approved")));

  const totalUsed = approvedLeaves.reduce((sum, current) => sum + current.days, 0);

  res.json({
    totalEntitled: 15,
    casualRemaining: Math.max(0, 6 - totalUsed),
    sickRemaining: 5,
    earnedRemaining: 4,
    usedCount: totalUsed,
  });
});

// Request leaves
router.post("/leaves/apply", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const { leaveType, startDate, endDate, reason } = req.body;
  if (!leaveType || !startDate || !endDate || !reason) {
    res.status(400).json({ error: "Missing required leave fields" });
    return;
  }

  const days = getDaysCount(startDate, endDate);

  const [leave] = await db
    .insert(leavesTable)
    .values({
      employeeId: req.user.employeeId,
      leaveType,
      startDate,
      endDate,
      days,
      reason,
      status: "pending",
    })
    .returning();

  // Audit Log history
  await db.insert(leaveApprovalHistoryTable).values({
    leaveId: leave.id,
    action: "applied",
    remarks: reason,
    performedBy: req.user.id,
  });

  res.status(201).json(leave);
});

// List leaves history
router.get("/leaves/history", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const list = await db
    .select()
    .from(leavesTable)
    .where(eq(leavesTable.employeeId, req.user.employeeId))
    .orderBy(desc(leavesTable.createdAt));

  res.json(list);
});

// ----------------------------------------------------
// 4. ANNOUNCEMENTS ENDPOINTS
// ----------------------------------------------------

// List announcements (filtered by targeting and read status)
router.get("/announcements", requireAuth(), async (req: AuthenticatedRequest, res, next: NextFunction): Promise<void> => {
  if (!req.user?.employeeId) {
    next();
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, req.user.employeeId));

  if (!employee) {
    res.status(404).json({ error: "Employee record not found" });
    return;
  }

  // Find targeted announcements
  const targets = await db
    .select({ announcementId: announcementTargetsTable.announcementId })
    .from(announcementTargetsTable)
    .where(
      or(
        eq(announcementTargetsTable.targetType, "global"),
        and(eq(announcementTargetsTable.targetType, "branch"), eq(announcementTargetsTable.targetId, employee.branchId)),
        and(eq(announcementTargetsTable.targetType, "employee"), eq(announcementTargetsTable.targetId, employee.id))
      )
    );

  const targetedIds = Array.from(new Set(targets.map((t) => t.announcementId)));

  let list: any[] = [];
  if (targetedIds.length > 0) {
    const rawAnnouncements = await db
      .select()
      .from(announcementsTable)
      .where(sql`${announcementsTable.id} IN (${sql.join(targetedIds)})`)
      .orderBy(desc(announcementsTable.createdAt));

    // Map read status
    list = await Promise.all(
      rawAnnouncements.map(async (a) => {
        const [read] = await db
          .select()
          .from(announcementReadsTable)
          .where(and(eq(announcementReadsTable.userId, req.user!.id), eq(announcementReadsTable.announcementId, a.id)));
        return {
          ...a,
          isRead: !!read,
        };
      })
    );
  } else {
    // If no announcement targets exist, default to returning all global ones
    const rawAnnouncements = await db
      .select()
      .from(announcementsTable)
      .orderBy(desc(announcementsTable.createdAt));

    list = await Promise.all(
      rawAnnouncements.map(async (a) => {
        const [read] = await db
          .select()
          .from(announcementReadsTable)
          .where(and(eq(announcementReadsTable.userId, req.user!.id), eq(announcementReadsTable.announcementId, a.id)));
        return {
          ...a,
          isRead: !!read,
        };
      })
    );
  }

  res.json(list);
});

// Mark announcement as read
router.post("/announcements/:id/read", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const annId = parseInt(id as string, 10);
  if (Number.isNaN(annId)) {
    res.status(400).json({ error: "Invalid announcement ID" });
    return;
  }

  try {
    await db.insert(announcementReadsTable).values({
      userId: req.user!.id,
      announcementId: annId,
    });
  } catch (err) {
    // Unique constraint block ensures duplicate reads don't fail, ignore
  }

  res.json({ success: true });
});

// ----------------------------------------------------
// 5. SHIFTS ENDPOINTS
// ----------------------------------------------------

// Get schedule
router.get("/shifts/schedule", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const list = await db
    .select({
      id: shiftScheduleTable.id,
      date: shiftScheduleTable.date,
      shiftId: shiftScheduleTable.shiftId,
      name: shiftsTable.name,
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
    })
    .from(shiftScheduleTable)
    .innerJoin(shiftsTable, eq(shiftScheduleTable.shiftId, shiftsTable.id))
    .where(eq(shiftScheduleTable.employeeId, req.user.employeeId))
    .orderBy(shiftScheduleTable.date);

  res.json(list);
});

// Request shift swap
router.post("/shifts/swap", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const { targetEmployeeId, shiftScheduleId, reason } = req.body;
  if (!targetEmployeeId || !shiftScheduleId || !reason) {
    res.status(400).json({ error: "Missing shift swap details" });
    return;
  }

  const [request] = await db
    .insert(shiftSwapRequestsTable)
    .values({
      requesterEmployeeId: req.user.employeeId,
      targetEmployeeId: Number(targetEmployeeId),
      shiftScheduleId: Number(shiftScheduleId),
      reason,
      status: "pending",
    })
    .returning();

  res.status(201).json(request);
});

// ----------------------------------------------------
// 6. PAYROLL & DOCUMENTS (SIGNED URL LOGIC)
// ----------------------------------------------------

// List payroll records
router.get("/payroll/slips", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const list = await db
    .select()
    .from(payrollTable)
    .where(eq(payrollTable.employeeId, req.user.employeeId))
    .orderBy(desc(payrollTable.month));

  res.json(list);
});

// List documents
router.get("/documents", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const list = await db
    .select({
      id: documentsTable.id,
      title: documentsTable.title,
      category: documentsTable.category,
      mimeType: documentsTable.mimeType,
      fileSize: documentsTable.fileSize,
      uploadedAt: documentsTable.uploadedAt,
    })
    .from(documentsTable)
    .where(eq(documentsTable.employeeId, req.user.employeeId))
    .orderBy(desc(documentsTable.uploadedAt));

  res.json(list);
});

// Get signed download URL (expiring in 5 minutes)
router.get("/documents/:id/download", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const docId = parseInt(req.params.id as string, 10);
  if (Number.isNaN(docId)) {
    res.status(400).json({ error: "Invalid document ID" });
    return;
  }

  const [document] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, docId), eq(documentsTable.employeeId, req.user.employeeId)));

  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // Generate short-lived JWT token for file download (expiring in 1 hour with tolerance)
  const fileToken = jwt.sign(
    { storageKey: document.storageKey, title: document.title, mimeType: document.mimeType },
    SIGNED_URL_SECRET,
    { expiresIn: "1h" }
  );

  const downloadUrl = `/api/documents/download-file?token=${fileToken}`;

  res.json({ downloadUrl });
});

// Unsigned open download file handler
router.get("/documents/download-file", async (req, res): Promise<void> => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  try {
    const payload = jwt.verify(token, SIGNED_URL_SECRET, { clockTolerance: 300 }) as any;
    
    if (payload.storageKey && payload.storageKey.startsWith("payslips/")) {
      const keyParts = payload.storageKey.split("/");
      const fileIdStr = keyParts[1].replace(".pdf", "");
      const payrollId = parseInt(fileIdStr, 10);

      const [payroll] = await db
        .select()
        .from(payrollTable)
        .where(eq(payrollTable.id, payrollId));

      if (!payroll) {
        res.status(404).send("Payroll record not found.");
        return;
      }

      const [emp] = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, payroll.employeeId));

      if (!emp) {
        res.status(404).send("Employee record not found.");
        return;
      }

      const [branch] = await db
        .select()
        .from(branchesTable)
        .where(eq(branchesTable.id, emp.branchId));

      // Generate dynamic PDF
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${payload.title}"`);
      doc.pipe(res);

      // Header
      doc.fillColor("#b91c1c").font("Helvetica-Bold").fontSize(20).text("RED FOX HOTEL", { align: "center" });
      doc.fillColor("#4b5563").font("Helvetica").fontSize(10).text(branch?.address ?? "Corporate Office", { align: "center" });
      doc.moveDown(1);
      doc.fillColor("#1f2937").font("Helvetica-Bold").fontSize(14).text(`PAYSLIP FOR ${payroll.month}`, { align: "center", underline: true });
      doc.moveDown(1.5);

      // Employee details
      doc.fontSize(10).fillColor("#1f2937").font("Helvetica");
      const leftColX = 50;
      const rightColX = 300;
      let y = doc.y;

      doc.text(`Employee Code: ${emp.employeeId}`, leftColX, y);
      doc.text(`Department: ${emp.department}`, leftColX, y + 15);
      doc.text(`Designation: ${emp.designation}`, leftColX, y + 30);
      doc.text(`Joining Date: ${emp.joiningDate}`, leftColX, y + 45);

      doc.text(`Employee Name: ${emp.firstName} ${emp.lastName}`, rightColX, y);
      doc.text(`Phone: ${emp.phone}`, rightColX, y + 15);
      doc.text(`Email: ${emp.email}`, rightColX, y + 30);
      doc.text(`Branch: ${branch?.name ?? "N/A"}`, rightColX, y + 45);

      doc.moveDown(4.5);

      // Table headers
      y = doc.y;
      doc.rect(50, y, 500, 20).fill("#f3f4f6");
      doc.fillColor("#1f2937").font("Helvetica-Bold").text("Earnings", 60, y + 5);
      doc.text("Amount", 240, y + 5);
      doc.text("Deductions", 310, y + 5);
      doc.text("Amount", 490, y + 5);

      doc.font("Helvetica").fontSize(9);
      y += 25;

      const basicSalary = Number(emp.salary);
      const otAmt = Number(payroll.overtimeAmount);
      const cdAmt = Number(payroll.continueDutyAmount);
      const allow = Number(payroll.allowances);
      const bonus = Number(payroll.bonus);

      const absentDeduct = Number(payroll.absentDeduction);
      const lateDeduct = Number(payroll.lateDeduction);
      const advDeduct = Number(payroll.advanceDeduction);

      const earnings = [
        { name: "Basic Salary", amount: basicSalary },
        { name: "Overtime Amount", amount: otAmt },
        { name: "Continue Duty Amount", amount: cdAmt },
        { name: "Allowances", amount: allow },
        { name: "Bonus", amount: bonus }
      ];

      const deductions = [
        { name: "Absent Deduction", amount: absentDeduct },
        { name: "Late Deduction", amount: lateDeduct },
        { name: "Advance Deduction", amount: advDeduct }
      ];

      const rowsCount = Math.max(earnings.length, deductions.length);
      for (let i = 0; i < rowsCount; i++) {
        const earn = earnings[i];
        const deduct = deductions[i];
        if (earn) {
          doc.text(earn.name, 60, y);
          doc.text(`Rs. ${earn.amount.toFixed(2)}`, 240, y);
        }
        if (deduct) {
          doc.text(deduct.name, 310, y);
          doc.text(`Rs. ${deduct.amount.toFixed(2)}`, 490, y);
        }
        y += 15;
      }

      // Border and Totals
      doc.rect(50, y, 500, 1).fill("#e5e7eb");
      y += 10;
      doc.font("Helvetica-Bold");
      doc.text("Gross Salary:", 60, y);
      doc.text(`Rs. ${Number(payroll.grossSalary).toFixed(2)}`, 240, y);
      doc.text("Total Deductions:", 310, y);
      doc.text(`Rs. ${Number(payroll.totalDeductions).toFixed(2)}`, 490, y);

      y += 20;
      doc.rect(50, y, 500, 25).fill("#eff6ff");
      doc.fillColor("#1e3a8a").fontSize(11).text("Net Pay:", 60, y + 7);
      doc.text(`Rs. ${Number(payroll.netSalary).toFixed(2)}`, 240, y + 7);

      // Signatures
      y += 60;
      doc.fillColor("#4b5563").font("Helvetica").fontSize(9);
      doc.text("Employee Signature", 100, y, { align: "left" });
      doc.text("Authorized Signatory", 400, y, { align: "left" });

      doc.end();
      return;
    }

    // Default simulation for non-payslips
    res.setHeader("Content-Type", payload.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${payload.title}"`);
    res.send(`--- Mock Secure Document File Download Stream ---\nTitle: ${payload.title}\nStorage Key: ${payload.storageKey}`);
  } catch (err) {
    console.error(err);
    res.status(403).json({ error: "Signature verification failed or link expired." });
  }
});

// ----------------------------------------------------
// 7. SUPPORT TICKETS ENDPOINTS
// ----------------------------------------------------

// Create support ticket
router.post("/support/tickets", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const { category, title, description } = req.body;
  if (!category || !title || !description) {
    res.status(400).json({ error: "Category, title, and description required" });
    return;
  }

  const [ticket] = await db
    .insert(supportTicketsTable)
    .values({
      employeeId: req.user.employeeId,
      category,
      title,
      description,
      status: "open",
    })
    .returning();

  res.status(201).json(ticket);
});

// List employee's support tickets
router.get("/support/tickets", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const list = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.employeeId, req.user.employeeId))
    .orderBy(desc(supportTicketsTable.createdAt));

  res.json(list);
});

// ----------------------------------------------------
// 8. HOLIDAY CALENDAR
// ----------------------------------------------------

// Get global and branch specific holidays
router.get("/holidays", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user?.employeeId) {
    res.status(400).json({ error: "User is not linked to an employee" });
    return;
  }

  const [employee] = await db
    .select({ branchId: employeesTable.branchId })
    .from(employeesTable)
    .where(eq(employeesTable.id, req.user.employeeId));

  const branchId = employee?.branchId ?? 0;

  const list = await db
    .select()
    .from(holidaysTable)
    .where(or(sql`${holidaysTable.branchId} IS NULL`, eq(holidaysTable.branchId, branchId)))
    .orderBy(holidaysTable.date);

  res.json(list);
});

// ----------------------------------------------------
// 9. NOTIFICATIONS LIST
// ----------------------------------------------------
router.get("/notifications", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  const list = await db
    .select({
      id: notificationsTable.id,
      message: notificationsTable.message,
      type: notificationsTable.type,
      isRead: notificationsTable.isRead,
      createdAt: notificationsTable.createdAt,
    })
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.user!.id))
    .orderBy(desc(notificationsTable.createdAt));

  res.json(list);
});

router.post("/notifications/:id/read", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  const notId = parseInt(req.params.id as string, 10);
  if (Number.isNaN(notId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, notId), eq(notificationsTable.userId, req.user!.id)));

  res.json({ success: true });
});

router.get("/admin/support-tickets", async (req, res): Promise<void> => {
  try {
    const list = await db
      .select({
        id: supportTicketsTable.id,
        employeeId: supportTicketsTable.employeeId,
        category: supportTicketsTable.category,
        title: supportTicketsTable.title,
        description: supportTicketsTable.description,
        status: supportTicketsTable.status,
        createdAt: supportTicketsTable.createdAt,
        updatedAt: supportTicketsTable.updatedAt,
        employeeName: sql<string>`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`,
        employeeCode: employeesTable.employeeId
      })
      .from(supportTicketsTable)
      .innerJoin(employeesTable, eq(supportTicketsTable.employeeId, employeesTable.id))
      .orderBy(desc(supportTicketsTable.createdAt));

    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load support tickets" });
  }
});

router.patch("/admin/support-tickets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status } = req.body;

  if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  try {
    const [ticket] = await db
      .update(supportTicketsTable)
      .set({ status })
      .where(eq(supportTicketsTable.id, id))
      .returning();

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json({ success: true, ticket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update support ticket" });
  }
});

export default router;
