import type { Response } from "express";

const subscribers = new Map<number, Set<Response>>();

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