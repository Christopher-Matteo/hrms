import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("present"), // present, absent, weekly_off, public_holiday, paid_leave, sick_leave, half_day, late, overtime, continue_duty
  checkIn: text("check_in"), // HH:MM
  checkOut: text("check_out"), // HH:MM
  workingHours: numeric("working_hours", { precision: 5, scale: 2 }),
  breakTime: numeric("break_time", { precision: 5, scale: 2 }),
  lateMinutes: integer("late_minutes"),
  overtimeHours: numeric("overtime_hours", { precision: 5, scale: 2 }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
