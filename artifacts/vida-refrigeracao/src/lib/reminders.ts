import { useEffect, useRef, useState, useCallback } from "react";
import { useListServiceOrders, getListServiceOrdersQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const FIRED_KEY = "vr-fired-reminders-v1";
const PERMISSION_KEY = "vr-notif-permission-asked";

const SERVICE_TYPE_LABEL: Record<string, string> = {
  installation: "Instalação",
  maintenance: "Manutenção",
  repair: "Reparo",
  cleaning: "Limpeza",
  inspection: "Vistoria",
};

function loadFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveFired(fired: Set<string>) {
  try {
    // Keep only last 200 entries to avoid unbounded growth
    const arr = Array.from(fired).slice(-200);
    localStorage.setItem(FIRED_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

function reminderKey(orderId: number, scheduledDate: string, startTime: string, reminderMinutes: number) {
  return `${orderId}|${scheduledDate}|${startTime}|${reminderMinutes}`;
}

function fireSystemNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, tag: title, icon: "/favicon.ico" });
    setTimeout(() => n.close(), 15000);
  } catch {
    /* ignore */
  }
}

export function useReminderPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  });

  const request = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      localStorage.setItem(PERMISSION_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  return { permission, request };
}

/**
 * Background reminder runner. Polls service orders every 60s and fires
 * a toast + browser Notification when the reminder window is reached.
 * Should be mounted once at the app root after auth is established.
 */
export function ReminderRunner() {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const firedRef = useRef<Set<string>>(loadFired());

  const enabled = !!user && can("calendar", "view");

  // Refresh every minute so we can pick up new orders/edits.
  const { data: orders } = useListServiceOrders(undefined, {
    query: {
      enabled,
      queryKey: getListServiceOrdersQueryKey(undefined),
      refetchInterval: 60_000,
      staleTime: 30_000,
    },
  });

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (!orders || orders.length === 0) return;
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      for (const o of orders) {
        if (!o.reminderEnabled || !o.startTime || !o.scheduledDate) continue;
        if (o.status === "completed") continue;

        // Only consider orders for today (avoid spamming for past/future dates)
        const dateStr = o.scheduledDate.split("T")[0];
        if (dateStr !== todayStr) continue;

        const [hh, mm] = o.startTime.split(":").map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) continue;

        const start = new Date(now);
        start.setHours(hh, mm, 0, 0);
        const triggerAt = new Date(start.getTime() - (o.reminderMinutes ?? 15) * 60_000);

        // Fire if we've passed the trigger time and we're not too far past the start
        // (5 minute grace period after start in case the app was just opened).
        const diffMs = now.getTime() - triggerAt.getTime();
        if (diffMs < 0) continue;
        if (now.getTime() > start.getTime() + 5 * 60_000) continue;

        const key = reminderKey(o.id, dateStr, o.startTime, o.reminderMinutes ?? 15);
        if (firedRef.current.has(key)) continue;

        firedRef.current.add(key);
        saveFired(firedRef.current);

        const minutesLabel =
          (o.reminderMinutes ?? 15) === 0
            ? "agora"
            : (o.reminderMinutes ?? 15) === 60
              ? "em 1 hora"
              : `em ${o.reminderMinutes} minutos`;

        const title = `Lembrete: OS ${minutesLabel}`;
        const tipo = SERVICE_TYPE_LABEL[o.serviceType] ?? o.serviceType;
        const body = `${o.startTime} • ${o.clientName} • ${tipo}\n${o.clientAddress}`;

        toast({
          title,
          description: body,
          duration: 12000,
        });
        fireSystemNotification(title, body);
      }
    };

    // Run immediately, then every 30s
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [orders, enabled, toast]);

  return null;
}
