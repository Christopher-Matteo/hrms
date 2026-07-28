import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const trustedDevicesTable = pgTable("trusted_devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  browser: text("browser"),
  os: text("os"),
  lastLogin: timestamp("last_login", { withTimezone: true }).notNull().defaultNow(),
  lastIp: text("last_ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TrustedDevice = typeof trustedDevicesTable.$inferSelect;
