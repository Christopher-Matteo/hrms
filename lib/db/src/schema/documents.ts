import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { usersTable } from "./users";

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(), // appointment_letter, experience_letter, payslip, hr_policy, certificate, training
  storageProvider: text("storage_provider").notNull(), // local, supabase, s3, azure
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedBy: integer("uploaded_by").references(() => usersTable.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export type DocumentRecord = typeof documentsTable.$inferSelect;
