import { Router } from "express";
import { db, serviceOrdersTable, getServicePoints } from "@workspace/db";
import { desc } from "drizzle-orm";
import type { ChecklistItem } from "@workspace/db";
import { requireArea } from "../middleware/auth";

const router = Router();

function resolveTechnicians(order: typeof serviceOrdersTable.$inferSelect): string[] {
  const arr = (order.technicians as string[] | null) ?? [];
  if (Array.isArray(arr) && arr.length > 0) return arr;
  if (order.technician && order.technician.trim()) {
    return order.technician.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

interface TechRow {
  technician: string;
  services: number;
  hours: number;
  points: number;
  revenue: number;
  productivity: number;
  revenuePerHour: number;
}

function aggregate(
  orders: (typeof serviceOrdersTable.$inferSelect)[],
  from: Date | null,
  to: Date | null,
): TechRow[] {
  const map = new Map<string, TechRow>();

  for (const o of orders) {
    if (o.status !== "completed") continue;
    if (!o.serviceStartedAt || !o.serviceCompletedAt) continue;

    const completedAt = o.serviceCompletedAt;
    if (from && completedAt < from) continue;
    if (to && completedAt > to) continue;

    const techs = resolveTechnicians(o);
    if (techs.length === 0) continue;

    const minutes = Math.max(
      0,
      Math.round((completedAt.getTime() - o.serviceStartedAt.getTime()) / 60000),
    );
    const hours = minutes / 60;
    const totalPoints = getServicePoints(o.serviceType);
    const totalRevenue = Number(o.serviceValue ?? "0");
    const share = 1 / techs.length;

    for (const t of techs) {
      const key = t.toLowerCase();
      const row = map.get(key) ?? {
        technician: t,
        services: 0,
        hours: 0,
        points: 0,
        revenue: 0,
        productivity: 0,
        revenuePerHour: 0,
      };
      row.services += 1;
      row.hours += hours * share;
      row.points += totalPoints * share;
      row.revenue += totalRevenue * share;
      map.set(key, row);
    }
  }

  for (const row of map.values()) {
    row.hours = Math.round(row.hours * 100) / 100;
    row.points = Math.round(row.points * 10) / 10;
    row.revenue = Math.round(row.revenue * 100) / 100;
    row.productivity = row.hours > 0 ? Math.round((row.points / row.hours) * 100) / 100 : 0;
    row.revenuePerHour = row.hours > 0 ? Math.round((row.revenue / row.hours) * 100) / 100 : 0;
  }

  return Array.from(map.values()).sort((a, b) => b.productivity - a.productivity);
}

function parseDateParam(v: unknown, endOfDay = false): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v.length === 10 ? `${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : v);
  return isNaN(d.getTime()) ? null : d;
}

router.get("/productivity", requireArea("reports", "view"), async (req, res) => {
  const from = parseDateParam(req.query.from, false);
  const to = parseDateParam(req.query.to, true);

  const orders = await db
    .select()
    .from(serviceOrdersTable)
    .orderBy(desc(serviceOrdersTable.serviceCompletedAt));

  const rows = aggregate(orders, from, to);

  const totals = rows.reduce(
    (acc, r) => {
      acc.services += r.services;
      acc.hours += r.hours;
      acc.points += r.points;
      acc.revenue += r.revenue;
      return acc;
    },
    { services: 0, hours: 0, points: 0, revenue: 0 },
  );
  totals.hours = Math.round(totals.hours * 100) / 100;
  totals.points = Math.round(totals.points * 10) / 10;
  totals.revenue = Math.round(totals.revenue * 100) / 100;

  res.json({
    from: from ? from.toISOString() : null,
    to: to ? to.toISOString() : null,
    totals,
    rows,
  });
});

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",;\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtNum(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace(".", ",");
}

router.get("/productivity/export", requireArea("reports", "view"), async (req, res) => {
  const from = parseDateParam(req.query.from, false);
  const to = parseDateParam(req.query.to, true);

  const orders = await db.select().from(serviceOrdersTable);
  const rows = aggregate(orders, from, to);

  const header = [
    "Técnico",
    "Horas trabalhadas",
    "Quantidade de serviços",
    "Pontuação",
    "Faturamento (R$)",
    "Produtividade (pts/h)",
    "Faturamento por hora (R$/h)",
  ];

  const lines = [header.join(";")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.technician),
        fmtNum(r.hours, 2),
        String(r.services),
        fmtNum(r.points, 1),
        fmtNum(r.revenue, 2),
        fmtNum(r.productivity, 2),
        fmtNum(r.revenuePerHour, 2),
      ].join(";"),
    );
  }

  const periodLabel =
    from && to
      ? `${from.toISOString().slice(0, 10)}_a_${to.toISOString().slice(0, 10)}`
      : "geral";

  // BOM for Excel UTF-8 support
  const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="produtividade_${periodLabel}.csv"`,
  );
  res.send(csv);
});

// Rota auxiliar para o detalhe da OS exibir os pontos sem precisar duplicar a tabela.
router.get("/productivity/service-points", requireArea("orders", "view"), async (_req, res) => {
  res.json({
    cleaning: getServicePoints("cleaning"),
    maintenance: getServicePoints("maintenance"),
    installation: getServicePoints("installation"),
    repair: getServicePoints("repair"),
    inspection: getServicePoints("inspection"),
  });
});

// Workaround para evitar warning de import não utilizado
void ({} as ChecklistItem | undefined);

export default router;
