import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default("Red Fox Hotel"),
  companyEmail: text("company_email"),
  companyPhone: text("company_phone"),
  companyAddress: text("company_address"),
  overtimeRatePerHour: numeric("overtime_rate_per_hour", { precision: 10, scale: 2 }).notNull().default("50"),
  continueDutyRate: numeric("continue_duty_rate", { precision: 10, scale: 2 }).notNull().default("500"),
  lateDeductionPerMinute: numeric("late_deduction_per_minute", { precision: 10, scale: 2 }).notNull().default("2"),
  gracePeriodMinutes: integer("grace_period_minutes").notNull().default(15),
  workingHoursPerDay: numeric("working_hours_per_day", { precision: 5, scale: 2 }).notNull().default("8"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
