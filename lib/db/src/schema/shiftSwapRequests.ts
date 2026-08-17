import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { shiftScheduleTable } from "./shiftSchedule";
import { usersTable } from "./users";

export const shiftSwapRequestsTable = pgTable("shift_swap_requests", {
  id: serial("id").primaryKey(),
  requesterEmployeeId: integer("requester_employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  targetEmployeeId: integer("target_employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  shiftScheduleId: integer("shift_schedule_id")
    .notNull()
    .references(() => shiftScheduleTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, rejected, cancelled
  approvedBy: integer("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ShiftSwapRequest = typeof shiftSwapRequestsTable.$inferSelect;
