import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const SECTORS = [
  "producao_operacional",
  "comercial",
  "vendas",
  "financeiro",
  "administrador_principal",
] as const;

export const ROLES = [
  "tecnico",
  "ajudante",
  "supervisor",
  "comercial",
  "vendedor",
  "financeiro",
  "administrador",
] as const;

export type Sector = (typeof SECTORS)[number];
export type EmployeeRole = (typeof ROLES)[number];

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  cpf: text("cpf"),
  birthDate: text("birth_date"),
  sector: text("sector").notNull().default("producao_operacional"),
  role: text("role").notNull().default("tecnico"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
