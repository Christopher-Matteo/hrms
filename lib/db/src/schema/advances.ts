import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const advancesTable = pgTable("advances", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, recovered
  approvedById: integer("approved_by_id"),
  remainingBalance: numeric("remaining_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  date: date("date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAdvanceSchema = createInsertSchema(advancesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAdvance = z.infer<typeof insertAdvanceSchema>;
export type Advance = typeof advancesTable.$inferSelect;
