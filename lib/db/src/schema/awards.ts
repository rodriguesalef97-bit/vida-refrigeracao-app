import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const awardGoalsTable = pgTable("award_goals", {
  id: serial("id").primaryKey(),
  period: text("period").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  pointsRequired: numeric("points_required", { precision: 10, scale: 1 }).notNull().default("0"),
  prizeValue: numeric("prize_value", { precision: 12, scale: 2 }).notNull().default("0"),
  prizeDescription: text("prize_description"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const awardsTable = pgTable("awards", {
  id: serial("id").primaryKey(),
  technicianName: text("technician_name").notNull(),
  employeeId: integer("employee_id"),
  title: text("title").notNull(),
  description: text("description"),
  awardedAt: text("awarded_at").notNull(),
  value: numeric("value", { precision: 12, scale: 2 }).notNull().default("0"),
  goalId: integer("goal_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAwardGoalSchema = createInsertSchema(awardGoalsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAwardSchema = createInsertSchema(awardsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAwardGoal = z.infer<typeof insertAwardGoalSchema>;
export type AwardGoal = typeof awardGoalsTable.$inferSelect;
export type InsertAward = z.infer<typeof insertAwardSchema>;
export type Award = typeof awardsTable.$inferSelect;
