import { pgTable, serial, integer, date, text, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { attendanceTable } from "./attendance";

export const attendanceCorrectionsTable = pgTable("attendance_corrections", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  attendanceId: integer("attendance_id").references(() => attendanceTable.id, { onDelete: "set null" }), // null if complete missing day correction
  date: date("date", { mode: "string" }).notNull(),
  requestedCheckIn: text("requested_check_in"), // HH:MM
  requestedCheckOut: text("requested_check_out"), // HH:MM
  reason: text("reason").notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, rejected
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AttendanceCorrection = typeof attendanceCorrectionsTable.$inferSelect;
