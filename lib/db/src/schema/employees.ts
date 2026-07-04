import { pgTable, serial, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(), // auto-generated like EMP001
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  gender: text("gender").notNull().default("male"), // male, female, other
  dob: date("dob", { mode: "string" }),
  address: text("address"),
  emergencyContact: text("emergency_contact"),
  department: text("department").notNull(),
  designation: text("designation").notNull(),
  branchId: integer("branch_id").notNull(),
  shiftId: integer("shift_id"),
  weeklyOffPolicyId: integer("weekly_off_policy_id"),
  joiningDate: date("joining_date", { mode: "string" }).notNull(),
  employmentType: text("employment_type").notNull().default("full_time"), // full_time, part_time, contract, intern
  status: text("status").notNull().default("active"), // active, inactive, terminated
  salary: numeric("salary", { precision: 12, scale: 2 }).notNull(),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  ifscCode: text("ifsc_code"),
  upiId: text("upi_id"),
  panNumber: text("pan_number"),
  aadhaarNumber: text("aadhaar_number"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
