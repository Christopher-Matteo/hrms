import { pgTable, serial, integer, text, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";

export const faceEmbeddingsTable = pgTable("face_embeddings", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .references(() => employeesTable.id, { onDelete: "cascade" })
    .notNull(),
  angle: text("angle").default("straight").notNull(), // straight, left, right, up, down
  embedding: text("embedding").notNull(), // JSON stringified array of 128 numbers
  qualityScore: numeric("quality_score", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  modelName: text("model_name"),
  modelVersion: text("model_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});


export const insertFaceEmbeddingSchema = createInsertSchema(faceEmbeddingsTable).omit({ id: true, createdAt: true });
export type InsertFaceEmbedding = z.infer<typeof insertFaceEmbeddingSchema>;
export type FaceEmbedding = typeof faceEmbeddingsTable.$inferSelect;
