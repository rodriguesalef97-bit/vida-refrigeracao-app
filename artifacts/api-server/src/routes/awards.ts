import { Router } from "express";
import {
  db,
  awardGoalsTable,
  awardsTable,
  serviceOrdersTable,
  employeesTable,
  getServicePoints,
  hasAreaAccess,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireArea } from "../middleware/auth";

const router = Router();

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function periodValid(p: unknown): p is string {
  return typeof p === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

function dateValid(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function periodRange(period: string): { from: Date; to: Date } {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { from, to };
}

function resolveTechs(o: typeof serviceOrdersTable.$inferSelect): string[] {
  const arr = (o.technicians as string[] | null) ?? [];
  if (Array.isArray(arr) && arr.length > 0) return arr;
  if (o.technician && o.technician.trim()) {
    return o.technician.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

async function ownTechnicianName(userId: number): Promise<string | null> {
  const rows = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.userId, userId))
    .limit(1);
  return rows[0]?.fullName ?? null;
}

router.get("/award-goals", requireArea("awards", "view"), async (req, res) => {
  const period = req.query.period;
  let rows;
  if (typeof period === "string" && period) {
    rows = await db
      .select()
      .from(awardGoalsTable)
      .where(eq(awardGoalsTable.period, period))
      .orderBy(desc(awardGoalsTable.createdAt));
  } else {
    rows = await db.select().from(awardGoalsTable).orderBy(desc(awardGoalsTable.createdAt));
  }
  res.json(rows);
});

router.post("/award-goals", requireArea("awards", "admin"), async (req, res) => {
  const { period, title, description, pointsRequired, prizeValue, prizeDescription, status } =
    req.body ?? {};
  if (!periodValid(period)) {
    res.status(400).json({ error: "Período inválido (use YYYY-MM)" });
    return;
  }
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Título obrigatório" });
    return;
  }
  const pts = num(pointsRequired);
  const val = num(prizeValue);
  if (pts === null) {
    res.status(400).json({ error: "Pontos exigidos inválidos" });
    return;
  }
  if (val === null) {
    res.status(400).json({ error: "Valor do prêmio inválido" });
    return;
  }
  const [row] = await db
    .insert(awardGoalsTable)
    .values({
      period,
      title: title.trim(),
      description: description ?? null,
      pointsRequired: String(pts),
      prizeValue: String(val),
      prizeDescription: prizeDescription ?? null,
      status: status === "inactive" ? "inactive" : "active",
    })
    .returning();
  res.status(201).json(row);
});

router.put("/award-goals/:id", requireArea("awards", "admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const { period, title, description, pointsRequired, prizeValue, prizeDescription, status } =
    req.body ?? {};
  if (!periodValid(period)) {
    res.status(400).json({ error: "Período inválido (use YYYY-MM)" });
    return;
  }
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Título obrigatório" });
    return;
  }
  const pts = num(pointsRequired);
  const val = num(prizeValue);
  if (pts === null || val === null) {
    res.status(400).json({ error: "Pontos/valor inválidos" });
    return;
  }
  const [row] = await db
    .update(awardGoalsTable)
    .set({
      period,
      title: title.trim(),
      description: description ?? null,
      pointsRequired: String(pts),
      prizeValue: String(val),
      prizeDescription: prizeDescription ?? null,
      status: status === "inactive" ? "inactive" : "active",
      updatedAt: new Date(),
    })
    .where(eq(awardGoalsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Meta não encontrada" });
    return;
  }
  res.json(row);
});

router.delete("/award-goals/:id", requireArea("awards", "admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  await db.delete(awardGoalsTable).where(eq(awardGoalsTable.id, id));
  res.json({ message: "Meta removida" });
});

router.get("/awards", requireArea("awards", "view"), async (req, res) => {
  const user = req.sessionUser!;
  const isManager = hasAreaAccess(user, "awards", "admin");
  const period = typeof req.query.period === "string" ? req.query.period : null;

  let rows = await db.select().from(awardsTable).orderBy(desc(awardsTable.awardedAt));
  if (period && periodValid(period)) {
    rows = rows.filter((r) => r.awardedAt.startsWith(period));
  }
  if (!isManager) {
    const own = await ownTechnicianName(user.id);
    const candidates = new Set<string>();
    const addNameTokens = (n: string | null | undefined) => {
      if (!n) return;
      const norm = n.trim().toLowerCase();
      if (!norm) return;
      candidates.add(norm);
      const first = norm.split(/\s+/)[0];
      if (first) candidates.add(first);
    };
    addNameTokens(own);
    addNameTokens(user.name);
    addNameTokens(user.username);
    rows = rows.filter((r) => {
      const t = r.technicianName.trim().toLowerCase();
      if (candidates.has(t)) return true;
      const first = t.split(/\s+/)[0];
      return candidates.has(first);
    });
  }
  res.json(rows);
});

router.post("/awards", requireArea("awards", "admin"), async (req, res) => {
  const { technicianName, employeeId, title, description, awardedAt, value, goalId } =
    req.body ?? {};
  if (typeof technicianName !== "string" || !technicianName.trim()) {
    res.status(400).json({ error: "Nome do técnico obrigatório" });
    return;
  }
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Título obrigatório" });
    return;
  }
  if (!dateValid(awardedAt)) {
    res.status(400).json({ error: "Data inválida (use YYYY-MM-DD)" });
    return;
  }
  const v = num(value);
  if (v === null) {
    res.status(400).json({ error: "Valor inválido" });
    return;
  }
  const [row] = await db
    .insert(awardsTable)
    .values({
      technicianName: technicianName.trim(),
      employeeId: employeeId ?? null,
      title: title.trim(),
      description: description ?? null,
      awardedAt,
      value: String(v),
      goalId: goalId ?? null,
    })
    .returning();
  res.status(201).json(row);
});

router.delete("/awards/:id", requireArea("awards", "admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  await db.delete(awardsTable).where(eq(awardsTable.id, id));
  res.json({ message: "Prêmio removido" });
});

router.get("/awards/leaderboard", requireArea("awards", "view"), async (req, res) => {
  const period = req.query.period;
  if (!periodValid(period)) {
    res.status(400).json({ error: "Período inválido (use YYYY-MM)" });
    return;
  }
  const { from, to } = periodRange(period);

  const orders = await db.select().from(serviceOrdersTable);
  const map = new Map<
    string,
    { technician: string; services: number; hours: number; points: number; revenue: number }
  >();
  for (const o of orders) {
    if (o.status !== "completed") continue;
    if (!o.serviceStartedAt || !o.serviceCompletedAt) continue;
    if (o.serviceCompletedAt < from || o.serviceCompletedAt > to) continue;
    const techs = resolveTechs(o);
    if (techs.length === 0) continue;
    const minutes = Math.max(
      0,
      Math.round((o.serviceCompletedAt.getTime() - o.serviceStartedAt.getTime()) / 60000),
    );
    const hours = minutes / 60;
    const totalPoints = getServicePoints(o.serviceType);
    const totalRevenue = Number(o.serviceValue ?? "0");
    const share = 1 / techs.length;
    for (const t of techs) {
      const k = t.toLowerCase();
      const r = map.get(k) ?? {
        technician: t,
        services: 0,
        hours: 0,
        points: 0,
        revenue: 0,
      };
      r.services += 1;
      r.hours += hours * share;
      r.points += totalPoints * share;
      r.revenue += totalRevenue * share;
      map.set(k, r);
    }
  }

  const ranking = Array.from(map.values())
    .map((r) => ({
      technician: r.technician,
      services: r.services,
      hours: Math.round(r.hours * 100) / 100,
      points: Math.round(r.points * 10) / 10,
      revenue: Math.round(r.revenue * 100) / 100,
      productivity:
        r.hours > 0 ? Math.round((r.points / r.hours) * 100) / 100 : 0,
      revenuePerHour:
        r.hours > 0 ? Math.round((r.revenue / r.hours) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.points - a.points);

  const goals = await db
    .select()
    .from(awardGoalsTable)
    .where(and(eq(awardGoalsTable.period, period), eq(awardGoalsTable.status, "active")));

  const goalsResult = goals.map((g) => {
    const required = Number(g.pointsRequired);
    const winners = ranking
      .filter((r) => r.points >= required)
      .map((r) => ({ technician: r.technician, points: r.points }));
    return {
      goalId: g.id,
      goalTitle: g.title,
      pointsRequired: required,
      prizeValue: Number(g.prizeValue),
      prizeDescription: g.prizeDescription,
      winners,
    };
  });

  res.json({ period, ranking, goals: goalsResult });
});

export default router;
