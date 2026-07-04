import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weeklyOffPoliciesTable = pgTable("weekly_off_policies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  policyType: text("policy_type").notNull().default("one_day_per_week"), // one_day_per_week, two_days_per_week, four_days_per_month, custom, rotational
  offDays: text("off_days"), // JSON string of day names e.g. '["Sunday"]'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWeeklyOffPolicySchema = createInsertSchema(weeklyOffPoliciesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWeeklyOffPolicy = z.infer<typeof insertWeeklyOffPolicySchema>;
export type WeeklyOffPolicy = typeof weeklyOffPoliciesTable.$inferSelect;
