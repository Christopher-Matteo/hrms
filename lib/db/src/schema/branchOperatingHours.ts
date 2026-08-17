import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { branchesTable } from "./branches";

export const branchOperatingHoursTable = pgTable("branch_operating_hours", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id")
    .notNull()
    .references(() => branchesTable.id, { onDelete: "cascade" }),
  openTime: text("open_time").notNull(), // HH:MM
  closeTime: text("close_time").notNull(), // HH:MM
});

export type BranchOperatingHours = typeof branchOperatingHoursTable.$inferSelect;
