import { pgTable, serial, integer, date, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { shiftsTable } from "./shifts";

export const shiftScheduleTable = pgTable("shift_schedule", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  shiftId: integer("shift_id")
    .notNull()
    .references(() => shiftsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ShiftSchedule = typeof shiftScheduleTable.$inferSelect;
