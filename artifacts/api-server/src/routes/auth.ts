import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  db,
  usersTable,
  employeesTable,
  auditLogsTable,
  passwordResetsTable,
  userRolesTable,
  rolesTable,
  rolePermissionsTable,
  permissionsTable,
  emailVerificationsTable
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import * as crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendMail } from "../lib/mailer";

const router: IRouter = Router();

const JWT_ACCESS_SECRET = "red_fox_access_secret_key_2026";
const JWT_REFRESH_SECRET = "red_fox_refresh_secret_key_2026";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "hrms_salt_2024").digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Helper to resolve user permissions by joining userRoles, rolePermissions, and permissions
export async function getUserPermissions(userId: number): Promise<string[]> {
  const userRoles = await db
    .select({ roleId: userRolesTable.roleId })
    .from(userRolesTable)
    .where(eq(userRolesTable.userId, userId));

  const roleIds = userRoles.map((ur) => ur.roleId);

  // Fallback: If no explicit user_roles found, use the role string from usersTable
  if (roleIds.length === 0) {
    const [user] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (user?.role) {
      const [roleObj] = await db
        .select()
        .from(rolesTable)
        .where(eq(rolesTable.name, user.role));
      if (roleObj) {
        roleIds.push(roleObj.id);
      }
    }
  }

  if (roleIds.length === 0) return [];

  const perms = await db
    .select({ name: permissionsTable.name })
    .from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(sql`${rolePermissionsTable.roleId} IN (${sql.join(roleIds)})`);

  return perms.map((p) => p.name);
}

// Authentication & Authorization Middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    employeeId?: number;
    name: string;
    role: string;
    branchId?: number;
    client: string;
  };
}

export function requireAuth(permissionName?: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any;
      req.user = decoded;

      // Check if employee account status is active
      if (decoded?.employeeId) {
        const [emp] = await db
          .select({ accountStatus: employeesTable.accountStatus })
          .from(employeesTable)
          .where(eq(employeesTable.id, decoded.employeeId));
        if (!emp || emp.accountStatus !== "active") {
          res.status(403).json({ error: "Your account is not active or blocked" });
          return;
        }
      }

      if (permissionName) {
        const permissions = await getUserPermissions(decoded.id);
        if (decoded.role !== "super_admin" && !permissions.includes(permissionName)) {
          res.status(403).json({ error: "Forbidden: Insufficient permissions" });
          return;
        }
      }

      next();
    } catch (err) {
      res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
  };
}

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

// 1. Check Auth Status of Employee ID
router.post("/auth/status", async (req, res): Promise<void> => {
  const { employeeCode } = req.body;
  if (!employeeCode || typeof employeeCode !== "string") {
    res.status(400).json({ error: "employeeCode is required" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(sql`LOWER(${employeesTable.employeeId}) = LOWER(${employeeCode.trim()})`);

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  // Check if user credentials exist and are active
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.employeeId, employee.id));

  res.json({
    registered: !!user && user.passwordHash !== "Password Not Set",
    employee: {
      id: employee.id,
      employeeId: employee.employeeId,
      name: `${employee.firstName} ${employee.lastName}`,
      photoUrl: employee.photoUrl,
      accountStatus: employee.accountStatus,
    },
  });
});

// 2. Register first-time employee credentials
router.post("/auth/register-employee", async (req, res): Promise<void> => {
  const { employeeCode, password, otp } = req.body;

  if (!employeeCode || !password || !otp) {
    res.status(400).json({ error: "Employee Code, password, and OTP are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters long." });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(sql`LOWER(${employeesTable.employeeId}) = LOWER(${employeeCode.trim()})`);

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  if (employee.accountStatus !== "active") {
    res.status(403).json({ error: "Cannot register an inactive or blocked employee." });
    return;
  }

  // Verify Email OTP
  const [verification] = await db
    .select()
    .from(emailVerificationsTable)
    .where(
      and(
        eq(emailVerificationsTable.email, employee.email),
        eq(emailVerificationsTable.code, otp.trim()),
        sql`expires_at >= NOW()`
      )
    )
    .orderBy(desc(emailVerificationsTable.createdAt))
    .limit(1);

  if (!verification) {
    res.status(400).json({ error: "Invalid or expired OTP code. Please request a new one." });
    return;
  }

  // Mark email as verified
  await db
    .update(employeesTable)
    .set({ emailVerified: true })
    .where(eq(employeesTable.id, employee.id));

  // Check if already has a user account (e.g. seeded with "Password Not Set")
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.employeeId, employee.id));

  const passwordHash = hashPassword(password);
  const name = `${employee.firstName} ${employee.lastName}`;
  let userId = 0;

  if (existingUser) {
    const [updatedUser] = await db
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, existingUser.id))
      .returning();
    userId = updatedUser.id;
  } else {
    // Insert into usersTable
    const [newUser] = await db
      .insert(usersTable)
      .values({
        email: employee.email,
        passwordHash,
        name,
        role: "employee",
        branchId: employee.branchId,
        employeeId: employee.id,
      })
      .returning();
    userId = newUser.id;

    // Create default Employee role association
    const [empRole] = await db
      .select()
      .from(rolesTable)
      .where(eq(rolesTable.name, "employee"));
    if (empRole) {
      await db.insert(userRolesTable).values({
        userId: newUser.id,
        roleId: empRole.id,
      });
    }
  }

  // Mark verification as verified/used
  await db
    .update(emailVerificationsTable)
    .set({ verified: true })
    .where(eq(emailVerificationsTable.id, verification.id));

  // Log audit
  await db.insert(auditLogsTable).values({
    userId: userId,
    userName: name,
    action: "Employee Account Registered",
    entity: "users",
    entityId: userId,
    changes: JSON.stringify({ employeeId: employee.id }),
  });

  res.json({ success: true, message: "Account registered successfully." });
});

// 3. Central Login
router.post("/auth/login", async (req, res): Promise<void> => {
  const { employeeCode, email, password, client } = req.body; // client: 'KIOSK' | 'EMPLOYEE_PORTAL'
  const isKiosk = client === "KIOSK";

  if ((!employeeCode && !email) || !password) {
    res.status(400).json({ error: "Identifier and password required" });
    return;
  }

  let user: any = null;
  let employee: any = null;

  if (email) {
    // Admin login flow via Email
    const [foundUser] = await db
      .select()
      .from(usersTable)
      .where(sql`LOWER(${usersTable.email}) = LOWER(${email.trim()})`);
    
    if (!foundUser) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    user = foundUser;

    if (user.employeeId) {
      const [foundEmp] = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, user.employeeId));
      employee = foundEmp;
    }
  } else if (employeeCode) {
    // Employee login flow via Employee Code
    const [foundEmp] = await db
      .select()
      .from(employeesTable)
      .where(sql`LOWER(${employeesTable.employeeId}) = LOWER(${employeeCode.trim()})`);

    if (!foundEmp) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    employee = foundEmp;

    const [foundUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.employeeId, employee.id));

    if (!foundUser) {
      res.status(401).json({ error: "Credentials not registered yet." });
      return;
    }
    user = foundUser;
  }

  // Check employee account status if employee record exists
  if (employee && employee.accountStatus !== "active") {
    res.status(403).json({ error: `Your account is currently ${employee.accountStatus}. Access denied.` });
    return;
  }

  // Verify password
  if (!verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Sign JWT
  const userPayload = {
    id: user.id,
    employeeId: employee?.id,
    name: user.name,
    role: user.role,
    branchId: employee?.branchId || user.branchId,
    client: client || "EMPLOYEE_PORTAL",
  };

  const accessToken = jwt.sign(userPayload, JWT_ACCESS_SECRET, {
    expiresIn: isKiosk ? "5m" : "15m",
  });

  let refreshToken: string | undefined = undefined;
  if (!isKiosk) {
    refreshToken = jwt.sign({ id: user.id, client: "EMPLOYEE_PORTAL" }, JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });
  }

  // Log audit
  await db.insert(auditLogsTable).values({
    userId: user.id,
    userName: user.name,
    action: "Login",
    entity: "users",
    entityId: user.id,
    changes: JSON.stringify({
      ipAddress: req.ip,
      device: req.headers["user-agent"] ? String(req.headers["user-agent"]) : null,
    }),
  });

  res.json({
    token: accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      employeeId: user.employeeId,
      createdAt: user.createdAt.toISOString(),
    },
    employee: employee ? {
      id: employee.id,
      employeeId: employee.employeeId,
      name: `${employee.firstName} ${employee.lastName}`,
      photoUrl: employee.photoUrl,
      branchId: employee.branchId,
    } : null,
  });
});

// 4. Refresh Token Flow
router.post("/auth/refresh", async (req, res): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: "Refresh token is required" });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.id));
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, user.employeeId ?? 0));

    if (employee && employee.accountStatus !== "active") {
      res.status(403).json({ error: "Account status is inactive or blocked" });
      return;
    }

    const userPayload = {
      id: user.id,
      employeeId: employee?.id,
      name: user.name,
      role: user.role,
      branchId: employee?.branchId,
      client: "EMPLOYEE_PORTAL",
    };

    const accessToken = jwt.sign(userPayload, JWT_ACCESS_SECRET, {
      expiresIn: "15m",
    });

    res.json({ token: accessToken });
  } catch (err) {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

// 5. Request Reset Password OTP
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(sql`LOWER(${employeesTable.email}) = LOWER(${email.trim()})`);

  if (!employee) {
    res.status(404).json({ error: "Email address not registered." });
    return;
  }

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`[PASSWD RESET OTP] Code for ${employee.email}: ${otpCode}`);

  await db.insert(passwordResetsTable).values({
    employeeId: employee.id,
    email: employee.email,
    code: otpCode,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // exactly 5 minutes expiry
    attemptCount: 0,
  });

  sendMail(
    employee.email.trim().toLowerCase(),
    "Password Reset OTP - Red Fox Hotel HRMS",
    `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
      <h2 style="color: #c91e43; margin-top: 0;">Password Reset Request</h2>
      <p>Hello,</p>
      <p>Your 6-digit one-time password (OTP) to reset your password on Red Fox Hotel HRMS is:</p>
      <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; padding: 15px; background: #f9f9f9; text-align: center; border-radius: 8px; color: #333; margin: 20px 0;">
        ${otpCode}
      </div>
      <p style="color: #777; font-size: 12px;">This OTP is valid for 5 minutes. If you did not request this, please ignore this email.</p>
    </div>`
  ).catch(err => {
    console.error("[MAILER ERROR] Background mailer failed for password reset:", err);
  });

  res.json({ success: true, message: "OTP sent successfully." });
});

// 6. Verify Reset OTP
router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    res.status(400).json({ error: "Email and OTP are required" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(sql`LOWER(${employeesTable.email}) = LOWER(${email.trim()})`);

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const [reset] = await db
    .select()
    .from(passwordResetsTable)
    .where(and(eq(passwordResetsTable.employeeId, employee.id), eq(passwordResetsTable.verified, false)))
    .orderBy(desc(passwordResetsTable.createdAt))
    .limit(1);

  if (!reset || new Date(reset.expiresAt) < new Date()) {
    res.status(400).json({ error: "Password reset request has expired or does not exist." });
    return;
  }

  if (reset.lockedUntil && new Date(reset.lockedUntil) > new Date()) {
    const diff = Math.ceil((new Date(reset.lockedUntil).getTime() - Date.now()) / (60 * 1000));
    res.status(403).json({ error: `Verification locked. Try again in ${diff} mins.` });
    return;
  }

  if (reset.code !== otp.trim()) {
    const newCount = reset.attemptCount + 1;
    const updates: any = { attemptCount: newCount };

    if (newCount >= 3) {
      updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
      await db.update(passwordResetsTable).set(updates).where(eq(passwordResetsTable.id, reset.id));
      res.status(403).json({ error: "Too many failed attempts. Verification locked for 15 minutes." });
      return;
    }

    await db.update(passwordResetsTable).set(updates).where(eq(passwordResetsTable.id, reset.id));
    res.status(400).json({ error: `Invalid OTP code. Remaining attempts: ${3 - newCount}` });
    return;
  }

  // Success
  await db
    .update(passwordResetsTable)
    .set({ verified: true })
    .where(eq(passwordResetsTable.id, reset.id));

  res.json({ success: true, message: "OTP verified. You may now reset your password." });
});

// 7. Reset Password
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters long." });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(sql`LOWER(${employeesTable.email}) = LOWER(${email.trim()})`);

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  // Find verified reset within 5 minutes
  const [reset] = await db
    .select()
    .from(passwordResetsTable)
    .where(
      and(
        eq(passwordResetsTable.employeeId, employee.id),
        eq(passwordResetsTable.verified, true),
        sql`${passwordResetsTable.createdAt} >= NOW() - INTERVAL '5 minutes'`
      )
    )
    .orderBy(desc(passwordResetsTable.createdAt))
    .limit(1);

  if (!reset) {
    res.status(400).json({ error: "OTP verification expired or not verified." });
    return;
  }

  // Hash & update
  const newHash = hashPassword(password);
  const [user] = await db
    .update(usersTable)
    .set({ passwordHash: newHash })
    .where(eq(usersTable.employeeId, employee.id))
    .returning();

  // Consume reset request
  await db
    .update(passwordResetsTable)
    .set({ verified: false })
    .where(eq(passwordResetsTable.id, reset.id));

  // Audit
  if (user) {
    await db.insert(auditLogsTable).values({
      userId: user.id,
      userName: user.name,
      action: "Password Reset",
      entity: "users",
      entityId: user.id,
      changes: JSON.stringify({ ipAddress: req.ip }),
    });
  }

  res.json({ success: true, message: "Password updated successfully." });
});

// 8. Logout
router.post("/auth/logout", async (req, res): Promise<void> => {
  // Stateless JWT: client just drops token. Optionally blacklist if required.
  res.json({ ok: true });
});

// 9. Get current session details (for HRMS Admin panel loads)
router.get("/auth/me", requireAuth(), async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
    employeeId: user.employeeId,
    createdAt: user.createdAt.toISOString(),
  });
});

async function seedRbac() {
  try {
    const existingRoles = await db.select().from(rolesTable).limit(1);
    if (existingRoles.length > 0) return;

    console.log("Seeding RBAC roles and permissions...");
    const roles = [
      { name: "super_admin", description: "Full system administration" },
      { name: "hr", description: "HR management" },
      { name: "manager", description: "General manager" },
      { name: "branch_manager", description: "Branch specific manager" },
      { name: "payroll", description: "Payroll accountant" },
      { name: "employee", description: "General staff employee" },
      { name: "reception", description: "Reception and front desk" },
      { name: "it_support", description: "IT support team" },
    ];
    
    const insertedRoles = await db.insert(rolesTable).values(roles).returning();
    const roleMap = new Map(insertedRoles.map((r) => [r.name, r.id]));

    const permissions = [
      { module: "Employee", action: "Read", name: "employee.read" },
      { module: "Employee", action: "Create", name: "employee.create" },
      { module: "Employee", action: "Edit", name: "employee.edit" },
      { module: "Employee", action: "Delete", name: "employee.delete" },
      { module: "Leave", action: "Apply", name: "leave.apply" },
      { module: "Leave", action: "Approve", name: "leave.approve" },
      { module: "Leave", action: "View", name: "leave.view" },
      { module: "Attendance", action: "Mark", name: "attendance.mark" },
      { module: "Attendance", action: "View", name: "attendance.view" },
      { module: "Attendance", action: "Correct", name: "attendance.correct" },
      { module: "Announcement", action: "Create", name: "announcement.create" },
      { module: "Announcement", action: "View", name: "announcement.view" },
      { module: "Salary", action: "View", name: "salary.view" },
      { module: "Salary", action: "Download", name: "salary.download" },
      { module: "Support", action: "Create", name: "support.create" },
      { module: "Support", action: "Resolve", name: "support.resolve" },
    ];

    const insertedPerms = await db.insert(permissionsTable).values(permissions).returning();
    
    const superAdminId = roleMap.get("super_admin");
    const hrId = roleMap.get("hr");
    const branchManagerId = roleMap.get("branch_manager");
    const employeeId = roleMap.get("employee");

    const rolePermValues: any[] = [];

    for (const p of insertedPerms) {
      if (superAdminId) rolePermValues.push({ roleId: superAdminId, permissionId: p.id });
      if (hrId) rolePermValues.push({ roleId: hrId, permissionId: p.id });

      if (branchManagerId) {
        if (["employee.read", "leave.approve", "leave.view", "attendance.view", "announcement.view", "support.resolve"].includes(p.name)) {
          rolePermValues.push({ roleId: branchManagerId, permissionId: p.id });
        }
      }

      if (employeeId) {
        if (["leave.apply", "leave.view", "attendance.mark", "attendance.view", "attendance.correct", "announcement.view", "salary.view", "salary.download", "support.create"].includes(p.name)) {
          rolePermValues.push({ roleId: employeeId, permissionId: p.id });
        }
      }
    }

    if (rolePermValues.length > 0) {
      await db.insert(rolePermissionsTable).values(rolePermValues);
    }
    console.log("RBAC seeding complete!");
  } catch (err) {
    console.error("Failed to seed RBAC roles/permissions:", err);
  }
}

seedRbac();

export default router;
