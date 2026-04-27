import { useCallback, useEffect, useState } from "react";

const BASE = (import.meta as any).env?.BASE_URL ?? "/";
const apiUrl = (path: string) => `${BASE.replace(/\/$/, "")}${path}`;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushStatus =
  | "unsupported"
  | "denied"
  | "default"
  | "subscribed"
  | "permission-granted-not-subscribed"
  | "checking";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    if (Notification.permission === "default") {
      setStatus("default");
      return;
    }
    const reg = await getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setStatus(sub ? "subscribed" : "permission-granted-not-subscribed");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!isPushSupported()) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        await refresh();
        return false;
      }
      const keyRes = await fetch(apiUrl("/api/push/vapid-public-key"), {
        credentials: "include",
      });
      if (!keyRes.ok) throw new Error("vapid key unavailable");
      const { publicKey } = await keyRes.json();

      const reg = await getRegistration();
      if (!reg) throw new Error("no service worker");

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      const subJson = sub.toJSON();
      await postJson("/api/push/subscribe", {
        endpoint: sub.endpoint,
        keys: subJson.keys,
        userAgent: navigator.userAgent,
      });
      await refresh();
      return true;
    } catch (err) {
      console.warn("[push] subscribe failed", err);
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        try {
          await postJson("/api/push/unsubscribe", { endpoint });
        } catch (_e) {
          // ignore — local unsubscribe still happened
        }
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const sendTest = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/push/test"), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      return data?.delivered ?? 0;
    } catch {
      return 0;
    }
  }, []);

  return { status, busy, refresh, subscribe, unsubscribe, sendTest };
}
