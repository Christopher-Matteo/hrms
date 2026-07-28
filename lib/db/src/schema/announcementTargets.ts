import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { announcementsTable } from "./announcements";

export const announcementTargetsTable = pgTable("announcement_targets", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id")
    .notNull()
    .references(() => announcementsTable.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // global, branch, department, employee
  targetId: integer("target_id"), // references branchId, departmentId (rolesTable/employeesTable ID depends on targetType)
});

export type AnnouncementTarget = typeof announcementTargetsTable.$inferSelect;
