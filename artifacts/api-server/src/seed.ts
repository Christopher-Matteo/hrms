import { db, usersTable, branchesTable, departmentsTable, shiftsTable, weeklyOffPoliciesTable, employeesTable, attendanceTable, leavesTable, advancesTable, announcementsTable, notificationsTable, holidaysTable, settingsTable, auditLogsTable, payrollTable, documentsTable } from "@workspace/db";
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
  await db.delete(documentsTable);
  await db.delete(payrollTable);
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
    { name: "Redfox T Nagar", address: "T Nagar, Chennai", phone: "+91 44 5555 6666", email: "redfox.tnagar@redfoxhotel.com", latitude: "13.053921", longitude: "80.233352", radius: "200.00" },
    { name: "Redstone T Nagar", address: "Mamabalam Highway, Zone 9 Teynampet, Chennai - 600024, Tamil Nadu, India", phone: "+91 44 5555 7777", email: "redstone.tnagar@redfoxhotel.com", latitude: "13.053490", longitude: "80.234060", radius: "200.00" },
    { name: "Ambattur", address: "Industrial Estate, Ambattur, Chennai", phone: "+91 44 2222 3333", email: "ambattur@redfoxhotel.com", latitude: "13.133469", longitude: "80.162256", radius: "200.00" },
    { name: "Porur", address: "Mount Poonamallee Road, Porur, Chennai", phone: "+91 44 3333 4444", email: "porur@redfoxhotel.com", latitude: "13.015508", longitude: "80.159126", radius: "200.00" },
    { name: "ECR Redfox Signature", address: "East Coast Road, Chennai", phone: "+91 44 4444 5555", email: "ecr@redfoxhotel.com", latitude: "12.9234", longitude: "80.2435", radius: "200.00" },
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
    { name: "Digital Marketing" },
  ]);

  // Shifts
  const insertedShifts = await db.insert(shiftsTable).values([
    { name: "9:00 AM to 9:00 PM", startTime: "09:00", endTime: "21:00", gracePeriodMinutes: 15 },
    { name: "10:00 AM to 6:00 PM", startTime: "10:00", endTime: "18:00", gracePeriodMinutes: 15 },
    { name: "9:00 AM to 7:00 PM", startTime: "09:00", endTime: "19:00", gracePeriodMinutes: 15 },
    { name: "7:00 PM to 7:00 AM", startTime: "19:00", endTime: "07:00", gracePeriodMinutes: 15 },
    { name: "9:00 PM to 9:00 AM", startTime: "21:00", endTime: "09:00", gracePeriodMinutes: 15 },
    { name: "8:00 PM to 8:00 AM", startTime: "20:00", endTime: "08:00", gracePeriodMinutes: 15 },
    { name: "10:00 AM to 10:00 PM", startTime: "10:00", endTime: "22:00", gracePeriodMinutes: 15 },
    { name: "12:00 AM to 12:00 PM", startTime: "00:00", endTime: "12:00", gracePeriodMinutes: 15 },
    { name: "Full Duty", startTime: "09:00", endTime: "09:00", gracePeriodMinutes: 15 },
    { name: "11:00 AM to 9:00 PM", startTime: "11:00", endTime: "21:00", gracePeriodMinutes: 15 },
    { name: "7:00 AM to 7:00 PM", startTime: "07:00", endTime: "19:00", gracePeriodMinutes: 15 },
  ]).returning();

  // Weekly Off Policies
  const insertedPolicies = await db.insert(weeklyOffPoliciesTable).values([
    { name: "Sunday Off", policyType: "one_day_per_week", offDays: '["Sunday"]' },
    { name: "Saturday & Sunday Off", policyType: "two_days_per_week", offDays: '["Saturday","Sunday"]' },
    { name: "Rotational Off", policyType: "rotational", offDays: null },
    { name: "Housekeeping Monthly Off (1 Sunday/Month)", policyType: "one_week_per_month", offDays: '["Sunday"]' },
    { name: "Standard 4-Week Off (4 Sundays/Month)", policyType: "four_weeks_per_month", offDays: '["Sunday"]' },
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
  const redfoxTnagar = insertedBranches.find(b => b.name === "Redfox T Nagar")!;
  const redstoneTnagar = insertedBranches.find(b => b.name === "Redstone T Nagar")!;
  const ambattur = insertedBranches.find(b => b.name === "Ambattur")!;
  const porur = insertedBranches.find(b => b.name === "Porur")!;
  const ecrSignature = insertedBranches.find(b => b.name === "ECR Redfox Signature")!;

  const sundayOff = insertedPolicies.find(p => p.name === "Sunday Off")!;
  const hkPolicy = insertedPolicies.find(p => p.name === "Housekeeping Monthly Off (1 Sunday/Month)")!;
  const standard4WkPolicy = insertedPolicies.find(p => p.name === "Standard 4-Week Off (4 Sundays/Month)")!;

  const branchMap: Record<string, number> = {
    "Nungambakkam": nungambakkam.id,
    "ECR": ecrSignature.id,
    "Porur": porur.id,
    "Tnagar Redfox": redfoxTnagar.id,
    "Tnagar Redstone": redstoneTnagar.id,
    "Ambattur": ambattur.id,
  };

  const shiftMap: Record<string, number> = {};
  insertedShifts.forEach(s => {
    shiftMap[s.name] = s.id;
  });

  const rawEmployees = [
    { name: "Akheem", branch: "Nungambakkam", department: "Housekeeping", shift: "9:00 AM to 9:00 PM", phone: "8838695618", salary: 14000, gender: "male" },
    { name: "Amudha", branch: "ECR", department: "Housekeeping", shift: "10:00 AM to 6:00 PM", phone: "9876501003", salary: 14000, gender: "female" },
    { name: "Arun", branch: "Nungambakkam", department: "IT", shift: "9:00 AM to 7:00 PM", phone: "6385349075", salary: 15000, gender: "male" },
    { name: "Ashok", branch: "Porur", department: "Housekeeping", shift: "7:00 PM to 7:00 AM", phone: "8603353325", salary: 13000, gender: "male" },
    { name: "Chilanjeet", branch: "Nungambakkam", department: "Housekeeping", shift: "9:00 PM to 9:00 AM", phone: "9876501007", salary: 13000, gender: "male" },
    { name: "Chinnathambi", branch: "ECR", department: "Security", shift: "8:00 PM to 8:00 AM", phone: "9876501008", salary: 15000, gender: "male" },
    { name: "Christopher", branch: "Nungambakkam", department: "IT", shift: "9:00 AM to 7:00 PM", phone: "6369670130", salary: 15000, gender: "male" },
    { name: "Danchusurang", branch: "Tnagar Redfox", department: "Housekeeping", shift: "10:00 AM to 10:00 PM", phone: "9394366226", salary: 13000, gender: "male" },
    { name: "Elumalai", branch: "ECR", department: "Maintenance", shift: "9:00 AM to 9:00 PM", phone: "9655365993", salary: 22000, gender: "male" },
    { name: "Eshwar", branch: "Tnagar Redstone", department: "Front Office", shift: "9:00 AM to 9:00 PM", phone: "7845343472", salary: 20000, gender: "male" },
    { name: "Gowtham", branch: "ECR", department: "Housekeeping", shift: "12:00 AM to 12:00 PM", phone: "9876501015", salary: 13000, gender: "male" },
    { name: "Jagathees", branch: "ECR", department: "Front Office", shift: "10:00 AM to 10:00 PM", phone: "7094660027", salary: 18000, gender: "male" },
    { name: "Jagathees Waran", branch: "Nungambakkam", department: "Digital Marketing", shift: "9:00 AM to 7:00 PM", phone: "9042045671", salary: 15000, gender: "male" },
    { name: "Jai", branch: "Nungambakkam", department: "Housekeeping", shift: "9:00 AM to 9:00 PM", phone: "8248818588", salary: 15000, gender: "male" },
    { name: "Jithendran", branch: "Tnagar Redfox", department: "Front Office", shift: "9:00 PM to 9:00 AM", phone: "6374100163", salary: 17000, gender: "male" },
    { name: "Kabita", branch: "Porur", department: "Housekeeping", shift: "Full Duty", phone: "8603353325", salary: 12000, gender: "female" },
    { name: "Kim", branch: "Tnagar Redfox", department: "Housekeeping", shift: "9:00 AM to 9:00 PM", phone: "6001741996", salary: 12000, gender: "female" },
    { name: "Krishna", branch: "Tnagar Redstone", department: "Housekeeping", shift: "9:00 AM to 9:00 PM", phone: "9395105213", salary: 12000, gender: "male" },
    { name: "Lakshmi Kanth", branch: "Ambattur", department: "Front Office", shift: "Full Duty", phone: "6379746124", salary: 15000, gender: "male" },
    { name: "Meena", branch: "Nungambakkam", department: "Front Office", shift: "9:00 AM to 7:00 PM", phone: "8122350869", salary: 15000, gender: "female" },
    { name: "Milan", branch: "Nungambakkam", department: "Housekeeping", shift: "9:00 AM to 9:00 PM", phone: "8753932581", salary: 14000, gender: "male" },
    { name: "Mohan Raj", branch: "Tnagar Redfox", department: "Front Office", shift: "9:00 AM to 9:00 PM", phone: "9003144819", salary: 18000, gender: "male" },
    { name: "Pallab", branch: "Tnagar Redstone", department: "Housekeeping", shift: "9:00 PM to 9:00 AM", phone: "8856097909", salary: 14000, gender: "male" },
    { name: "Rakesh", branch: "Porur", department: "Front Office", shift: "7:00 AM to 7:00 PM", phone: "7200982240", salary: 18000, gender: "male" },
    { name: "Rithesh", branch: "Nungambakkam", department: "Front Office", shift: "9:00 PM to 9:00 AM", phone: "9025065824", salary: 15000, gender: "male" },
    { name: "Santhi", branch: "Ambattur", department: "Housekeeping", shift: "Full Duty", phone: "6379746124", salary: 12000, gender: "female" },
    { name: "Shanumuga Sundaram", branch: "Nungambakkam", department: "HR", shift: "9:00 AM to 7:00 PM", phone: "8220305867", salary: 15000, gender: "male" },
    { name: "Usha", branch: "Nungambakkam", department: "Housekeeping", shift: "10:00 AM to 10:00 PM", phone: "8472908883", salary: 12000, gender: "female" },
    { name: "Pandiyan", branch: "Nungambakkam", department: "Maintenance", shift: "11:00 AM to 9:00 PM", phone: "8807332035", salary: 26000, gender: "male" }
  ];

  const mappedEmployees = rawEmployees.map((emp, index) => {
    const idNum = index + 1;
    const employeeId = `EMP${String(idNum).padStart(3, "0")}`;
    const nameParts = emp.name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    const cleanFirstName = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanLastName = lastName ? lastName.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
    const emailPrefix = cleanLastName ? `${cleanFirstName}.${cleanLastName}` : cleanFirstName;
    const email = `${emailPrefix}@redfoxdemo.com`;
    const branchId = branchMap[emp.branch];
    const shiftId = shiftMap[emp.shift];
    
    let weeklyOffPolicyId = standard4WkPolicy.id;
    if (emp.department === "Housekeeping") {
      weeklyOffPolicyId = hkPolicy.id;
    }

    let designation = "Staff";
    if (emp.department === "Housekeeping") designation = "Housekeeping Staff";
    else if (emp.department === "IT") designation = "IT Support Specialist";
    else if (emp.department === "Security") designation = "Security Guard";
    else if (emp.department === "Maintenance") designation = "Maintenance Technician";
    else if (emp.department === "Front Office") designation = "Front Office Executive";
    else if (emp.department === "Digital Marketing") designation = "Digital Marketer";
    else if (emp.department === "HR") designation = "HR Executive";

    return {
      employeeId,
      firstName,
      lastName,
      email,
      phone: emp.phone,
      gender: emp.gender,
      address: `${emp.branch}, Chennai`,
      department: emp.department,
      designation,
      branchId,
      shiftId: shiftId || null,
      weeklyOffPolicyId,
      joiningDate: "2024-01-15",
      employmentType: "full_time",
      status: "active",
      salary: String(emp.salary),
      emailVerified: true,
    };
  });

  await db.insert(employeesTable).values(mappedEmployees);

  // Create user accounts for all employees with default passwords (ONLY first 4 letters of name)
  const insertedEmps = await db.select().from(employeesTable);
  for (const emp of insertedEmps) {
    let role = "employee";
    if (emp.department === "HR") {
      role = "hr_manager";
    } else if (emp.employeeId === "EMP003" || emp.designation.toLowerCase().includes("manager")) {
      role = "branch_manager";
    }

    const firstFour = emp.firstName.substring(0, 4).toUpperCase().padEnd(4, "X");
    const defaultPass = firstFour;
    const passwordHash = hashPassword(defaultPass);

    await db.insert(usersTable).values({
      email: emp.email,
      passwordHash,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      role,
      branchId: emp.branchId,
      employeeId: emp.id,
    });
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
