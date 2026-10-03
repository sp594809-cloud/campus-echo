import type { Response } from "express";
import { logger } from "./logger";

const subscribers = new Map<number, Set<Response>>();

type RedisLike = {
  publish: (channel: string, message: string) => Promise<number>;
  subscribe: (channel: string, listener: (message: string) => void) => Promise<void>;
};

let redis: RedisLike | null = null;
let redisInitAttempted = false;

async function ensureRedis(): Promise<RedisLike | null> {
  if (redisInitAttempted) return redis;
  redisInitAttempted = true;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    // Optional dependency: only used when REDIS_URL is set.
    const { createClient } = await import("redis");
    const publisher = createClient({ url });
    const subscriber = createClient({ url });
    await publisher.connect();
    await subscriber.connect();
    await subscriber.subscribe("campus-feed", (message) => {
      try {
        const data = JSON.parse(message) as { campusId: number };
        if (typeof data.campusId === "number") {
          deliverLocal(data.campusId);
        }
      } catch {
        /* ignore malformed */
      }
    });
    redis = {
      publish: (channel, message) => publisher.publish(channel, message),
      subscribe: async () => undefined,
    };
    logger.info("Redis connected for multi-instance feed fan-out");
    return redis;
  } catch (error) {
    logger.warn({ err: error }, "REDIS_URL set but redis client unavailable; using in-process fan-out");
    return null;
  }
}

void ensureRedis();

function deliverLocal(campusId: number): void {
  const message = `event: update\ndata: ${JSON.stringify({ campusId, updatedAt: new Date().toISOString() })}\n\n`;
  for (const response of subscribers.get(campusId) ?? []) {
    if (response.writableEnded || response.destroyed) continue;
    try {
      response.write(message);
    } catch {
      subscribers.get(campusId)?.delete(response);
    }
  }
}

export function subscribeToCampusFeed(campusId: number, response: Response): () => void {
  const campusSubscribers = subscribers.get(campusId) ?? new Set<Response>();
  campusSubscribers.add(response);
  subscribers.set(campusId, campusSubscribers);

  response.status(200);
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();
  response.write("retry: 5000\n\n");

  const heartbeat = setInterval(() => {
    if (!response.writableEnded) response.write(": keep-alive\n\n");
  }, 25_000);

  return () => {
    clearInterval(heartbeat);
    const current = subscribers.get(campusId);
    current?.delete(response);
    if (current?.size === 0) subscribers.delete(campusId);
  };
}

export function publishCampusFeedUpdate(campusId: number): void {
  deliverLocal(campusId);
  void ensureRedis().then((client) => {
    if (!client) return;
    void client.publish("campus-feed", JSON.stringify({ campusId })).catch(() => undefined);
  });
}
