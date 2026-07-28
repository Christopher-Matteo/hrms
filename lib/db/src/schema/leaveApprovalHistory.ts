import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { leavesTable } from "./leaves";
import { usersTable } from "./users";

export const leaveApprovalHistoryTable = pgTable("leave_approval_history", {
  id: serial("id").primaryKey(),
  leaveId: integer("leave_id")
    .notNull()
    .references(() => leavesTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // applied, manager_approved, hr_approved, rejected, cancelled, completed
  performedBy: integer("performed_by").references(() => usersTable.id, { onDelete: "set null" }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeaveApprovalHistory = typeof leaveApprovalHistoryTable.$inferSelect;
