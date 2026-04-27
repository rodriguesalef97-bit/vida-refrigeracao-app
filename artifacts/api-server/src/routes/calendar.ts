import { Router } from "express";
import { db, serviceOrdersTable } from "@workspace/db";
import type { ChecklistItem } from "@workspace/db";
import { requireAuth, requireArea } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

function resolveTechnicians(order: typeof serviceOrdersTable.$inferSelect): string[] {
  const arr = (order.technicians as string[] | null) ?? [];
  if (Array.isArray(arr) && arr.length > 0) return arr;
  if (order.technician && order.technician.trim()) {
    return order.technician.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function formatOrderLite(order: typeof serviceOrdersTable.$inferSelect) {
  const photos = (order.photos as string[]) ?? [];
  const technicians = resolveTechnicians(order);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    clientName: order.clientName,
    clientPhone: order.clientPhone,
    clientAddress: order.clientAddress,
    serviceType: order.serviceType,
    technician: technicians.join(", ") || order.technician,
    technicians,
    scheduledDate: order.scheduledDate,
    startTime: order.startTime ?? null,
    endTime: order.endTime ?? null,
    reminderEnabled: order.reminderEnabled ?? false,
    reminderMinutes: order.reminderMinutes ?? 15,
    status: order.status,
    equipmentCapacity: order.equipmentCapacity,
    observations: order.observations,
    checklist: (order.checklist as ChecklistItem[]) ?? [],
    photos: [],
    photoCount: photos.length,
    hasTechnicianSignature: !!order.technicianSignature,
    hasClientSignature: !!order.clientSignature,
    technicianSignature: null,
    clientSignature: null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

router.get("/calendar", requireArea("calendar", "view"), async (req, res) => {
  const { year, month, technician } = req.query;

  const orders = await db.select().from(serviceOrdersTable);

  let filtered = orders;

  if (year && month) {
    const y = parseInt(year as string);
    const m = parseInt(month as string);
    const firstDay = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0);
    const lastDayStr = `${y}-${String(m).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
    filtered = filtered.filter(
      (o) => o.scheduledDate >= firstDay && o.scheduledDate <= lastDayStr
    );
  }

  if (technician && typeof technician === "string") {
    const needle = technician.toLowerCase();
    filtered = filtered.filter((o) => {
      const list = resolveTechnicians(o).map((t) => t.toLowerCase());
      return list.some((t) => t.includes(needle)) || o.technician.toLowerCase().includes(needle);
    });
  }

  // Group by date
  const grouped = new Map<string, typeof serviceOrdersTable.$inferSelect[]>();
  for (const order of filtered) {
    const date = order.scheduledDate;
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(order);
  }

  // Sort by date and format
  const sortByStartTime = (a: typeof serviceOrdersTable.$inferSelect, b: typeof serviceOrdersTable.$inferSelect) => {
    const at = a.startTime ?? "99:99";
    const bt = b.startTime ?? "99:99";
    if (at !== bt) return at.localeCompare(bt);
    return a.id - b.id;
  };

  const result = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, orders]) => ({
      date,
      orders: orders.sort(sortByStartTime).map(formatOrderLite),
    }));

  res.json(result);
});

export default router;
