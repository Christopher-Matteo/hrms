import { db, usersTable, branchesTable, departmentsTable, shiftsTable, weeklyOffPoliciesTable, employeesTable, attendanceTable, leavesTable, advancesTable, announcementsTable, notificationsTable, holidaysTable, settingsTable, auditLogsTable } from "@workspace/db";
import * as crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "hrms_salt_2024").digest("hex");
}

async function seed() {
  console.log("Seeding database...");

  // Settings
  const existingSettings = await db.select().from(settingsTable).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(settingsTable).values({
      companyName: "Red Fox Hotel",
      companyEmail: "hr@redfoxhotel.com",
      companyPhone: "+91 98765 43210",
      companyAddress: "Red Fox Hotel Group, Mumbai, India",
      overtimeRatePerHour: "75",
      continueDutyRate: "600",
      lateDeductionPerMinute: "3",
      gracePeriodMinutes: 10,
      workingHoursPerDay: "8",
    });
  }

  // Branches
  const existingBranches = await db.select().from(branchesTable).limit(1);
  if (existingBranches.length === 0) {
    await db.insert(branchesTable).values([
      { name: "Mumbai Central", address: "123 Marine Drive, Mumbai", phone: "+91 22 1234 5678", email: "mumbai@redfoxhotel.com" },
      { name: "Delhi Airport", address: "Terminal 2, IGI Airport, Delhi", phone: "+91 11 9876 5432", email: "delhi@redfoxhotel.com" },
      { name: "Bangalore City", address: "MG Road, Bangalore", phone: "+91 80 2345 6789", email: "bangalore@redfoxhotel.com" },
    ]);
  }

  // Departments
  const existingDepts = await db.select().from(departmentsTable).limit(1);
  if (existingDepts.length === 0) {
    await db.insert(departmentsTable).values([
      { name: "Front Office" },
      { name: "Housekeeping" },
      { name: "Food & Beverage" },
      { name: "Kitchen" },
      { name: "Security" },
      { name: "Maintenance" },
      { name: "HR" },
      { name: "Finance" },
      { name: "IT" },
      { name: "Sales & Marketing" },
    ]);
  }

  // Shifts
  const existingShifts = await db.select().from(shiftsTable).limit(1);
  if (existingShifts.length === 0) {
    await db.insert(shiftsTable).values([
      { name: "Morning Shift", startTime: "06:00", endTime: "14:00", gracePeriodMinutes: 10 },
      { name: "Evening Shift", startTime: "14:00", endTime: "22:00", gracePeriodMinutes: 10 },
      { name: "Night Shift", startTime: "22:00", endTime: "06:00", gracePeriodMinutes: 15 },
      { name: "General Shift", startTime: "09:00", endTime: "18:00", gracePeriodMinutes: 15 },
    ]);
  }

  // Weekly Off Policies
  const existingPolicies = await db.select().from(weeklyOffPoliciesTable).limit(1);
  if (existingPolicies.length === 0) {
    await db.insert(weeklyOffPoliciesTable).values([
      { name: "Sunday Off", policyType: "one_day_per_week", offDays: '["Sunday"]' },
      { name: "Saturday & Sunday Off", policyType: "two_days_per_week", offDays: '["Saturday","Sunday"]' },
      { name: "Rotational Off", policyType: "rotational", offDays: null },
    ]);
  }

  // Super Admin User
  const existingAdmin = await db.select().from(usersTable).limit(1);
  if (existingAdmin.length === 0) {
    await db.insert(usersTable).values({
      email: "admin@redfoxhotel.com",
      passwordHash: hashPassword("admin123"),
      name: "Super Admin",
      role: "super_admin",
    });
  }

  // Employees
  const existingEmps = await db.select().from(employeesTable).limit(1);
  if (existingEmps.length === 0) {
    const branches = await db.select().from(branchesTable);
    const mumbai = branches.find(b => b.name.includes("Mumbai"))!;
    const delhi = branches.find(b => b.name.includes("Delhi"))!;
    const bangalore = branches.find(b => b.name.includes("Bangalore"))!;
    const shifts = await db.select().from(shiftsTable);
    const generalShift = shifts.find(s => s.name === "General Shift")!;
    const morningShift = shifts.find(s => s.name === "Morning Shift")!;
    const policies = await db.select().from(weeklyOffPoliciesTable);
    const sundayOff = policies.find(p => p.name === "Sunday Off")!;

    const employees = [
      { employeeId: "EMP001", firstName: "Rahul", lastName: "Sharma", email: "rahul.sharma@redfoxhotel.com", phone: "9876543210", gender: "male", dob: "1985-06-15", address: "Mumbai, Maharashtra", department: "HR", designation: "HR Manager", branchId: mumbai.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2020-01-15", employmentType: "full_time", status: "active", salary: "65000" },
      { employeeId: "EMP002", firstName: "Priya", lastName: "Patel", email: "priya.patel@redfoxhotel.com", phone: "9876543211", gender: "female", dob: "1990-03-22", address: "Mumbai, Maharashtra", department: "Front Office", designation: "Front Desk Executive", branchId: mumbai.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2021-03-10", employmentType: "full_time", status: "active", salary: "32000" },
      { employeeId: "EMP003", firstName: "Amit", lastName: "Kumar", email: "amit.kumar@redfoxhotel.com", phone: "9876543212", gender: "male", dob: "1988-11-08", address: "Delhi, India", department: "Food & Beverage", designation: "F&B Manager", branchId: delhi.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2019-07-20", employmentType: "full_time", status: "active", salary: "55000" },
      { employeeId: "EMP004", firstName: "Sunita", lastName: "Reddy", email: "sunita.reddy@redfoxhotel.com", phone: "9876543213", gender: "female", dob: "1992-08-14", address: "Bangalore, Karnataka", department: "Housekeeping", designation: "Housekeeper", branchId: bangalore.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2022-01-05", employmentType: "full_time", status: "active", salary: "28000" },
      { employeeId: "EMP005", firstName: "Vikas", lastName: "Singh", email: "vikas.singh@redfoxhotel.com", phone: "9876543214", gender: "male", dob: "1987-04-30", address: "Mumbai, Maharashtra", department: "Security", designation: "Security Supervisor", branchId: mumbai.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2020-09-15", employmentType: "full_time", status: "active", salary: "35000" },
      { employeeId: "EMP006", firstName: "Neha", lastName: "Gupta", email: "neha.gupta@redfoxhotel.com", phone: "9876543215", gender: "female", dob: "1993-12-20", address: "Delhi, India", department: "Finance", designation: "Accounts Executive", branchId: delhi.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2021-06-01", employmentType: "full_time", status: "active", salary: "38000" },
      { employeeId: "EMP007", firstName: "Rajesh", lastName: "Nair", email: "rajesh.nair@redfoxhotel.com", phone: "9876543216", gender: "male", dob: "1983-09-05", address: "Bangalore, Karnataka", department: "Maintenance", designation: "Maintenance Manager", branchId: bangalore.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2018-11-12", employmentType: "full_time", status: "active", salary: "42000" },
      { employeeId: "EMP008", firstName: "Meena", lastName: "Joshi", email: "meena.joshi@redfoxhotel.com", phone: "9876543217", gender: "female", dob: "1995-02-28", address: "Mumbai, Maharashtra", department: "Kitchen", designation: "Sous Chef", branchId: mumbai.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2022-08-20", employmentType: "full_time", status: "active", salary: "45000" },
      { employeeId: "EMP009", firstName: "Arjun", lastName: "Mehta", email: "arjun.mehta@redfoxhotel.com", phone: "9876543218", gender: "male", dob: "1991-07-11", address: "Delhi, India", department: "IT", designation: "IT Executive", branchId: delhi.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2021-02-15", employmentType: "full_time", status: "active", salary: "48000" },
      { employeeId: "EMP010", firstName: "Pooja", lastName: "Verma", email: "pooja.verma@redfoxhotel.com", phone: "9876543219", gender: "female", dob: "1994-05-17", address: "Bangalore, Karnataka", department: "Sales & Marketing", designation: "Marketing Executive", branchId: bangalore.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2023-03-01", employmentType: "full_time", status: "active", salary: "40000" },
    ];

    await db.insert(employeesTable).values(employees);

    // Create user accounts for HR manager and branch managers
    const insertedEmps = await db.select().from(employeesTable).limit(10);
    const rahul = insertedEmps.find(e => e.employeeId === "EMP001");
    const amit = insertedEmps.find(e => e.employeeId === "EMP003");

    if (rahul) {
      await db.insert(usersTable).values({
        email: "hr@redfoxhotel.com",
        passwordHash: hashPassword("hr123"),
        name: "Rahul Sharma",
        role: "hr_manager",
        branchId: rahul.branchId,
        employeeId: rahul.id,
      }).onConflictDoNothing();
    }

    if (amit) {
      await db.insert(usersTable).values({
        email: "manager@redfoxhotel.com",
        passwordHash: hashPassword("manager123"),
        name: "Amit Kumar",
        role: "branch_manager",
        branchId: amit.branchId,
        employeeId: amit.id,
      }).onConflictDoNothing();
    }
  }

  // Attendance for last 7 days
  const existingAttendance = await db.select().from(attendanceTable).limit(1);
  if (existingAttendance.length === 0) {
    const employees = await db.select().from(employeesTable);
    const statuses = ["present", "present", "present", "present", "late", "absent", "weekly_off"];
    
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const date = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const dayOfWeek = new Date(date).getDay(); // 0 = Sunday

      for (const emp of employees) {
        const status = dayOfWeek === 0 ? "weekly_off" : statuses[Math.floor(Math.random() * 5)];
        await db.insert(attendanceTable).values({
          employeeId: emp.id,
          date,
          status,
          checkIn: status === "present" ? "09:05" : status === "late" ? "09:35" : null,
          checkOut: ["present", "late"].includes(status) ? "18:10" : null,
          workingHours: ["present", "late"].includes(status) ? "8" : null,
          lateMinutes: status === "late" ? 25 : null,
          overtimeHours: null,
          remarks: null,
        });
      }
    }
  }

  // Leave requests
  const existingLeaves = await db.select().from(leavesTable).limit(1);
  if (existingLeaves.length === 0) {
    const employees = await db.select().from(employeesTable).limit(5);
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    if (employees[0]) {
      await db.insert(leavesTable).values([
        { employeeId: employees[0].id, leaveType: "casual", startDate: today, endDate: today, days: 1, status: "pending", reason: "Personal work", managerComment: null, approvedById: null },
        { employeeId: employees[1]?.id ?? employees[0].id, leaveType: "sick", startDate: tomorrow, endDate: tomorrow, days: 1, status: "approved", reason: "Not feeling well", managerComment: "Get well soon", approvedById: 1 },
        { employeeId: employees[2]?.id ?? employees[0].id, leaveType: "earned", startDate: nextWeek, endDate: nextWeek, days: 1, status: "pending", reason: "Family function", managerComment: null, approvedById: null },
      ]);
    }
  }

  // Advances
  const existingAdvances = await db.select().from(advancesTable).limit(1);
  if (existingAdvances.length === 0) {
    const employees = await db.select().from(employeesTable).limit(3);
    const today = new Date().toISOString().split("T")[0];

    if (employees[0]) {
      await db.insert(advancesTable).values([
        { employeeId: employees[0].id, amount: "5000", reason: "Medical emergency", status: "approved", approvedById: 1, remainingBalance: "5000", date: today },
        { employeeId: employees[1]?.id ?? employees[0].id, amount: "10000", reason: "Home renovation", status: "pending", approvedById: null, remainingBalance: "10000", date: today },
      ]);
    }
  }

  // Announcements
  const existingAnnouncements = await db.select().from(announcementsTable).limit(1);
  if (existingAnnouncements.length === 0) {
    await db.insert(announcementsTable).values([
      { title: "Welcome to Red Fox Hotel HRMS", content: "We are pleased to launch our new HR Management System. Please update your profile and review your attendance records.", targetRole: null, branchId: null, createdById: 1 },
      { title: "Diwali Bonus Announcement", content: "The management is pleased to announce a Diwali bonus for all employees who have completed 6 months of service. The bonus will be credited by October 20th.", targetRole: null, branchId: null, createdById: 1 },
      { title: "New Leave Policy Update", content: "Effective next month, the casual leave policy has been updated. Employees can now carry forward up to 5 days of unused casual leaves to the next quarter.", targetRole: "employee", branchId: null, createdById: 1 },
    ]);
  }

  // Notifications
  const existingNotifications = await db.select().from(notificationsTable).limit(1);
  if (existingNotifications.length === 0) {
    await db.insert(notificationsTable).values([
      { userId: 1, type: "announcement", message: "New announcement: Welcome to Red Fox Hotel HRMS", isRead: false },
      { userId: 1, type: "leave_approval", message: "Leave request from Priya Patel is pending approval", isRead: false },
      { userId: 1, type: "birthday_wish", message: "Today is Vikas Singh's birthday!", isRead: true },
    ]);
  }

  // Holidays
  const existingHolidays = await db.select().from(holidaysTable).limit(1);
  if (existingHolidays.length === 0) {
    const year = new Date().getFullYear();
    await db.insert(holidaysTable).values([
      { name: "New Year's Day", date: `${year}-01-01` },
      { name: "Republic Day", date: `${year}-01-26` },
      { name: "Holi", date: `${year}-03-14` },
      { name: "Good Friday", date: `${year}-04-18` },
      { name: "Eid al-Fitr", date: `${year}-04-21` },
      { name: "Independence Day", date: `${year}-08-15` },
      { name: "Gandhi Jayanti", date: `${year}-10-02` },
      { name: "Diwali", date: `${year}-10-20` },
      { name: "Dussehra", date: `${year}-10-23` },
      { name: "Christmas Day", date: `${year}-12-25` },
    ]);
  }

  // Audit logs
  const existingLogs = await db.select().from(auditLogsTable).limit(1);
  if (existingLogs.length === 0) {
    await db.insert(auditLogsTable).values([
      { userId: 1, userName: "Super Admin", action: "created", entity: "branch", entityId: 1, changes: '{"name":"Mumbai Central"}' },
      { userId: 1, userName: "Super Admin", action: "created", entity: "employee", entityId: 1, changes: '{"employeeId":"EMP001"}' },
      { userId: 1, userName: "Super Admin", action: "approved", entity: "leave", entityId: 2, changes: '{"status":"approved"}' },
    ]);
  }

  console.log("Seeding complete!");
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
