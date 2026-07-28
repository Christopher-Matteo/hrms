import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { attendanceCorrectionsTable } from "./attendanceCorrections";
import { usersTable } from "./users";

export const attendanceCorrectionHistoryTable = pgTable("attendance_correction_history", {
  id: serial("id").primaryKey(),
  correctionId: integer("correction_id")
    .notNull()
    .references(() => attendanceCorrectionsTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // requested, modified, manager_approved, hr_approved, rejected
  oldValue: text("old_value"), // JSON representation of old fields
  newValue: text("new_value"), // JSON representation of new fields
  performedBy: integer("performed_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AttendanceCorrectionHistory = typeof attendanceCorrectionHistoryTable.$inferSelect;
