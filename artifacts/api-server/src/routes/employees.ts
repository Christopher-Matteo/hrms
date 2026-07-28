import { Router, type IRouter } from "express";
import { db, employeesTable, branchesTable, shiftsTable, weeklyOffPoliciesTable, faceEmbeddingsTable, emailVerificationsTable, usersTable } from "@workspace/db";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { sendMail } from "../lib/mailer";

const router: IRouter = Router();

async function formatEmployee(e: typeof employeesTable.$inferSelect) {
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

  return {
    id: e.id,
    employeeId: e.employeeId,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    phone: e.phone,
    gender: e.gender,
    dob: e.dob,
    address: e.address,
    emergencyContact: e.emergencyContact,
    department: e.department,
    designation: e.designation,
    branchId: e.branchId,
    branchName,
    shiftId: e.shiftId,
    shiftName,
    weeklyOffPolicyId: e.weeklyOffPolicyId,
    weeklyOffPolicyName,
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
  const { branchId, departmentId, status, search } = req.query;

  let query = db.select().from(employeesTable).$dynamic();

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

  const employees = await query.orderBy(employeesTable.createdAt);
  const result = await Promise.all(employees.map(formatEmployee));
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

  await sendMail(
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
  );

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
    firstName, lastName, email, phone, gender, dob, address, emergencyContact,
    department, designation, branchId, shiftId, weeklyOffPolicyId,
    joiningDate, employmentType, salary, bankName, accountNumber, ifscCode,
    upiId, panNumber, aadhaarNumber, photoUrl,
  } = req.body;

  if (!firstName || !lastName || !email || !phone || !department || !designation || !branchId || !joiningDate || !salary) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Require OTP verification in database within last 15 minutes
  const [verification] = await db
    .select()
    .from(emailVerificationsTable)
    .where(
      and(
        eq(emailVerificationsTable.email, email.trim().toLowerCase()),
        eq(emailVerificationsTable.verified, true),
        sql`created_at >= NOW() - INTERVAL '15 minutes'`
      )
    )
    .orderBy(desc(emailVerificationsTable.createdAt))
    .limit(1);

  if (!verification) {
    res.status(400).json({ error: "Email must be verified using OTP before saving." });
    return;
  }

  const empId = await generateEmployeeId();

  const [employee] = await db
    .insert(employeesTable)
    .values({
      employeeId: empId,
      firstName, lastName, email, phone,
      gender: gender ?? "male",
      dob: dob ?? null,
      address: address ?? null,
      emergencyContact: emergencyContact ?? null,
      department, designation,
      branchId: Number(branchId),
      shiftId: shiftId ? Number(shiftId) : null,
      weeklyOffPolicyId: weeklyOffPolicyId ? Number(weeklyOffPolicyId) : null,
      joiningDate,
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

  res.status(201).json(await formatEmployee(employee));
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(await formatEmployee(employee));
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
    "firstName", "lastName", "email", "phone", "gender", "dob", "address",
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

  const [employee] = await db
    .update(employeesTable)
    .set(updates)
    .where(eq(employeesTable.id, id))
    .returning();

  res.json(await formatEmployee(employee));
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

export default router;
