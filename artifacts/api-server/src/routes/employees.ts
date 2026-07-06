import { Router, type IRouter } from "express";
import { db, employeesTable, branchesTable, shiftsTable, weeklyOffPoliciesTable } from "@workspace/db";
import { eq, and, ilike, sql } from "drizzle-orm";

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

  const [employee] = await db
    .update(employeesTable)
    .set(updates)
    .where(eq(employeesTable.id, id))
    .returning();

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(await formatEmployee(employee));
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(employeesTable).where(eq(employeesTable.id, id));
  res.sendStatus(204);
});

export default router;
