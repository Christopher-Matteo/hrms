import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // super_admin, hr, manager, branch_manager, payroll, employee, reception, it_support
  description: text("description"),
});

export const permissionsTable = pgTable("permissions", {
  id: serial("id").primaryKey(),
  module: text("module").notNull(), // Employee, Leave, Payroll, Support, Settings, Announcements
  action: text("action").notNull(), // Read, Create, Edit, Delete, Approve
  name: text("name").notNull().unique(), // E.g. "employee.read", "employee.create", "leave.approve"
  description: text("description"),
});

export const rolePermissionsTable = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id").notNull().references(() => permissionsTable.id, { onDelete: "cascade" }),
});

export const userRolesTable = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
});

export type Role = typeof rolesTable.$inferSelect;
export type Permission = typeof permissionsTable.$inferSelect;
export type RolePermission = typeof rolePermissionsTable.$inferSelect;
export type UserRole = typeof userRolesTable.$inferSelect;
