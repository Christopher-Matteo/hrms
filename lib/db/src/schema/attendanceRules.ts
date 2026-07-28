import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { branchesTable } from "./branches";

export const attendanceRulesTable = pgTable("attendance_rules", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id")
    .notNull()
    .references(() => branchesTable.id, { onDelete: "cascade" })
    .unique(),
  lateThresholdMinutes: integer("late_threshold_minutes").default(10).notNull(),
  minimumWorkHours: integer("minimum_work_hours").default(8).notNull(),
  overtimeAfterHours: integer("overtime_after_hours").default(9).notNull(),
  autoCheckoutTime: text("auto_checkout_time"), // HH:MM
});

export type AttendanceRule = typeof attendanceRulesTable.$inferSelect;
