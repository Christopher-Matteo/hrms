import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { announcementsTable } from "./announcements";

export const announcementReadsTable = pgTable(
  "announcement_reads",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => announcementsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueUserAnnouncement: unique().on(t.userId, t.announcementId),
  })
);

export type AnnouncementRead = typeof announcementReadsTable.$inferSelect;
