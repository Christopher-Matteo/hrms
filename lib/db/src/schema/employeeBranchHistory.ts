import { pgTable, serial, integer, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { branchesTable } from "./branches";

export const employeeBranchHistoryTable = pgTable("employee_branch_history", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  branchId: integer("branch_id")
    .notNull()
    .references(() => branchesTable.id, { onDelete: "cascade" }),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  effectiveTo: date("effective_to", { mode: "string" }),
  isCurrent: boolean("is_current").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmployeeBranchHistory = typeof employeeBranchHistoryTable.$inferSelect;
