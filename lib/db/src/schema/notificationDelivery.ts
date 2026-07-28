import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { notificationsTable } from "./notifications";
import { usersTable } from "./users";

export const notificationDeliveryTable = pgTable("notification_delivery", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id")
    .notNull()
    .references(() => notificationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(), // IN_APP, EMAIL, SMS, WHATSAPP, PUSH
  readAt: timestamp("read_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationDelivery = typeof notificationDeliveryTable.$inferSelect;
