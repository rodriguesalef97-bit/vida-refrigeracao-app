import { pgTable, text, serial, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const CLIENT_TYPES = ["pessoa_fisica", "pessoa_juridica"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_ORIGINS = ["manual", "conta_azul"] as const;
export type ClientOrigin = (typeof CLIENT_ORIGINS)[number];

export const clientsTable = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    clientType: text("client_type").notNull().default("pessoa_fisica"),
    document: text("document").notNull(),
    phone: text("phone"),
    email: text("email"),
    cep: text("cep"),
    address: text("address"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    neighborhood: text("neighborhood"),
    city: text("city"),
    state: text("state"),
    location: text("location"),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    origin: text("origin").notNull().default("manual"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    documentIdx: uniqueIndex("clients_document_idx").on(t.document),
    statusIdx: index("clients_status_idx").on(t.status),
    nameIdx: index("clients_name_idx").on(t.name),
  }),
);

export const insertClientSchema = createInsertSchema(clientsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
