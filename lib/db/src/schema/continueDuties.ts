import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const continueDutiesTable = pgTable("continue_duties", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContinueDutySchema = createInsertSchema(continueDutiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContinueDuty = z.infer<typeof insertContinueDutySchema>;
export type ContinueDuty = typeof continueDutiesTable.$inferSelect;
