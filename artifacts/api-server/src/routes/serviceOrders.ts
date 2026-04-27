import { Router } from "express";
import { db, serviceOrdersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { ChecklistItem } from "@workspace/db";
import { requireAuth, requireArea } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

function generateOrderNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `OS-${year}${month}-${random}`;
}

const ALLOWED_REMINDER_MINUTES = [0, 5, 10, 15, 20, 25, 30, 60];

function isValidTimeStr(v: unknown): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}

function resolveTechnicians(order: typeof serviceOrdersTable.$inferSelect): string[] {
  const arr = (order.technicians as string[] | null) ?? [];
  if (Array.isArray(arr) && arr.length > 0) return arr;
  if (order.technician && order.technician.trim()) {
    return order.technician.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parseValue(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}

function durationMinutesFor(order: typeof serviceOrdersTable.$inferSelect): number | null {
  if (!order.serviceStartedAt || !order.serviceCompletedAt) return null;
  const ms = order.serviceCompletedAt.getTime() - order.serviceStartedAt.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 60000);
}

function formatOrder(order: typeof serviceOrdersTable.$inferSelect) {
  const technicians = resolveTechnicians(order);
  return {
    ...order,
    technicians,
    technician: technicians.join(", ") || order.technician,
    checklist: (order.checklist as ChecklistItem[]) ?? [],
    photos: (order.photos as string[]) ?? [],
    technicianSignature: order.technicianSignature ?? null,
    clientSignature: order.clientSignature ?? null,
    startTime: order.startTime ?? null,
    endTime: order.endTime ?? null,
    reminderEnabled: order.reminderEnabled ?? false,
    reminderMinutes: order.reminderMinutes ?? 15,
    serviceValue: Number(order.serviceValue ?? "0"),
    serviceStartedAt: order.serviceStartedAt ? order.serviceStartedAt.toISOString() : null,
    serviceCompletedAt: order.serviceCompletedAt ? order.serviceCompletedAt.toISOString() : null,
    durationMinutes: durationMinutesFor(order),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function formatOrderLite(order: typeof serviceOrdersTable.$inferSelect) {
  const photos = (order.photos as string[]) ?? [];
  const checklist = (order.checklist as ChecklistItem[]) ?? [];
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
    checklist,
    photos: [],
    photoCount: photos.length,
    hasTechnicianSignature: !!order.technicianSignature,
    hasClientSignature: !!order.clientSignature,
    technicianSignature: null,
    clientSignature: null,
    serviceValue: Number(order.serviceValue ?? "0"),
    serviceStartedAt: order.serviceStartedAt ? order.serviceStartedAt.toISOString() : null,
    serviceCompletedAt: order.serviceCompletedAt ? order.serviceCompletedAt.toISOString() : null,
    durationMinutes: durationMinutesFor(order),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

router.get("/service-orders", requireArea("orders", "view"), async (req, res) => {
  const { status, technician, dateFrom, dateTo } = req.query;

  const orders = await db
    .select()
    .from(serviceOrdersTable)
    .orderBy(desc(serviceOrdersTable.createdAt));

  let filtered = orders;
  if (status && typeof status === "string") {
    filtered = filtered.filter((o) => o.status === status);
  }
  if (technician && typeof technician === "string") {
    const needle = technician.toLowerCase();
    filtered = filtered.filter((o) => {
      const list = resolveTechnicians(o).map((t) => t.toLowerCase());
      return list.some((t) => t.includes(needle)) || o.technician.toLowerCase().includes(needle);
    });
  }
  if (dateFrom && typeof dateFrom === "string") {
    filtered = filtered.filter((o) => o.scheduledDate >= dateFrom);
  }
  if (dateTo && typeof dateTo === "string") {
    filtered = filtered.filter((o) => o.scheduledDate <= dateTo);
  }

  res.json(filtered.map(formatOrderLite));
});

router.post("/service-orders", requireArea("orders", "edit"), async (req, res) => {
  const {
    clientName,
    clientPhone,
    clientAddress,
    serviceType,
    technician,
    technicians,
    scheduledDate,
    startTime,
    endTime,
    reminderEnabled,
    reminderMinutes,
    equipmentCapacity,
    observations,
    checklist,
    serviceValue,
  } = req.body;

  // Normalize technicians: accept array (preferred) or fall back to single-string `technician`.
  let techList: string[] = [];
  if (Array.isArray(technicians)) {
    techList = technicians.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
  } else if (typeof technician === "string" && technician.trim()) {
    techList = technician.split(",").map((s) => s.trim()).filter(Boolean);
  }
  // Dedupe (case-insensitive) preserving first occurrence and original casing.
  {
    const seen = new Set<string>();
    techList = techList.filter((n) => {
      const k = n.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  if (
    !clientName ||
    !clientPhone ||
    !clientAddress ||
    !serviceType ||
    techList.length === 0 ||
    !scheduledDate ||
    !equipmentCapacity
  ) {
    res.status(400).json({ error: "Campos obrigatórios ausentes (inclua ao menos 1 técnico)" });
    return;
  }

  if (startTime != null && startTime !== "" && !isValidTimeStr(startTime)) {
    res.status(400).json({ error: "Horário de início inválido (use HH:MM)" });
    return;
  }
  if (endTime != null && endTime !== "" && !isValidTimeStr(endTime)) {
    res.status(400).json({ error: "Horário de finalização inválido (use HH:MM)" });
    return;
  }
  if (startTime && endTime && endTime <= startTime) {
    res.status(400).json({ error: "Horário de finalização deve ser posterior ao horário de início" });
    return;
  }
  const remEnabled = reminderEnabled === true;
  if (remEnabled && !startTime) {
    res.status(400).json({ error: "Para ativar o lembrete é necessário informar o horário de início" });
    return;
  }
  let parsedValue = "0";
  if (serviceValue !== undefined && serviceValue !== null && serviceValue !== "") {
    const v = parseValue(serviceValue);
    if (v === null) {
      res.status(400).json({ error: "Valor do serviço inválido (use um número >= 0)" });
      return;
    }
    parsedValue = v;
  }
  let remMin = 15;
  if (reminderMinutes !== undefined && reminderMinutes !== null) {
    const n = Number(reminderMinutes);
    if (!ALLOWED_REMINDER_MINUTES.includes(n)) {
      res.status(400).json({ error: "Antecedência do lembrete inválida" });
      return;
    }
    remMin = n;
  }

  const [order] = await db
    .insert(serviceOrdersTable)
    .values({
      orderNumber: generateOrderNumber(),
      clientName,
      clientPhone,
      clientAddress,
      serviceType,
      technician: techList.join(", "),
      technicians: techList,
      scheduledDate,
      startTime: startTime || null,
      endTime: endTime || null,
      reminderEnabled: remEnabled,
      reminderMinutes: remMin,
      status: "open",
      equipmentCapacity,
      observations: observations ?? null,
      checklist: checklist ?? [],
      photos: [],
      technicianSignature: null,
      clientSignature: null,
      serviceValue: parsedValue,
    })
    .returning();

  res.status(201).json(formatOrder(order));
});

router.get("/service-orders/:id", requireArea("orders", "view"), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const orders = await db
    .select()
    .from(serviceOrdersTable)
    .where(eq(serviceOrdersTable.id, id))
    .limit(1);

  const order = orders[0];
  if (!order) {
    res.status(404).json({ error: "Ordem de serviço não encontrada" });
    return;
  }

  res.json(formatOrder(order));
});

router.put("/service-orders/:id", requireArea("orders", "edit"), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const {
    clientName,
    clientPhone,
    clientAddress,
    serviceType,
    technician,
    technicians,
    scheduledDate,
    startTime,
    endTime,
    reminderEnabled,
    reminderMinutes,
    status,
    equipmentCapacity,
    observations,
    checklist,
    photos,
    technicianSignature,
    clientSignature,
    serviceValue,
  } = req.body;

  const updateData: Partial<typeof serviceOrdersTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (clientName !== undefined) updateData.clientName = clientName;
  if (clientPhone !== undefined) updateData.clientPhone = clientPhone;
  if (clientAddress !== undefined) updateData.clientAddress = clientAddress;
  if (serviceType !== undefined) updateData.serviceType = serviceType;
  if (technicians !== undefined) {
    if (!Array.isArray(technicians)) {
      res.status(400).json({ error: "Campo 'technicians' deve ser uma lista" });
      return;
    }
    let list = technicians.map((s: unknown) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
    const seen = new Set<string>();
    list = list.filter((n) => {
      const k = n.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (list.length === 0) {
      res.status(400).json({ error: "Selecione ao menos 1 técnico" });
      return;
    }
    updateData.technicians = list;
    updateData.technician = list.join(", ");
  } else if (technician !== undefined) {
    const single = typeof technician === "string" ? technician.trim() : "";
    if (!single) {
      res.status(400).json({ error: "Selecione ao menos 1 técnico" });
      return;
    }
    let list = single.split(",").map((s) => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    list = list.filter((n) => {
      const k = n.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    updateData.technician = list.join(", ");
    updateData.technicians = list;
  }
  if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate;
  if (startTime !== undefined) {
    if (startTime !== null && startTime !== "" && !isValidTimeStr(startTime)) {
      res.status(400).json({ error: "Horário de início inválido (use HH:MM)" });
      return;
    }
    updateData.startTime = startTime || null;
  }
  if (endTime !== undefined) {
    if (endTime !== null && endTime !== "" && !isValidTimeStr(endTime)) {
      res.status(400).json({ error: "Horário de finalização inválido (use HH:MM)" });
      return;
    }
    updateData.endTime = endTime || null;
  }
  if (updateData.startTime && updateData.endTime && updateData.endTime <= updateData.startTime) {
    res.status(400).json({ error: "Horário de finalização deve ser posterior ao horário de início" });
    return;
  }
  if (reminderEnabled !== undefined) updateData.reminderEnabled = reminderEnabled === true;
  if (reminderMinutes !== undefined && reminderMinutes !== null) {
    const n = Number(reminderMinutes);
    if (!ALLOWED_REMINDER_MINUTES.includes(n)) {
      res.status(400).json({ error: "Antecedência do lembrete inválida" });
      return;
    }
    updateData.reminderMinutes = n;
  }
  if (status !== undefined) updateData.status = status;
  if (equipmentCapacity !== undefined) updateData.equipmentCapacity = equipmentCapacity;
  if (observations !== undefined) updateData.observations = observations;
  if (checklist !== undefined) updateData.checklist = checklist;
  if (photos !== undefined) updateData.photos = photos;
  if (technicianSignature !== undefined) updateData.technicianSignature = technicianSignature;
  if (clientSignature !== undefined) updateData.clientSignature = clientSignature;
  if (serviceValue !== undefined) {
    const parsed = parseValue(serviceValue);
    if (parsed === null) {
      res.status(400).json({ error: "Valor do serviço inválido (use um número >= 0)" });
      return;
    }
    updateData.serviceValue = parsed;
  }

  // Server-side validation for completion: enforce all mandatory items
  if (status === "completed") {
    const existing = await db
      .select()
      .from(serviceOrdersTable)
      .where(eq(serviceOrdersTable.id, id))
      .limit(1);
    const current = existing[0];
    if (!current) {
      res.status(404).json({ error: "Ordem de serviço não encontrada" });
      return;
    }

    const finalPhotos = (photos !== undefined ? photos : (current.photos as string[])) ?? [];
    const finalObservations = observations !== undefined ? observations : current.observations;
    const finalChecklist = (checklist !== undefined ? checklist : (current.checklist as ChecklistItem[])) ?? [];
    const finalTechSignature = technicianSignature !== undefined ? technicianSignature : current.technicianSignature;

    const missing: string[] = [];
    if (!Array.isArray(finalPhotos) || finalPhotos.length === 0) {
      missing.push("pelo menos 1 foto");
    }
    if (!finalObservations || String(finalObservations).trim().length === 0) {
      missing.push("observações");
    }
    if (!Array.isArray(finalChecklist) || finalChecklist.length === 0 || !finalChecklist.every((i) => i.checked)) {
      missing.push("checklist completo");
    }
    if (!finalTechSignature || String(finalTechSignature).trim().length === 0) {
      missing.push("assinatura do técnico");
    }
    if (!current.serviceStartedAt) {
      missing.push("hora de início do serviço");
    }

    if (missing.length > 0) {
      res.status(400).json({
        error: `Não é possível concluir a ordem de serviço. Itens obrigatórios faltando: ${missing.join(", ")}.`,
      });
      return;
    }
  }

  const [updated] = await db
    .update(serviceOrdersTable)
    .set(updateData)
    .where(eq(serviceOrdersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Ordem de serviço não encontrada" });
    return;
  }

  res.json(formatOrder(updated));
});

// POST /service-orders/:id/start — marca início real do serviço (cronômetro).
router.post("/service-orders/:id/start", requireArea("orders", "edit"), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const [current] = await db
    .select()
    .from(serviceOrdersTable)
    .where(eq(serviceOrdersTable.id, id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Ordem de serviço não encontrada" });
    return;
  }
  if (current.status === "completed") {
    res.status(400).json({ error: "OS já concluída — não pode ser reiniciada" });
    return;
  }
  if (current.serviceStartedAt) {
    res.status(400).json({ error: "Serviço já foi iniciado anteriormente" });
    return;
  }
  const [updated] = await db
    .update(serviceOrdersTable)
    .set({
      serviceStartedAt: new Date(),
      status: current.status === "open" ? "in_progress" : current.status,
      updatedAt: new Date(),
    })
    .where(eq(serviceOrdersTable.id, id))
    .returning();
  res.json(formatOrder(updated));
});

// POST /service-orders/:id/finish — marca fim do serviço, valida tudo e conclui a OS.
router.post("/service-orders/:id/finish", requireArea("orders", "edit"), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const [current] = await db
    .select()
    .from(serviceOrdersTable)
    .where(eq(serviceOrdersTable.id, id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Ordem de serviço não encontrada" });
    return;
  }
  if (current.status === "completed") {
    res.status(400).json({ error: "OS já está concluída" });
    return;
  }
  if (!current.serviceStartedAt) {
    res.status(400).json({
      error: "Inicie o serviço antes de finalizá-lo (clique em 'Iniciar serviço').",
    });
    return;
  }

  const photos = (current.photos as string[]) ?? [];
  const checklist = (current.checklist as ChecklistItem[]) ?? [];
  const missing: string[] = [];
  if (photos.length === 0) missing.push("pelo menos 1 foto");
  if (!current.observations || current.observations.trim().length === 0) {
    missing.push("observações");
  }
  if (checklist.length === 0 || !checklist.every((i) => i.checked)) {
    missing.push("checklist completo");
  }
  if (!current.technicianSignature || current.technicianSignature.trim().length === 0) {
    missing.push("assinatura do técnico");
  }
  if (missing.length > 0) {
    res.status(400).json({
      error: `Não é possível finalizar. Itens obrigatórios faltando: ${missing.join(", ")}.`,
    });
    return;
  }

  const [updated] = await db
    .update(serviceOrdersTable)
    .set({
      serviceCompletedAt: new Date(),
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(serviceOrdersTable.id, id))
    .returning();
  res.json(formatOrder(updated));
});

router.delete("/service-orders/:id", requireArea("orders", "edit"), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  await db.delete(serviceOrdersTable).where(eq(serviceOrdersTable.id, id));
  res.json({ message: "Ordem de serviço removida com sucesso" });
});

export default router;
