import webpush from "web-push";
import { db, pushSubscriptionsTable, serviceOrdersTable } from "@workspace/db";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import { logger } from "./logger";

const VAPID_PUBLIC = process.env["VAPID_PUBLIC_KEY"];
const VAPID_PRIVATE = process.env["VAPID_PRIVATE_KEY"];
const VAPID_SUBJECT = process.env["VAPID_SUBJECT"] ?? "mailto:contato@vidarefrigeracao.local";

let pushReady = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  pushReady = true;
} else {
  logger.warn("VAPID keys missing — push notifications disabled");
}

export const isPushReady = () => pushReady;
export const getVapidPublicKey = () => VAPID_PUBLIC ?? null;

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export async function sendPushToUser(userId: number, payload: PushPayload): Promise<number> {
  if (!pushReady) return 0;

  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));

  let delivered = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
        { TTL: 60 * 60 } // 1h
      );
      delivered += 1;
      await db
        .update(pushSubscriptionsTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(pushSubscriptionsTable.id, sub.id));
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        // gone — clean up
        await db
          .delete(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.id, sub.id));
        logger.info({ userId, endpoint: sub.endpoint }, "removed stale push subscription");
      } else {
        logger.warn({ err, userId }, "push send failed");
      }
    }
  }
  return delivered;
}

// ---------- Reminder scheduler ----------
// In-memory dedup: orderId|date|startTime|reminderMinutes -> timestamp
const sentReminders = new Map<string, number>();
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000;

function cleanupSentReminders() {
  const now = Date.now();
  for (const [k, ts] of sentReminders) {
    if (now - ts > DEDUP_TTL_MS) sentReminders.delete(k);
  }
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export async function tickReminders(now: Date = new Date()): Promise<void> {
  if (!pushReady) return;
  cleanupSentReminders();

  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const orders = await db
    .select()
    .from(serviceOrdersTable)
    .where(
      and(
        eq(serviceOrdersTable.scheduledDate, todayStr),
        eq(serviceOrdersTable.reminderEnabled, true),
        isNotNull(serviceOrdersTable.startTime),
        ne(serviceOrdersTable.status, "completed")
      )
    );

  for (const o of orders) {
    if (!o.startTime) continue;
    const m = /^(\d{2}):(\d{2})$/.exec(o.startTime);
    if (!m) continue;

    const start = new Date(now);
    start.setHours(parseInt(m[1]!, 10), parseInt(m[2]!, 10), 0, 0);
    const minutesBefore = o.reminderMinutes ?? 15;
    const triggerAt = new Date(start.getTime() - minutesBefore * 60_000);

    // Only fire if we've reached trigger time and haven't passed start by more than 5 min
    if (now.getTime() < triggerAt.getTime()) continue;
    if (now.getTime() > start.getTime() + 5 * 60_000) continue;

    const dedupKey = `${o.id}|${todayStr}|${o.startTime}|${minutesBefore}`;
    if (sentReminders.has(dedupKey)) continue;

    // Identify user(s) to notify:
    //  1) any user whose name matches the assigned technician (case-insensitive, trimmed)
    //  2) fallback to all admins
    const { usersTable } = await import("@workspace/db");
    const allUsers = await db
      .select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
      .from(usersTable);
    const techNorm = (o.technician ?? "").trim().toLowerCase();
    let recipients = allUsers.filter(
      (u) => techNorm.length > 0 && u.name.trim().toLowerCase() === techNorm,
    );
    if (recipients.length === 0) {
      recipients = allUsers.filter((u) => u.role === "admin");
    }

    const minutesText =
      minutesBefore === 0
        ? "agora"
        : minutesBefore === 60
          ? "em 1 hora"
          : `em ${minutesBefore} minutos`;

    const lead =
      minutesBefore === 0
        ? "Sua ordem de serviço começa agora"
        : `Daqui ${minutesText} você tem uma ordem de serviço`;

    const lines = [
      `🕒 ${o.startTime}${o.endTime ? `–${o.endTime}` : ""}`,
      `👤 ${o.clientName}`,
      `🔧 ${o.serviceType}`,
      `📍 ${o.clientAddress}`,
    ].join("\n");

    const payload: PushPayload = {
      title: `🔔 OS ${o.orderNumber} — ${lead}`,
      body: lines,
      url: `/ordens/${o.id}`,
      tag: `os-reminder-${o.id}`,
      data: { orderId: o.id, type: "reminder" },
    };

    let total = 0;
    for (const r of recipients) {
      total += await sendPushToUser(r.id, payload);
    }
    if (total > 0) {
      sentReminders.set(dedupKey, Date.now());
    }
    logger.info(
      {
        orderId: o.id,
        orderNumber: o.orderNumber,
        technician: o.technician,
        recipients: recipients.length,
        delivered: total,
      },
      "reminder push processed",
    );
  }
}

let started = false;
export function startReminderScheduler(intervalMs = 30_000): void {
  if (started) return;
  started = true;
  // Tick once at startup, then every interval
  tickReminders().catch((err) => logger.error({ err }, "tickReminders failed"));
  setInterval(() => {
    tickReminders().catch((err) => logger.error({ err }, "tickReminders failed"));
  }, intervalMs);
  logger.info({ intervalMs }, "reminder scheduler started");
}
