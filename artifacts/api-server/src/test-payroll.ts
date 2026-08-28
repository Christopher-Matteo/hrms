import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
function loadEnv() {
  const envPath = path.resolve(__dirname, "../../../.env");
  if (!fs.existsSync(envPath)) {
    console.error(".env not found at", envPath);
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, "utf-8");
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

loadEnv();

// Dynamically import dependencies after env has been loaded
const { db, employeesTable, branchesTable, weeklyOffPoliciesTable, attendanceTable, payrollTable, settingsTable } = await import("@workspace/db");
const { eq, and } = await import("drizzle-orm");
const { syncDraftPayroll } = await import("./routes/payroll.js");

async function runTests() {
  console.log("=== STARTING PAYROLL AUDIT TEST MATRIX ===");

  // 1. Fetch or create a branch
  let branchId: number;
  const [existingBranch] = await db.select().from(branchesTable).limit(1);
  let tempBranch: any = null;
  if (existingBranch) {
    branchId = existingBranch.id;
    console.log(`Using existing branch ID: ${branchId}`);
  } else {
    [tempBranch] = await db.insert(branchesTable).values({
      name: "TEMP_TEST_BRANCH",
      address: "123 Test St",
      phone: "1234567890",
      email: "temp@test.com",
    }).returning();
    branchId = tempBranch.id;
    console.log(`Created temporary branch ID: ${branchId}`);
  }

  // 2. Create a temporary weekly off policy: Sunday off
  const [policy] = await db.insert(weeklyOffPoliciesTable).values({
    name: "TEMP_TEST_SUNDAY_OFF",
    policyType: "one_day_per_week",
    offDays: JSON.stringify(["Sunday"]),
  }).returning();

  // 3. Create a temporary employee
  const [employee] = await db.insert(employeesTable).values({
    employeeId: "TEMP_TEST_EMP",
    firstName: "Audit",
    lastName: "Tester",
    email: "audit_tester@redfoxhotel.com",
    phone: "1234567890",
    department: "Testing",
    designation: "Auditor",
    branchId: branchId,
    weeklyOffPolicyId: policy.id,
    salary: "15000.00",
    joiningDate: "2026-09-01",
    status: "active",
  }).returning();

  // Ensure daily salary calculation method is set to calendar_days
  let [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(settingsTable).values({
      companyName: "Red Fox Hotel",
      dailySalaryCalculationMethod: "calendar_days",
      enableWeeklyOffForfeiture: true,
    }).returning();
  } else {
    await db.update(settingsTable).set({
      dailySalaryCalculationMethod: "calendar_days",
      enableWeeklyOffForfeiture: true,
    }).where(eq(settingsTable.id, settings.id));
  }

  const month = "2026-09"; // 30-day month. Sundays are Sep 6, 13, 20, 27 (4 Sundays).
  // Helper to clear attendance for test employee
  async function clearAttendance() {
    await db.delete(attendanceTable).where(eq(attendanceTable.employeeId, employee.id));
  }

  // Helper to run syncDraftPayroll and assert gross
  async function runPayrollAndAssert(expectedGross: number, testName: string) {
    // Delete existing payroll draft if any
    await db.delete(payrollTable).where(and(eq(payrollTable.employeeId, employee.id), eq(payrollTable.month, month)));
    
    // Create draft payroll record
    const [payrollRecord] = await db.insert(payrollTable).values({
      employeeId: employee.id,
      month,
      basicSalary: "15000.00",
      status: "draft",
    }).returning();

    // Sync
    const synced = await syncDraftPayroll(payrollRecord);
    
    const gross = Number(synced.grossSalary);
    console.log(`[TEST] ${testName} -> Expected Gross: ₹${expectedGross}, Calculated: ₹${gross}`);
    if (Math.abs(gross - expectedGross) > 0.01) {
      throw new Error(`[FAIL] ${testName} failed! Expected ${expectedGross}, got ${gross}`);
    } else {
      console.log(`[PASS] ${testName} passed.`);
    }
  }

  try {
    // === SCENARIO 1 ===
    // 26 present, 4 weekoff (rested), 0 absent, 0 leave -> ₹15,000, no bonus.
    await clearAttendance();
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-09-${String(day).padStart(2, "0")}`;
      const isSunday = [6, 13, 20, 27].includes(day);
      if (!isSunday) {
        await db.insert(attendanceTable).values({
          employeeId: employee.id,
          date: dateStr,
          status: "present",
        });
      }
    }
    await runPayrollAndAssert(15000, "Scenario 1 (26 present, 4 rested)");

    // === SCENARIO 2 ===
    // 27 present, 3 weekoff (rested), 1 worked-weekoff, 0 absent -> ₹15,500.
    await clearAttendance();
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-09-${String(day).padStart(2, "0")}`;
      const isSunday = [6, 13, 20, 27].includes(day);
      if (!isSunday || day === 6) { // Work on Sunday Sep 6
        await db.insert(attendanceTable).values({
          employeeId: employee.id,
          date: dateStr,
          status: "present",
        });
      }
    }
    await runPayrollAndAssert(15500, "Scenario 2 (27 present, 3 rested, 1 worked weekoff)");

    // === SCENARIO 3 ===
    // 28 present, 2 weekoff (rested), 2 worked-weekoff, 0 absent -> ₹16,000.
    await clearAttendance();
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-09-${String(day).padStart(2, "0")}`;
      const isSunday = [6, 13, 20, 27].includes(day);
      if (!isSunday || day === 6 || day === 13) {
        await db.insert(attendanceTable).values({
          employeeId: employee.id,
          date: dateStr,
          status: "present",
        });
      }
    }
    await runPayrollAndAssert(16000, "Scenario 3 (28 present, 2 rested, 2 worked weekoff)");

    // === SCENARIO 4 ===
    // 29 present, 1 weekoff (rested), 3 worked-weekoff, 0 absent -> ₹16,500.
    await clearAttendance();
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-09-${String(day).padStart(2, "0")}`;
      const isSunday = [6, 13, 20, 27].includes(day);
      if (!isSunday || day === 6 || day === 13 || day === 20) {
        await db.insert(attendanceTable).values({
          employeeId: employee.id,
          date: dateStr,
          status: "present",
        });
      }
    }
    await runPayrollAndAssert(16500, "Scenario 4 (29 present, 1 rested, 3 worked weekoff)");

    // === SCENARIO 5 ===
    // 30 present, 0 weekoff (rested), 4 worked-weekoff, 0 absent -> ₹17,000.
    await clearAttendance();
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-09-${String(day).padStart(2, "0")}`;
      const isSunday = [6, 13, 20, 27].includes(day);
      if (!isSunday || isSunday) {
        await db.insert(attendanceTable).values({
          employeeId: employee.id,
          date: dateStr,
          status: "present",
        });
      }
    }
    await runPayrollAndAssert(17000, "Scenario 5 (30 present, 0 rested, 4 worked weekoff)");

    // === SCENARIO 6 ===
    // 4 weekoff (rested), 0 worked-weekoff, but 5 absent days elsewhere in the month.
    // Total absent = 5. Triggers >4 forfeiture.
    // All 4 weekoffs forfeited. Total unpaid = 9.
    // Expected gross: ₹15,000 - 9 * ₹500 = ₹10,500.
    await clearAttendance();
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-09-${String(day).padStart(2, "0")}`;
      const isSunday = [6, 13, 20, 27].includes(day);
      const isAbsentDay = [1, 2, 3, 4, 5].includes(day);
      if (!isSunday) {
        await db.insert(attendanceTable).values({
          employeeId: employee.id,
          date: dateStr,
          status: isAbsentDay ? "absent" : "present",
        });
      }
    }
    await runPayrollAndAssert(10500, "Scenario 6 (4 rested weekoff, 5 absences -> all forfeited, ₹10,500)");

    // === SCENARIO 7 ===
    // 4 weekoff (rested), 2 approved paid-leave days elsewhere, 0 absent -> ₹15,000.
    await clearAttendance();
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-09-${String(day).padStart(2, "0")}`;
      const isSunday = [6, 13, 20, 27].includes(day);
      const isLeaveDay = [1, 2].includes(day);
      if (!isSunday) {
        await db.insert(attendanceTable).values({
          employeeId: employee.id,
          date: dateStr,
          status: isLeaveDay ? "paid_leave" : "present",
        });
      }
    }
    await runPayrollAndAssert(15000, "Scenario 7 (4 rested, 2 paid leave, 24 present -> ₹15,000)");

    // === SCENARIO 8 ===
    // 4 weekoff (rested), 1 absence, 25 present.
    // 1 absence is "not problem" (no forfeiture).
    // Paid days = 25 present + 4 weekoff = 29. Unpaid = 1.
    // Expected gross = ₹15,000 - 1 * ₹500 = ₹14,500.
    await clearAttendance();
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-09-${String(day).padStart(2, "0")}`;
      const isSunday = [6, 13, 20, 27].includes(day);
      const isAbsentDay = day === 1;
      if (!isSunday) {
        await db.insert(attendanceTable).values({
          employeeId: employee.id,
          date: dateStr,
          status: isAbsentDay ? "absent" : "present",
        });
      }
    }
    await runPayrollAndAssert(14500, "Scenario 8 (4 rested, 1 absence -> no forfeiture, ₹14,500)");

    // === SCENARIO 9 ===
    // 4 weekoff (rested), 2 consecutive absences (consecutive unpaid leave), 24 present.
    // 2 consecutive absences triggers forfeiture. All 4 weekoffs forfeited.
    // Unpaid days = 2 absences + 4 weekoffs forfeited = 6.
    // Expected gross = ₹15,000 - 6 * ₹500 = ₹12,000.
    await clearAttendance();
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-09-${String(day).padStart(2, "0")}`;
      const isSunday = [6, 13, 20, 27].includes(day);
      const isAbsentDay = day === 1 || day === 2; // Consecutive absences
      if (!isSunday) {
        await db.insert(attendanceTable).values({
          employeeId: employee.id,
          date: dateStr,
          status: isAbsentDay ? "absent" : "present",
        });
      }
    }
    await runPayrollAndAssert(12000, "Scenario 9 (4 rested, 2 consecutive absences -> forfeited all, ₹12,000)");

    console.log("=== ALL TEST MATRIX SCENARIOS COMPLETED SUCCESSFULLY ===");
  } finally {
    // Cleanup temporary resources
    console.log("Cleaning up temporary test database records...");
    await clearAttendance();
    await db.delete(payrollTable).where(eq(payrollTable.employeeId, employee.id));
    await db.delete(employeesTable).where(eq(employeesTable.id, employee.id));
    await db.delete(weeklyOffPoliciesTable).where(eq(weeklyOffPoliciesTable.id, policy.id));
    if (tempBranch) {
      await db.delete(branchesTable).where(eq(branchesTable.id, tempBranch.id));
    }
    console.log("Cleanup completed.");
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
