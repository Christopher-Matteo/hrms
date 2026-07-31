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
import { downloadFile, generatePayslipPdf } from "../lib/storage";

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

  // Get employee name and create notification for Super Admin
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, req.user.employeeId));
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : "An employee";

  const admins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.role, "super_admin"), eq(usersTable.role, "hr_manager")));

  for (const admin of admins) {
    await db.insert(notificationsTable).values({
      userId: admin.id,
      type: "attendance_correction",
      message: `Attendance correction request from ${employeeName} is pending approval`,
      isRead: false,
    });
  }

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

  // Get employee name and create notification for Super Admin
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, req.user.employeeId));
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : "An employee";

  const admins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.role, "super_admin"), eq(usersTable.role, "hr_manager")));

  for (const admin of admins) {
    await db.insert(notificationsTable).values({
      userId: admin.id,
      type: "leave_approval",
      message: `Leave request from ${employeeName} is pending approval`,
      isRead: false,
    });
  }

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

  // Get employee name and create notification for Super Admin
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, req.user.employeeId));
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : "An employee";

  const admins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.role, "super_admin"), eq(usersTable.role, "hr_manager")));

  for (const admin of admins) {
    await db.insert(notificationsTable).values({
      userId: admin.id,
      type: "shift_swap",
      message: `Shift swap request from ${employeeName} is pending approval`,
      isRead: false,
    });
  }

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

  // Generate short-lived JWT token for file download (expiring in 5 minutes)
  const fileToken = jwt.sign(
    { documentId: document.id, employeeId: req.user.employeeId },
    SIGNED_URL_SECRET,
    { expiresIn: "5m" }
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
    
    if (!payload.documentId || !payload.employeeId) {
      res.status(400).json({ error: "Malformed download token" });
      return;
    }

    // Retrieve document metadata from database
    const [document] = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, payload.documentId));

    if (!document) {
      res.status(404).json({ error: "Document metadata not found." });
      return;
    }

    // Verify ownership
    if (document.employeeId !== payload.employeeId) {
      res.status(403).json({ error: "Access denied. You do not own this document." });
      return;
    }

    // Attempt to download pre-generated PDF from storage (Supabase or Local)
    try {
      const buffer = await downloadFile(document.storageKey, document.storageProvider);
      res.setHeader("Content-Type", document.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${document.title}.pdf"`);
      res.send(buffer);
      return;
    } catch (storageErr) {
      console.error("Storage download failed, attempting dynamic generation fallback:", storageErr);
    }

    // Fallback: Dynamically generate the PDF if file is missing in storage but document is a payslip
    if (document.category === "payslip" && document.storageKey.startsWith("payslips/")) {
      const keyParts = document.storageKey.split("/");
      const fileIdStr = keyParts[1].replace(".pdf", "");
      const payrollId = parseInt(fileIdStr, 10);

      const [payroll] = await db
        .select()
        .from(payrollTable)
        .where(eq(payrollTable.id, payrollId));

      if (!payroll) {
        res.status(404).send("Payroll record not found for dynamic generation.");
        return;
      }

      const [emp] = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, payroll.employeeId));

      if (!emp) {
        res.status(404).send("Employee record not found for dynamic generation.");
        return;
      }

      const [branch] = await db
        .select()
        .from(branchesTable)
        .where(eq(branchesTable.id, emp.branchId));

      // Dynamic Generation Fallback
      const pdfBuffer = await generatePayslipPdf(payroll, emp, branch);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${document.title}.pdf"`);
      res.send(pdfBuffer);
      return;
    }

    res.status(404).send("Document not found and cannot be dynamically generated.");
  } catch (err) {
    console.error("Download endpoint failed:", err);
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

  // Get employee name and create notification for Super Admin
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, req.user.employeeId));
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : "An employee";

  const admins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.role, "super_admin"), eq(usersTable.role, "hr_manager")));

  for (const admin of admins) {
    await db.insert(notificationsTable).values({
      userId: admin.id,
      type: "support_ticket",
      message: `New support ticket: '${title}' from ${employeeName}`,
      isRead: false,
    });
  }

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
