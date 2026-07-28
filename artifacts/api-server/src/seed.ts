import { db, usersTable, branchesTable, departmentsTable, shiftsTable, weeklyOffPoliciesTable, employeesTable, attendanceTable, leavesTable, advancesTable, announcementsTable, notificationsTable, holidaysTable, settingsTable, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "hrms_salt_2024").digest("hex");
}

async function seed() {
  console.log("Seeding database...");

  // Truncate tables to ensure a clean seed matching the geofence branch requirements
  console.log("Clearing existing tables...");
  await db.delete(attendanceTable);
  await db.delete(leavesTable);
  await db.delete(advancesTable);
  await db.delete(employeesTable);
  await db.delete(usersTable);
  await db.delete(branchesTable);
  await db.delete(departmentsTable);
  await db.delete(shiftsTable);
  await db.delete(weeklyOffPoliciesTable);
  await db.delete(auditLogsTable);

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
  console.log("Seeding new branches...");
  const insertedBranches = await db.insert(branchesTable).values([
    { name: "Nungambakkam", address: "K R S Hospitals, Avenue Road, Zone 9 Teynampet, Chennai - 600034, Tamil Nadu, India", phone: "+91 44 1111 2222", email: "nungambakkam@redfoxhotel.com", latitude: "13.0624", longitude: "80.2443", radius: "200.00" },
    { name: "T-Nagar", address: "T Nagar, Chennai", phone: "+91 44 5555 6666", email: "redfox.tnagar@redfoxhotel.com", latitude: "13.0418", longitude: "80.2341", radius: "200.00" },
    { name: "Ambattur", address: "Industrial Estate, Ambattur, Chennai", phone: "+91 44 2222 3333", email: "ambattur@redfoxhotel.com", latitude: "13.133469", longitude: "80.162256", radius: "200.00" },
    { name: "Porur", address: "Mount Poonamallee Road, Porur, Chennai", phone: "+91 44 3333 4444", email: "porur@redfoxhotel.com", latitude: "13.015508", longitude: "80.159126", radius: "200.00" },
  ]).returning();

  // Departments
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

  // Shifts
  const insertedShifts = await db.insert(shiftsTable).values([
    { name: "Morning Shift", startTime: "06:00", endTime: "14:00", gracePeriodMinutes: 10 },
    { name: "Evening Shift", startTime: "14:00", endTime: "22:00", gracePeriodMinutes: 10 },
    { name: "Night Shift", startTime: "22:00", endTime: "06:00", gracePeriodMinutes: 15 },
    { name: "General Shift", startTime: "09:00", endTime: "18:00", gracePeriodMinutes: 15 },
  ]).returning();

  // Weekly Off Policies
  const insertedPolicies = await db.insert(weeklyOffPoliciesTable).values([
    { name: "Sunday Off", policyType: "one_day_per_week", offDays: '["Sunday"]' },
    { name: "Saturday & Sunday Off", policyType: "two_days_per_week", offDays: '["Saturday","Sunday"]' },
    { name: "Rotational Off", policyType: "rotational", offDays: null },
  ]).returning();

  // Super Admin User
  await db.insert(usersTable).values({
    email: "admin@redfoxhotel.com",
    passwordHash: hashPassword("admin123"),
    name: "Super Admin",
    role: "super_admin",
  });

  // Employees
  const nungambakkam = insertedBranches.find(b => b.name === "Nungambakkam")!;
  const ambattur = insertedBranches.find(b => b.name === "Ambattur")!;
  const porur = insertedBranches.find(b => b.name === "Porur")!;
  const generalShift = insertedShifts.find(s => s.name === "General Shift")!;
  const morningShift = insertedShifts.find(s => s.name === "Morning Shift")!;
  const sundayOff = insertedPolicies.find(p => p.name === "Sunday Off")!;

  const employees = [
    { employeeId: "EMP001", firstName: "Rahul", lastName: "Sharma", email: "rahul.sharma@redfoxhotel.com", phone: "9876543210", gender: "male", dob: "1985-06-15", address: "Nungambakkam, Chennai", department: "HR", designation: "HR Manager", branchId: nungambakkam.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2020-01-15", employmentType: "full_time", status: "active", salary: "65000", emailVerified: true },
    { employeeId: "EMP002", firstName: "Priya", lastName: "Patel", email: "priya.patel@redfoxhotel.com", phone: "9876543211", gender: "female", dob: "1990-03-22", address: "Porur, Chennai", department: "Front Office", designation: "Front Desk Executive", branchId: porur.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2021-03-10", employmentType: "full_time", status: "active", salary: "32000", emailVerified: true },
    { employeeId: "EMP003", firstName: "Amit", lastName: "Kumar", email: "amit.kumar@redfoxhotel.com", phone: "9876543212", gender: "male", dob: "1988-11-08", address: "Ambattur, Chennai", department: "Food & Beverage", designation: "F&B Manager", branchId: ambattur.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2019-07-20", employmentType: "full_time", status: "active", salary: "55000", emailVerified: true },
    { employeeId: "EMP004", firstName: "Sunita", lastName: "Reddy", email: "sunita.reddy@redfoxhotel.com", phone: "9876543213", gender: "female", dob: "1992-08-14", address: "Porur, Chennai", department: "Housekeeping", designation: "Housekeeper", branchId: porur.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2022-01-05", employmentType: "full_time", status: "active", salary: "28000", emailVerified: true },
    { employeeId: "EMP005", firstName: "Vikas", lastName: "Singh", email: "vikas.singh@redfoxhotel.com", phone: "9876543214", gender: "male", dob: "1987-04-30", address: "Nungambakkam, Chennai", department: "Security", designation: "Security Supervisor", branchId: nungambakkam.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2020-09-15", employmentType: "full_time", status: "active", salary: "35000", emailVerified: true },
  ];

  await db.insert(employeesTable).values(employees);

  // Create user accounts for HR manager and branch managers - marked as "Password Not Set"
  const insertedEmps = await db.select().from(employeesTable).limit(10);
  for (const emp of insertedEmps) {
    let role = "employee";
    let email = emp.email;
    if (emp.employeeId === "EMP001") {
      role = "hr_manager";
      email = "hr@redfoxhotel.com";
    } else if (emp.employeeId === "EMP003") {
      role = "branch_manager";
      email = "manager@redfoxhotel.com";
    }

    await db.insert(usersTable).values({
      email,
      passwordHash: "Password Not Set",
      name: `${emp.firstName} ${emp.lastName}`,
      role,
      branchId: emp.branchId,
      employeeId: emp.id,
    });
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
