import { Router, type IRouter } from "express";
import { authenticatedUserId, requireAuth } from "../lib/auth";
import {
  getVapidPublicKey,
  removePushSubscription,
  savePushSubscription,
} from "../lib/pushService";

const router: IRouter = Router();

router.get("/push/vapid-public-key", (_req, res): void => {
  const key = getVapidPublicKey();
  if (!key) {
    res.status(503).json({ error: "Web push is not configured on this server." });
    return;
  }
  res.json({ publicKey: key });
});

router.post("/push/subscribe", requireAuth, async (req, res): Promise<void> => {
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  const p256dh = typeof req.body?.keys?.p256dh === "string" ? req.body.keys.p256dh : "";
  const auth = typeof req.body?.keys?.auth === "string" ? req.body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: "Invalid push subscription." });
    return;
  }
  const result = await savePushSubscription(
    authenticatedUserId(res),
    endpoint,
    { p256dh, auth },
    typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
  );
  res.status(201).json(result);
});

router.post("/push/unsubscribe", requireAuth, async (req, res): Promise<void> => {
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  if (!endpoint) {
    res.status(400).json({ error: "Invalid endpoint." });
    return;
  }
  await removePushSubscription(authenticatedUserId(res), endpoint);
  res.sendStatus(204);
});

export default router;
