import { Router, type IRouter } from "express";
import { db, employeesTable, branchesTable, shiftsTable, weeklyOffPoliciesTable, faceEmbeddingsTable, emailVerificationsTable, usersTable, employeeBranchHistoryTable } from "@workspace/db";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { sendMail } from "../lib/mailer";
import * as crypto from "crypto";

const router: IRouter = Router();

function formatEmployee(
  e: typeof employeesTable.$inferSelect,
  branchName?: string | null,
  shiftName?: string | null,
  weeklyOffPolicyName?: string | null
) {
  return {
    id: e.id,
    employeeId: e.employeeId,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    phone: e.phone,
    gender: e.gender,
    address: e.address,
    emergencyContact: e.emergencyContact,
    department: e.department,
    designation: e.designation,
    branchId: e.branchId,
    branchName: branchName ?? null,
    shiftId: e.shiftId,
    shiftName: shiftName ?? null,
    weeklyOffPolicyId: e.weeklyOffPolicyId,
    weeklyOffPolicyName: weeklyOffPolicyName ?? null,
    joiningDate: e.joiningDate,
    employmentType: e.employmentType,
    status: e.status,
    salary: Number(e.salary),
    bankName: e.bankName,
    accountNumber: e.accountNumber,
    ifscCode: e.ifscCode,
    upiId: e.upiId,
    panNumber: e.panNumber,
    aadhaarNumber: e.aadhaarNumber,
    photoUrl: e.photoUrl,
    createdAt: e.createdAt.toISOString(),
  };
}

async function fetchAndFormatEmployee(e: typeof employeesTable.$inferSelect) {
  let branchName: string | null = null;
  if (e.branchId) {
    const [branch] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, e.branchId));
    branchName = branch?.name ?? null;
  }

  let shiftName: string | null = null;
  if (e.shiftId) {
    const [shift] = await db.select({ name: shiftsTable.name }).from(shiftsTable).where(eq(shiftsTable.id, e.shiftId));
    shiftName = shift?.name ?? null;
  }

  let weeklyOffPolicyName: string | null = null;
  if (e.weeklyOffPolicyId) {
    const [policy] = await db.select({ name: weeklyOffPoliciesTable.name }).from(weeklyOffPoliciesTable).where(eq(weeklyOffPoliciesTable.id, e.weeklyOffPolicyId));
    weeklyOffPolicyName = policy?.name ?? null;
  }

  return formatEmployee(e, branchName, shiftName, weeklyOffPolicyName);
}

async function generateEmployeeId(): Promise<string> {
  const rows = await db.select({ employeeId: employeesTable.employeeId }).from(employeesTable);
  let maxNum = 0;
  for (const row of rows) {
    const m = row.employeeId.match(/^EMP(\d+)$/i);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1]!, 10));
  }
  return `EMP${String(maxNum + 1).padStart(3, "0")}`;
}

router.get("/employees", async (req, res): Promise<void> => {
  const { branchId, status, search } = req.query;

  let query = db
    .select({
      employee: employeesTable,
      branchName: branchesTable.name,
      shiftName: shiftsTable.name,
      weeklyOffPolicyName: weeklyOffPoliciesTable.name,
    })
    .from(employeesTable)
    .leftJoin(branchesTable, eq(employeesTable.branchId, branchesTable.id))
    .leftJoin(shiftsTable, eq(employeesTable.shiftId, shiftsTable.id))
    .leftJoin(weeklyOffPoliciesTable, eq(employeesTable.weeklyOffPolicyId, weeklyOffPoliciesTable.id))
    .$dynamic();

  const conditions = [];
  if (branchId) conditions.push(eq(employeesTable.branchId, Number(branchId)));
  if (status) conditions.push(eq(employeesTable.status, String(status)));
  if (search) {
    const s = `%${search}%`;
    conditions.push(
      sql`(${employeesTable.firstName} ilike ${s} OR ${employeesTable.lastName} ilike ${s} OR ${employeesTable.email} ilike ${s} OR ${employeesTable.employeeId} ilike ${s} OR ${employeesTable.phone} ilike ${s})`
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rows = await query.orderBy(employeesTable.createdAt);
  const result = rows.map(r =>
    formatEmployee(r.employee, r.branchName, r.shiftName, r.weeklyOffPolicyName)
  );
  res.json(result);
});

const DISPOSABLE_DOMAINS = [
  "mailinator.com", "yopmail.com", "tempmail.com", "guerrillamail.com", 
  "10minutemail.com", "sharklasers.com", "getairmail.com", "dispostable.com", 
  "temp-mail.org", "trashmail.com", "maildrop.cc", "tempmailaddress.com"
];

function isDisposableEmail(email: string): boolean {
  const parts = email.split("@");
  if (parts.length !== 2) return true;
  const domain = parts[1]!.toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain);
}

// Verification OTP request route
router.post("/employees/verify-email/request", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  // Regex format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  // Disposable domain validation
  if (isDisposableEmail(email)) {
    res.status(400).json({ error: "Temporary / disposable email addresses are not allowed." });
    return;
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`[EMAIL VERIFICATION OTP] Code for ${email}: ${otpCode}`);

  await db.insert(emailVerificationsTable).values({
    email: email.trim().toLowerCase(),
    code: otpCode,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins expiry
  });

  sendMail(
    email.trim().toLowerCase(),
    "Email Verification OTP - Red Fox Hotel HRMS",
    `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
      <h2 style="color: #c91e43; margin-top: 0;">Email Verification OTP</h2>
      <p>Hello,</p>
      <p>Your 6-digit one-time password (OTP) to verify your registered email address on Red Fox Hotel HRMS is:</p>
      <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; padding: 15px; background: #f9f9f9; text-align: center; border-radius: 8px; color: #333; margin: 20px 0;">
        ${otpCode}
      </div>
      <p style="color: #777; font-size: 12px;">This OTP is valid for 15 minutes. Please do not share this code with anyone.</p>
    </div>`
  ).catch(err => {
    console.error("[MAILER ERROR] Background mailer failed for email verification:", err);
  });

  res.json({ success: true, message: "OTP sent successfully." });
});

// Verification OTP confirm route
router.post("/employees/verify-email/confirm", async (req, res): Promise<void> => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    res.status(400).json({ error: "Email and OTP are required" });
    return;
  }

  const [verification] = await db
    .select()
    .from(emailVerificationsTable)
    .where(
      and(
        eq(emailVerificationsTable.email, email.trim().toLowerCase()),
        eq(emailVerificationsTable.code, otp.trim()),
        sql`expires_at >= NOW()`
      )
    )
    .orderBy(desc(emailVerificationsTable.createdAt))
    .limit(1);

  if (!verification) {
    res.status(400).json({ error: "Invalid or expired OTP code." });
    return;
  }

  await db
    .update(emailVerificationsTable)
    .set({ verified: true })
    .where(eq(emailVerificationsTable.id, verification.id));

  res.json({ success: true, message: "Email verified successfully." });
});

router.post("/employees", async (req, res): Promise<void> => {
  const {
    firstName, lastName, name, email, phone, gender, address, emergencyContact,
    department, designation, branchId, shiftId, weeklyOffPolicyId,
    joiningDate, employmentType, salary, bankName, accountNumber, ifscCode,
    upiId, panNumber, aadhaarNumber, photoUrl, password,
  } = req.body;

  // Name splitting logic
  let finalFirstName = firstName ? firstName.trim() : "";
  let finalLastName = lastName ? lastName.trim() : "";
  if (name && !finalFirstName) {
    const parts = name.trim().split(/\s+/);
    finalFirstName = parts[0] || "";
    finalLastName = parts.slice(1).join(" ") || "";
  }

  // Employee ID generation / validation
  const empId = req.body.employeeId ? req.body.employeeId.trim().toUpperCase() : await generateEmployeeId();
  if (req.body.employeeId) {
    const [existingEmp] = await db.select().from(employeesTable).where(eq(employeesTable.employeeId, empId));
    if (existingEmp) {
      res.status(400).json({ error: `Employee ID ${empId} is already in use.` });
      return;
    }
  }

  // Email generation / validation
  const cleanEmail = email ? email.trim().toLowerCase() : `${empId.toLowerCase()}@redfoxhotel.com`;
  const [existingEmail] = await db.select().from(employeesTable).where(eq(employeesTable.email, cleanEmail));
  if (existingEmail) {
    res.status(400).json({ error: `Email ${cleanEmail} is already in use.` });
    return;
  }

  const missingFields: string[] = [];
  if (!finalFirstName) missingFields.push("First Name / Employee Name");
  if (!phone) missingFields.push("Phone");
  if (!department) missingFields.push("Department");
  if (!branchId) missingFields.push("Branch");
  if (salary === undefined || salary === null || salary === "") missingFields.push("Monthly Salary");

  if (missingFields.length > 0) {
    res.status(400).json({ error: `Missing required fields: ${missingFields.join(", ")}` });
    return;
  }

  const finalDesignation = designation ? designation.trim() : (department ? `${department.trim()} Staff` : "Staff");
  const finalJoiningDate = joiningDate || new Date().toISOString().split("T")[0]!;

  const [employee] = await db
    .insert(employeesTable)
    .values({
      employeeId: empId,
      firstName: finalFirstName,
      lastName: finalLastName,
      email: cleanEmail,
      phone,
      gender: gender ?? "male",
      address: address ?? null,
      emergencyContact: emergencyContact ?? null,
      department,
      designation: finalDesignation,
      branchId: Number(branchId),
      shiftId: shiftId ? Number(shiftId) : null,
      weeklyOffPolicyId: weeklyOffPolicyId ? Number(weeklyOffPolicyId) : null,
      joiningDate: finalJoiningDate,
      employmentType: employmentType ?? "full_time",
      status: "active",
      emailVerified: true,
      salary: String(salary),
      bankName: bankName ?? null,
      accountNumber: accountNumber ?? null,
      ifscCode: ifscCode ?? null,
      upiId: upiId ?? null,
      panNumber: panNumber ?? null,
      aadhaarNumber: aadhaarNumber ?? null,
      photoUrl: photoUrl ?? null,
    })
    .returning();

  // Insert initial branch history
  await db.insert(employeeBranchHistoryTable).values({
    employeeId: employee.id,
    branchId: employee.branchId,
    effectiveFrom: employee.joiningDate || new Date().toISOString().split("T")[0]!,
    isCurrent: true,
  });

  // Password auto-generation or manual
  const firstFour = finalFirstName.substring(0, 4).toUpperCase().padEnd(4, "X");
  const defaultPass = firstFour;
  const finalPassword = (password && password.trim().length >= 6) ? password.trim() : defaultPass;
  const passwordHash = crypto.createHash("sha256").update(finalPassword + "hrms_salt_2024").digest("hex");

  let role = "employee";
  if (employee.employeeId === "EMP001" || employee.department === "HR") role = "hr_manager";
  else if (employee.employeeId === "EMP003" || employee.designation.toLowerCase().includes("manager")) role = "branch_manager";

  await db.insert(usersTable).values({
    email: employee.email,
    passwordHash,
    name: `${finalFirstName} ${finalLastName}`.trim(),
    role,
    branchId: employee.branchId,
    employeeId: employee.id,
  });

  const formattedEmployee = await fetchAndFormatEmployee(employee);
  res.status(201).json({ ...formattedEmployee, generatedPassword: finalPassword });
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(await fetchAndFormatEmployee(employee));
});

router.patch("/employees/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  const fields = [
    "firstName", "lastName", "email", "phone", "gender", "address",
    "emergencyContact", "department", "designation", "branchId", "shiftId",
    "weeklyOffPolicyId", "joiningDate", "employmentType", "status", "salary",
    "bankName", "accountNumber", "ifscCode", "upiId", "panNumber", "aadhaarNumber", "photoUrl",
  ];
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.salary !== undefined) updates.salary = String(updates.salary);

  // If email is changing, update emailVerified status and sync credentials in usersTable
  if (updates.email !== undefined && String(updates.email).trim().toLowerCase() !== existing.email.toLowerCase()) {
    updates.emailVerified = true;
    updates.emailVerificationStatus = "Verified";

    // Update login credentials in usersTable to match the new email
    await db
      .update(usersTable)
      .set({ email: String(updates.email).trim().toLowerCase() })
      .where(eq(usersTable.employeeId, id));
  }

  if (updates.branchId !== undefined && Number(updates.branchId) !== existing.branchId) {
    const todayStr = new Date().toISOString().split("T")[0];
    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = yesterdayObj.toISOString().split("T")[0];

    // Close the old history entry
    await db
      .update(employeeBranchHistoryTable)
      .set({ isCurrent: false, effectiveTo: yesterdayStr })
      .where(and(eq(employeeBranchHistoryTable.employeeId, id), eq(employeeBranchHistoryTable.isCurrent, true)));

    // Insert new history entry
    await db.insert(employeeBranchHistoryTable).values({
      employeeId: id,
      branchId: Number(updates.branchId),
      effectiveFrom: todayStr,
      isCurrent: true,
    });

    // Sync branchId in usersTable for login permissions
    await db
      .update(usersTable)
      .set({ branchId: Number(updates.branchId) })
      .where(eq(usersTable.employeeId, id));
  }

  const [employee] = await db
    .update(employeesTable)
    .set(updates)
    .where(eq(employeesTable.id, id))
    .returning();

  res.json(await fetchAndFormatEmployee(employee));
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(employeesTable).where(eq(employeesTable.id, id));
  res.sendStatus(204);
});

router.get("/employees/:id/face-embedding", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [face] = await db.select().from(faceEmbeddingsTable).where(eq(faceEmbeddingsTable.employeeId, id));
  res.json({ registered: !!face });
});

router.post("/employees/:id/face-embedding", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { embedding } = req.body;

  if (!Array.isArray(embedding) || embedding.length !== 128) {
    res.status(400).json({ error: "Invalid face embedding. Must be a 128-dimensional array." });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!employee) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  const embeddingStr = JSON.stringify(embedding);

  // Check if existing
  const [existing] = await db.select().from(faceEmbeddingsTable).where(eq(faceEmbeddingsTable.employeeId, id));
  if (existing) {
    await db.update(faceEmbeddingsTable).set({ embedding: embeddingStr }).where(eq(faceEmbeddingsTable.id, existing.id));
  } else {
    await db.insert(faceEmbeddingsTable).values({ employeeId: id, embedding: embeddingStr });
  }

  res.json({ success: true });
});

router.post("/employees/:id/password", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { password } = req.body;

  if (!password || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters long." });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!employee) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.employeeId, employee.id));
  const passwordHash = crypto.createHash("sha256").update(password + "hrms_salt_2024").digest("hex");
  const name = `${employee.firstName} ${employee.lastName}`;

  if (existingUser) {
    await db
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, existingUser.id));
  } else {
    let role = "employee";
    if (employee.employeeId === "EMP001" || employee.department === "HR") role = "hr_manager";
    else if (employee.employeeId === "EMP003" || employee.designation.toLowerCase().includes("manager")) role = "branch_manager";

    await db.insert(usersTable).values({
      email: employee.email,
      passwordHash,
      name,
      role,
      branchId: employee.branchId,
      employeeId: employee.id,
    });
  }

  res.json({ success: true, message: "Password updated successfully." });
});

export default router;
