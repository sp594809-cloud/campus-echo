import { createHash, randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { and, eq, gt } from "drizzle-orm";
import { db, radarSocketTicketsTable } from "@workspace/db";
import { WebSocket, WebSocketServer } from "ws";
import { logger } from "./logger";
import { getRequestHost } from "../lib/requestHost";

const SOCKET_TICKET_LIFETIME_MS = 30_000;
const socketsByUserId = new Map<string, Set<WebSocket>>();

export type RadarSocketEvent = {
  type: string;
  [key: string]: unknown;
};

function hashTicket(ticket: string): string {
  return createHash("sha256").update(ticket).digest("hex");
}

export async function createRadarSocketTicket(
  userId: string,
): Promise<{ ticket: string; expiresAt: Date }> {
  const ticket = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SOCKET_TICKET_LIFETIME_MS);

  await db.insert(radarSocketTicketsTable).values({
    tokenHash: hashTicket(ticket),
    userId,
    expiresAt,
  });

  return { ticket, expiresAt };
}

async function consumeRadarSocketTicket(ticket: string): Promise<string | null> {
  const [record] = await db
    .delete(radarSocketTicketsTable)
    .where(
      and(
        eq(radarSocketTicketsTable.tokenHash, hashTicket(ticket)),
        gt(radarSocketTicketsTable.expiresAt, new Date()),
      ),
    )
    .returning({ userId: radarSocketTicketsTable.userId });

  return record?.userId ?? null;
}

function rejectUpgrade(socket: NodeJS.WritableStream, status: 401 | 403 | 404): void {
  const reason =
    status === 401
      ? "Unauthorized"
      : status === 403
        ? "Forbidden"
        : "Not Found";
  socket.end(
    `HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
}

function hasSameOrigin(request: import("node:http").IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const requestHost = getRequestHost(request);
    return (
      (originUrl.protocol === "https:" || originUrl.protocol === "http:") &&
      !!requestHost &&
      originUrl.host.toLowerCase() === requestHost.toLowerCase()
    );
  } catch {
    return false;
  }
}

function addSocket(userId: string, socket: WebSocket): void {
  const userSockets = socketsByUserId.get(userId) ?? new Set<WebSocket>();
  userSockets.add(socket);
  socketsByUserId.set(userId, userSockets);

  socket.on("close", () => {
    const current = socketsByUserId.get(userId);
    current?.delete(socket);
    if (current?.size === 0) socketsByUserId.delete(userId);
  });
  socket.on("error", (error) => {
    logger.debug({ err: error }, "Radar WebSocket ended with an error");
  });
  socket.on("message", () => {
    socket.close(1008, "Radar WebSocket is server-to-client only");
  });
  socket.send(JSON.stringify({ type: "connected" }));
}

export function sendRadarEvent(userId: string, event: RadarSocketEvent): void {
  const payload = JSON.stringify(event);
  for (const socket of socketsByUserId.get(userId) ?? []) {
    if (socket.readyState !== WebSocket.OPEN) continue;
    try {
      socket.send(payload);
    } catch (error) {
      logger.debug({ err: error }, "Unable to deliver a Radar WebSocket event");
    }
  }
}

export function broadcastRadarEvent(event: RadarSocketEvent): void {
  const payload = JSON.stringify(event);
  for (const sockets of socketsByUserId.values()) {
    for (const socket of sockets) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      try {
        socket.send(payload);
      } catch (error) {
        logger.debug({ err: error }, "Unable to broadcast a Radar WebSocket event");
      }
    }
  }
}

export function attachRadarWebSocket(server: Server): void {
  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 1024,
  });

  const heartbeat = setInterval(() => {
    for (const socket of websocketServer.clients) {
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    }
  }, 25_000);
  heartbeat.unref();
  websocketServer.on("close", () => clearInterval(heartbeat));

  server.on("upgrade", (request, socket, head) => {
    void (async () => {
      let pathname = "";
      let ticket = "";
      try {
        const url = new URL(request.url ?? "/", "http://localhost");
        pathname = url.pathname;
        ticket = url.searchParams.get("ticket") ?? "";
      } catch {
        rejectUpgrade(socket, 404);
        return;
      }

      if (pathname !== "/ws") {
        rejectUpgrade(socket, 404);
        return;
      }
      if (!hasSameOrigin(request)) {
        rejectUpgrade(socket, 403);
        return;
      }
      if (ticket.length < 40 || ticket.length > 100) {
        rejectUpgrade(socket, 401);
        return;
      }

      let userId: string | null;
      try {
        userId = await consumeRadarSocketTicket(ticket);
      } catch (error) {
        logger.error({ err: error }, "Unable to validate a Radar WebSocket ticket");
        rejectUpgrade(socket, 401);
        return;
      }
      if (!userId) {
        rejectUpgrade(socket, 401);
        return;
      }

      websocketServer.handleUpgrade(request, socket, head, (client) => {
        addSocket(userId, client);
      });
    })().catch((error: unknown) => {
      logger.error({ err: error }, "Radar WebSocket upgrade failed");
      if (!socket.destroyed) rejectUpgrade(socket, 401);
    });
  });
}