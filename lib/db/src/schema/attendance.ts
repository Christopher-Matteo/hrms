import { pgTable, serial, integer, text, numeric, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";

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
  verificationScore: numeric("verification_score", { precision: 5, scale: 2 }),
  
  homeBranchId: integer("home_branch_id").references(() => branchesTable.id),
  attendanceBranchId: integer("attendance_branch_id").references(() => branchesTable.id),
  gpsLatitude: numeric("gps_latitude", { precision: 10, scale: 7 }),
  gpsLongitude: numeric("gps_longitude", { precision: 10, scale: 7 }),
  gpsAccuracy: numeric("gps_accuracy", { precision: 8, scale: 2 }),
  distanceFromBranch: numeric("distance_from_branch", { precision: 8, scale: 2 }),
  deviceInfo: text("device_info"),
  browser: text("browser"),
  os: text("os"),
  gpsVerified: boolean("gps_verified").default(false).notNull(),
  faceVerified: boolean("face_verified").default(false).notNull(),
  livenessVerified: boolean("liveness_verified").default(false).notNull(),
  riskScore: numeric("risk_score", { precision: 3, scale: 2 }).default("0.00"),
  faceAttempts: integer("face_attempts").default(1).notNull(),
  source: text("source").notNull().default("KIOSK"), // KIOSK, EMPLOYEE_PORTAL, ADMIN, MANUAL, API
  checkInPhoto: text("check_in_photo"),
  checkOutPhoto: text("check_out_photo"),
  photoVerified: boolean("photo_verified").default(false).notNull(),
  faceVerificationStatus: text("face_verification_status").default("Pending Review").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});


export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
