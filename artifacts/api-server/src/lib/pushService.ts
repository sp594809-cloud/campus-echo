import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { logger } from "./logger";

type PushKeys = { p256dh: string; auth: string };

export async function savePushSubscription(
  userId: string,
  endpoint: string,
  keys: PushKeys,
  userAgent?: string,
) {
  const existing = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint))
    .limit(1);

  const now = new Date();
  if (existing[0]) {
    await db
      .update(pushSubscriptionsTable)
      .set({
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent?.slice(0, 300) ?? null,
        updatedAt: now,
      })
      .where(eq(pushSubscriptionsTable.endpoint, endpoint));
    return { id: existing[0].id, endpoint };
  }

  const id = randomUUID();
  await db.insert(pushSubscriptionsTable).values({
    id,
    userId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    userAgent: userAgent?.slice(0, 300) ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return { id, endpoint };
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await db
    .delete(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));
  return { removed: true };
}

/**
 * Send a Web Push notification to all of a user's subscriptions.
 * Requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in env.
 * Uses the `web-push` package when available; otherwise logs and no-ops.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<number> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@campus-echo.local";
  if (!publicKey || !privateKey) {
    logger.info({ userId }, "Push skipped: VAPID keys not configured");
    return 0;
  }

  let webpush: typeof import("web-push") | null = null;
  try {
    webpush = await import("web-push");
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch {
    logger.warn("web-push package not installed; push delivery disabled");
    return 0;
  }

  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));

  let sent = 0;
  const body = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      );
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await db
          .delete(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
      } else {
        logger.warn({ err: error, endpoint: sub.endpoint }, "Push send failed");
      }
    }
  }
  return sent;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}
