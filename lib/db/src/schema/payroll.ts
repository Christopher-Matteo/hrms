import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const payrollTable = pgTable("payroll", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  month: text("month").notNull(), // YYYY-MM
  basicSalary: numeric("basic_salary", { precision: 12, scale: 2 }).notNull(),
  workingDays: integer("working_days").notNull().default(0),
  expectedWorkingDays: integer("expected_working_days").notNull().default(0),
  presentDays: integer("present_days").notNull().default(0),
  absentDays: integer("absent_days").notNull().default(0),
  weeklyOffDays: integer("weekly_off_days").notNull().default(0),
  leaveDays: integer("leave_days").notNull().default(0),
  continueDutyDays: integer("continue_duty_days").notNull().default(0),
  continueDutyAmount: numeric("continue_duty_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  overtimeHours: numeric("overtime_hours", { precision: 8, scale: 2 }).notNull().default("0"),
  overtimeAmount: numeric("overtime_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  bonus: numeric("bonus", { precision: 12, scale: 2 }).notNull().default("0"),
  allowances: numeric("allowances", { precision: 12, scale: 2 }).notNull().default("0"),
  advanceDeduction: numeric("advance_deduction", { precision: 12, scale: 2 }).notNull().default("0"),
  absentDeduction: numeric("absent_deduction", { precision: 12, scale: 2 }).notNull().default("0"),
  lateDeduction: numeric("late_deduction", { precision: 12, scale: 2 }).notNull().default("0"),
  grossSalary: numeric("gross_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  totalDeductions: numeric("total_deductions", { precision: 12, scale: 2 }).notNull().default("0"),
  netSalary: numeric("net_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  manualAttendanceCount: integer("manual_attendance_count").notNull().default(0),
  status: text("status").notNull().default("draft"), // draft, approved, paid
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPayrollSchema = createInsertSchema(payrollTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayroll = z.infer<typeof insertPayrollSchema>;
export type Payroll = typeof payrollTable.$inferSelect;
