import { pgTable, text, serial, timestamp, jsonb, index, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  checked: z.boolean(),
});

export type ChecklistItem = z.infer<typeof checklistItemSchema>;

// Pontuação por tipo de serviço (regras de produtividade).
export const SERVICE_POINTS: Record<string, number> = {
  cleaning: 2,
  maintenance: 3,
  installation: 8,
  repair: 3,
  inspection: 2,
};

export function getServicePoints(serviceType: string): number {
  return SERVICE_POINTS[serviceType] ?? 0;
}

export const serviceOrdersTable = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientAddress: text("client_address").notNull(),
  serviceType: text("service_type").notNull(),
  technician: text("technician").notNull(),
  technicians: jsonb("technicians").$type<string[]>().notNull().default([]),
  scheduledDate: text("scheduled_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  reminderMinutes: integer("reminder_minutes").notNull().default(15),
  status: text("status").notNull().default("open"),
  equipmentCapacity: text("equipment_capacity").notNull(),
  serviceValue: numeric("service_value", { precision: 12, scale: 2 }).notNull().default("0"),
  serviceStartedAt: timestamp("service_started_at"),
  serviceCompletedAt: timestamp("service_completed_at"),
  observations: text("observations"),
  checklist: jsonb("checklist").notNull().default([]),
  photos: jsonb("photos").notNull().default([]),
  technicianSignature: text("technician_signature"),
  clientSignature: text("client_signature"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("service_orders_status_idx").on(t.status),
  scheduledDateIdx: index("service_orders_scheduled_date_idx").on(t.scheduledDate),
  createdAtIdx: index("service_orders_created_at_idx").on(t.createdAt),
  technicianIdx: index("service_orders_technician_idx").on(t.technician),
}));

export const insertServiceOrderSchema = createInsertSchema(serviceOrdersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertServiceOrder = z.infer<typeof insertServiceOrderSchema>;
export type ServiceOrder = typeof serviceOrdersTable.$inferSelect;
