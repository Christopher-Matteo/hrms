import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // hr, it, payroll, maintenance, complaint
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").default("open").notNull(), // open, in_progress, resolved, closed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
