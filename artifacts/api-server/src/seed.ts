import { db, usersTable, branchesTable, departmentsTable, shiftsTable, weeklyOffPoliciesTable, employeesTable, attendanceTable, leavesTable, advancesTable, announcementsTable, notificationsTable, holidaysTable, settingsTable, auditLogsTable, payrollTable, documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "hrms_salt_2024").digest("hex");
}

async function seed() {
  console.log("Checking if database is already seeded...");
  try {
    const existingUsers = await db.select().from(usersTable).limit(1);
    if (existingUsers.length > 0) {
      console.log("Database already contains data. Skipping seeding to prevent overwriting existing data.");
      return;
    }
  } catch (error) {
    console.error("Error checking database state, proceeding with caution:", error);
  }

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

  const generalShift = insertedShifts.find(s => s.name === "General Shift")!;
  const morningShift = insertedShifts.find(s => s.name === "Morning Shift")!;
  const eveningShift = insertedShifts.find(s => s.name === "Evening Shift")!;
  const nightShift = insertedShifts.find(s => s.name === "Night Shift")!;
  const sundayOff = insertedPolicies.find(p => p.name === "Sunday Off")!;
  const hkPolicy = insertedPolicies.find(p => p.name === "Housekeeping Monthly Off (1 Sunday/Month)")!;
  const standard4WkPolicy = insertedPolicies.find(p => p.name === "Standard 4-Week Off (4 Sundays/Month)")!;

  const employees = [
    { employeeId: "EMP001", firstName: "Abhinesh", lastName: "M", email: "abhinesh@redfoxdemo.com", phone: "8270682113", gender: "male", dob: "2001-11-13", address: "ECR, Chennai", department: "Front Office", designation: "Front Office Executive", branchId: ecrSignature.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-01-15", employmentType: "full_time", status: "active", salary: "15000", emailVerified: true },
    { employeeId: "EMP002", firstName: "Akheem", lastName: "Kikiambe Nriame", email: "kikiamberiame@gmail.com", phone: "8838695618", gender: "male", dob: "2000-06-04", address: "Nungambakkam, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: nungambakkam.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-02-10", employmentType: "full_time", status: "active", salary: "14000", emailVerified: true },
    { employeeId: "EMP003", firstName: "Amutha", lastName: "", email: "amutha@redfoxdemo.com", phone: "9876501003", gender: "female", dob: "1995-07-15", address: "ECR, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: ecrSignature.id, shiftId: eveningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-03-18", employmentType: "full_time", status: "active", salary: "16500", emailVerified: true },
    { employeeId: "EMP004", firstName: "Arun", lastName: "B", email: "juntoro@gmail.com", phone: "6385349075", gender: "male", dob: "2005-03-04", address: "Nungambakkam, Chennai", department: "IT", designation: "Web Developer", branchId: nungambakkam.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-06-01", employmentType: "full_time", status: "active", salary: "150000", emailVerified: true },
    { employeeId: "EMP005", firstName: "Ashok", lastName: "Rana", email: "ashok@redfoxdemo.com", phone: "8603353325", gender: "male", dob: "1997-05-25", address: "Porur, Chennai", department: "Front Office", designation: "Front Office Executive", branchId: porur.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2026-07-01", employmentType: "full_time", status: "active", salary: "18000", emailVerified: true },
    { employeeId: "EMP006", firstName: "Athsentso", lastName: "", email: "athsentso@redfoxdemo.com", phone: "6909651251", gender: "male", dob: "2001-04-17", address: "ECR, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: ecrSignature.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2026-07-01", employmentType: "full_time", status: "active", salary: "14000", emailVerified: true },
    { employeeId: "EMP009", firstName: "Chilanjeet", lastName: "", email: "chilanjeet@redfoxdemo.com", phone: "9876501007", gender: "male", dob: "1998-05-09", address: "Nungambakkam, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: nungambakkam.id, shiftId: eveningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-04-03", employmentType: "full_time", status: "active", salary: "17000", emailVerified: true },
    { employeeId: "EMP008", firstName: "Chinna", lastName: "Thambi", email: "chinna@redfoxdemo.com", phone: "9876501008", gender: "male", dob: "1988-03-19", address: "ECR, Chennai", department: "Security", designation: "Security Guard", branchId: ecrSignature.id, shiftId: nightShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-02-22", employmentType: "full_time", status: "active", salary: "19000", emailVerified: true },
    { employeeId: "EMP007", firstName: "Christopher", lastName: "", email: "chrisprimaryacc@gmail.com", phone: "9876501009", gender: "male", dob: "2005-09-17", address: "Nungambakkam, Chennai", department: "IT", designation: "Web Developer", branchId: nungambakkam.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2026-07-01", employmentType: "full_time", status: "active", salary: "15000", emailVerified: true },
    { employeeId: "EMP010", firstName: "Dansurang", lastName: "Rai", email: "dansurang@redfoxdemo.com", phone: "9876501010", gender: "male", dob: "1995-10-17", address: "T-Nagar, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: redfoxTnagar.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-03-06", employmentType: "full_time", status: "active", salary: "17000", emailVerified: true },
    { employeeId: "EMP012", firstName: "Deepak", lastName: "Kumar", email: "deepak@redfoxdemo.com", phone: "9876501012", gender: "male", dob: "1996-09-14", address: "T-Nagar, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: redstoneTnagar.id, shiftId: eveningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-02-19", employmentType: "full_time", status: "active", salary: "17000", emailVerified: true },
    { employeeId: "EMP013", firstName: "Dheenan", lastName: "Raj", email: "dheenan@redfoxdemo.com", phone: "9876501013", gender: "male", dob: "1997-08-29", address: "T-Nagar, Chennai", department: "Front Office", designation: "Front Office Executive", branchId: redstoneTnagar.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-01-09", employmentType: "full_time", status: "active", salary: "18000", emailVerified: true },
    { employeeId: "EMP014", firstName: "Elumalai", lastName: "M", email: "elumalai@redfoxdemo.com", phone: "9876501014", gender: "male", dob: "1987-12-01", address: "ECR, Chennai", department: "Maintenance", designation: "Maintenance Technician", branchId: ecrSignature.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-05-05", employmentType: "full_time", status: "active", salary: "22000", emailVerified: true },
    { employeeId: "EMP015", firstName: "Gautham", lastName: "R", email: "gautham@redfoxdemo.com", phone: "9876501015", gender: "male", dob: "1998-02-18", address: "ECR, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: ecrSignature.id, shiftId: eveningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-03-13", employmentType: "full_time", status: "active", salary: "17000", emailVerified: true },
    { employeeId: "EMP016", firstName: "Jagadees", lastName: "", email: "jagadeed@gmail.com", phone: "9876501016", gender: "male", dob: "1998-10-30", address: "Ambattur, Chennai", department: "IT", designation: "Digital Marketer", branchId: ambattur.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2026-07-01", employmentType: "full_time", status: "active", salary: "15000", emailVerified: true },
    { employeeId: "EMP017", firstName: "Jagadhees", lastName: "R", email: "jagadhees@redfoxdemo.com", phone: "9876501017", gender: "male", dob: "1997-07-07", address: "ECR, Chennai", department: "Front Office", designation: "Front Office Executive", branchId: ecrSignature.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-01-28", employmentType: "full_time", status: "active", salary: "18000", emailVerified: true },
    { employeeId: "EMP018", firstName: "Jay", lastName: "Kumar", email: "jay@redfoxdemo.com", phone: "9876501018", gender: "male", dob: "1995-11-18", address: "Nungambakkam, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: nungambakkam.id, shiftId: eveningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-03-21", employmentType: "full_time", status: "active", salary: "17000", emailVerified: true },
    { employeeId: "EMP019", firstName: "Jithendran", lastName: "P", email: "jithendran@redfoxdemo.com", phone: "9876501019", gender: "male", dob: "1998-04-04", address: "T-Nagar, Chennai", department: "Front Office", designation: "Front Office Executive", branchId: redstoneTnagar.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-01-17", employmentType: "full_time", status: "active", salary: "18000", emailVerified: true },
    { employeeId: "EMP020", firstName: "Kabita", lastName: "Ranna", email: "kabita@redfoxdemo.com", phone: "9876501020", gender: "female", dob: "1992-05-15", address: "Porur, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: porur.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-02-01", employmentType: "full_time", status: "active", salary: "16500", emailVerified: true },
    { employeeId: "EMP021", firstName: "Lakshmikanth", lastName: "S", email: "lakshmikanth@redfoxdemo.com", phone: "9876501021", gender: "male", dob: "1990-03-02", address: "Ambattur, Chennai", department: "Front Office", designation: "Front Office Executive", branchId: ambattur.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-04-14", employmentType: "full_time", status: "active", salary: "20000", emailVerified: true },
    { employeeId: "EMP022", firstName: "Meena", lastName: "D.P", email: "meenaprem3905@gmail.com", phone: "8122350869", gender: "female", dob: "2005-09-03", address: "Porur, Chennai", department: "Front Office", designation: "Front Office Executive", branchId: porur.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2026-02-07", employmentType: "full_time", status: "active", salary: "18000", emailVerified: true },
    { employeeId: "EMP023", firstName: "Millan", lastName: "Narzary", email: "jiminjimin3155@gmail.com", phone: "8753932581", gender: "male", dob: "2009-05-03", address: "Nungambakkam, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: nungambakkam.id, shiftId: eveningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2026-07-01", employmentType: "full_time", status: "active", salary: "14000", emailVerified: true },
    { employeeId: "EMP024", firstName: "Mohan", lastName: "Raj", email: "mohan@redfoxdemo.com", phone: "9876501024", gender: "male", dob: "1994-08-05", address: "T-Nagar, Chennai", department: "Front Office", designation: "Front Office Executive", branchId: redfoxTnagar.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-01-20", employmentType: "full_time", status: "active", salary: "18000", emailVerified: true },
    { employeeId: "EMP025", firstName: "Pallab", lastName: "Roy", email: "pallab@redfoxdemo.com", phone: "9876501025", gender: "male", dob: "1996-07-27", address: "T-Nagar, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: redfoxTnagar.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-04-18", employmentType: "full_time", status: "active", salary: "17000", emailVerified: true },
    { employeeId: "EMP026", firstName: "Rahul", lastName: "New", email: "rahul.new@redfoxdemo.com", phone: "9876501026", gender: "male", dob: "1997-12-08", address: "T-Nagar, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: redstoneTnagar.id, shiftId: eveningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-02-25", employmentType: "full_time", status: "active", salary: "17000", emailVerified: true },
    { employeeId: "EMP027", firstName: "Rahul", lastName: "Old", email: "rahul.old@redfoxdemo.com", phone: "9876501027", gender: "male", dob: "1993-10-01", address: "T-Nagar, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: redfoxTnagar.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-03-08", employmentType: "full_time", status: "active", salary: "17000", emailVerified: true },
    { employeeId: "EMP028", firstName: "Shanmuga", lastName: "Sundaram", email: "shanmuga@redfoxdemo.com", phone: "9876501028", gender: "male", dob: "1989-01-09", address: "Nungambakkam, Chennai", department: "HR", designation: "HR Executive", branchId: nungambakkam.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-01-10", employmentType: "full_time", status: "active", salary: "28000", emailVerified: true },
    { employeeId: "EMP029", firstName: "Shanthi", lastName: "R", email: "shanthi@redfoxdemo.com", phone: "9876501029", gender: "female", dob: "1991-06-18", address: "Ambattur, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: ambattur.id, shiftId: eveningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-02-12", employmentType: "full_time", status: "active", salary: "16500", emailVerified: true },
    { employeeId: "EMP030", firstName: "Tsalib", lastName: "Khan", email: "tsalib@redfoxdemo.com", phone: "9876501030", gender: "male", dob: "1994-11-11", address: "Ambattur, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: ambattur.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-05-14", employmentType: "full_time", status: "active", salary: "17000", emailVerified: true },
    { employeeId: "EMP031", firstName: "Tsariba", lastName: "Devi", email: "tsariba@redfoxdemo.com", phone: "9876501031", gender: "female", dob: "1993-02-21", address: "ECR, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: ecrSignature.id, shiftId: eveningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-06-03", employmentType: "full_time", status: "active", salary: "17000", emailVerified: true },
    { employeeId: "EMP032", firstName: "Usha", lastName: "Devi", email: "usha@redfoxdemo.com", phone: "9876501032", gender: "female", dob: "1995-04-14", address: "Nungambakkam, Chennai", department: "Housekeeping", designation: "Housekeeping Staff", branchId: nungambakkam.id, shiftId: morningShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-01-27", employmentType: "full_time", status: "active", salary: "16500", emailVerified: true },
    { employeeId: "EMP033", firstName: "Vimalraj", lastName: "S", email: "vimalraj@redfoxdemo.com", phone: "9876501033", gender: "male", dob: "1997-05-26", address: "Porur, Chennai", department: "Front Office", designation: "Front Office Executive", branchId: porur.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-02-04", employmentType: "full_time", status: "active", salary: "18000", emailVerified: true },
    { employeeId: "EMP100", firstName: "Demo", lastName: "Tester", email: "demo.tester@redfoxdemo.com", phone: "9999999999", gender: "male", dob: "2000-01-01", address: "Nungambakkam, Chennai", department: "Front Office", designation: "Front Office Executive", branchId: nungambakkam.id, shiftId: generalShift.id, weeklyOffPolicyId: sundayOff.id, joiningDate: "2024-01-01", employmentType: "full_time", status: "active", salary: "10000", emailVerified: true },
  ];

  const mappedEmployees = employees.map(emp => {
    let policyId = standard4WkPolicy.id;
    if (emp.department === "Housekeeping") {
      policyId = hkPolicy.id;
    }
    return { ...emp, weeklyOffPolicyId: policyId };
  });

  await db.insert(employeesTable).values(mappedEmployees);

  // Create user accounts for all employees with default passwords (NAME + DOB Year)
  const insertedEmps = await db.select().from(employeesTable);
  for (const emp of insertedEmps) {
    let role = "employee";
    if (emp.employeeId === "EMP001") {
      role = "hr_manager";
    } else if (emp.employeeId === "EMP003") {
      role = "branch_manager";
    }

    const firstFour = emp.firstName.substring(0, 4).toUpperCase();
    const birthYear = emp.dob ? new Date(emp.dob).getFullYear() : 2000;
    const defaultPass = `${firstFour}${birthYear}`;
    const passwordHash = hashPassword(defaultPass);

    await db.insert(usersTable).values({
      email: emp.email,
      passwordHash,
      name: `${emp.firstName} ${emp.lastName}`,
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
