import { Router } from "express";
import { db, serviceOrdersTable } from "@workspace/db";
import { desc } from "drizzle-orm";
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

router.get("/dashboard/summary", requireArea("dashboard", "view"), async (_req, res) => {
  const orders = await db.select().from(serviceOrdersTable);

  const today = new Date().toISOString().split("T")[0];

  const totalOrders = orders.length;
  const openOrders = orders.filter((o) => o.status === "open").length;
  const inProgressOrders = orders.filter((o) => o.status === "in_progress").length;
  const completedOrders = orders.filter((o) => o.status === "completed").length;
  const todayOrders = orders.filter((o) => o.scheduledDate === today).length;

  // Count each individual technician across all OS (multi-technician aware).
  const technicianMap = new Map<string, number>();
  for (const order of orders) {
    const list = resolveTechnicians(order);
    for (const name of list) {
      technicianMap.set(name, (technicianMap.get(name) ?? 0) + 1);
    }
  }
  const technicianBreakdown = Array.from(technicianMap.entries()).map(
    ([technician, count]) => ({ technician, count })
  );

  const serviceTypeMap = new Map<string, number>();
  for (const order of orders) {
    serviceTypeMap.set(order.serviceType, (serviceTypeMap.get(order.serviceType) ?? 0) + 1);
  }
  const serviceTypeBreakdown = Array.from(serviceTypeMap.entries()).map(
    ([serviceType, count]) => ({ serviceType, count })
  );

  res.json({
    totalOrders,
    openOrders,
    inProgressOrders,
    completedOrders,
    todayOrders,
    technicianBreakdown,
    serviceTypeBreakdown,
  });
});

router.get("/dashboard/recent", requireArea("dashboard", "view"), async (_req, res) => {
  const orders = await db
    .select()
    .from(serviceOrdersTable)
    .orderBy(desc(serviceOrdersTable.createdAt))
    .limit(5);

  res.json(orders.map(formatOrderLite));
});

export default router;
