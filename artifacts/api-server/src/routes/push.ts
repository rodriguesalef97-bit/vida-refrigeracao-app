import { Router } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { getVapidPublicKey, sendPushToUser } from "../lib/push";

const router = Router();

router.get("/push/vapid-public-key", (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(503).json({ error: "Push notifications não configuradas" });
  return res.json({ publicKey: key });
});

router.post("/push/subscribe", requireAuth, async (req, res) => {
  const userId = req.sessionUser?.id;
  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  const body = req.body ?? {};
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  const p256dh = body.keys && typeof body.keys.p256dh === "string" ? body.keys.p256dh : null;
  const auth = body.keys && typeof body.keys.auth === "string" ? body.keys.auth : null;
  const userAgent = typeof body.userAgent === "string" ? body.userAgent : null;
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: "Inscrição inválida" });
  }
  const keys = { p256dh, auth };

  const existing = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pushSubscriptionsTable)
      .set({
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? existing[0]!.userAgent,
        lastUsedAt: new Date(),
      })
      .where(eq(pushSubscriptionsTable.id, existing[0]!.id));
  } else {
    await db.insert(pushSubscriptionsTable).values({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    });
  }
  return res.json({ ok: true });
});

router.post("/push/unsubscribe", requireAuth, async (req, res) => {
  const userId = req.sessionUser?.id;
  if (!userId) return res.status(401).json({ error: "Não autenticado" });
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : null;
  if (!endpoint) return res.status(400).json({ error: "endpoint obrigatório" });
  await db
    .delete(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.endpoint, endpoint),
        eq(pushSubscriptionsTable.userId, userId),
      ),
    );
  return res.json({ ok: true });
});

router.post("/push/test", requireAuth, async (req, res) => {
  const userId = req.sessionUser?.id;
  if (!userId) return res.status(401).json({ error: "Não autenticado" });
  const delivered = await sendPushToUser(userId, {
    title: "🔔 Vida Refrigeração",
    body: "Notificações estão funcionando! Você receberá lembretes das suas OS.",
    tag: "test-notification",
    url: "/agenda",
  });
  return res.json({ delivered });
});

export default router;
