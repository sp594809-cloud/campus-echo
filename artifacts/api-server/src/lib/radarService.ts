import { randomUUID } from "node:crypto";
import {
  and,
  desc,
  eq,
  gte,
  gt,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  radarSocketTicketsTable,
  radarBlocksTable,
  radarChatsTable,
  radarMessagesTable,
  radarPingsTable,
  radarPresenceTable,
  radarReportsTable,
  type RadarPresence,
} from "@workspace/db";
import { ensureProfile } from "./profiles";
import { findNearestHub, isInsideHub } from "./geofencing";
import {
  coarseRadarLocation,
  haversineDistanceMeters,
  RADAR_MAX_ACCURACY_METERS,
  RADAR_RADIUS_METERS,
  roundRadarCoordinate,
} from "./radarGeo";
import {
  broadcastRadarEvent,
  sendRadarEvent,
  type RadarSocketEvent,
} from "./radarSockets";

const PRESENCE_TTL_MS = 90_000;
const PING_TTL_MS = 2 * 60_000;
const PING_WINDOW_MS = 5 * 60_000;
const PING_TARGET_COOLDOWN_MS = 10 * 60_000;
const MAX_PINGS_PER_WINDOW = 3;
const CHAT_MESSAGE_WINDOW_MS = 60_000;
const MAX_CHAT_MESSAGES_PER_WINDOW = 10;
const REPORT_WINDOW_MS = 60 * 60_000;
const MAX_REPORTS_PER_WINDOW = 5;
const VISIBLE_PING_HISTORY_MS = 7 * 24 * 60 * 60_000;

export class RadarServiceError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "RadarServiceError";
  }
}

type LocationInput = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

type PingStatus = "pending" | "accepted" | "declined" | "expired";
type ReportReason = "harassment" | "unsafe" | "spam" | "other";

function presenceChanged(): void {
  broadcastRadarEvent({ type: "presence_changed" });
}

async function activePresenceForUser(userId: string): Promise<RadarPresence | null> {
  const [presence] = await db
    .select()
    .from(radarPresenceTable)
    .where(
      and(
        eq(radarPresenceTable.userId, userId),
        gt(radarPresenceTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return presence ?? null;
}

async function blockedEitherWay(userA: string, userB: string): Promise<boolean> {
  const [block] = await db
    .select({ blockerUserId: radarBlocksTable.blockerUserId })
    .from(radarBlocksTable)
    .where(
      or(
        and(
          eq(radarBlocksTable.blockerUserId, userA),
          eq(radarBlocksTable.blockedUserId, userB),
        ),
        and(
          eq(radarBlocksTable.blockerUserId, userB),
          eq(radarBlocksTable.blockedUserId, userA),
        ),
      ),
    )
    .limit(1);
  return Boolean(block);
}

function pingSocketPayload(
  ping: { id: string; createdAt: Date; expiresAt: Date },
): RadarSocketEvent {
  return {
    type: "ping_received",
    ping: {
      pingId: ping.id,
      createdAt: ping.createdAt,
      expiresAt: ping.expiresAt,
      status: "pending",
      direction: "incoming",
      chatId: null,
    },
  };
}

export async function updateRadarPresence(
  userId: string,
  input: LocationInput,
): Promise<{ visible: true; accuracyMeters: number; expiresInSeconds: number }> {
  if (input.accuracyMeters > RADAR_MAX_ACCURACY_METERS) {
    await db
      .delete(radarPresenceTable)
      .where(eq(radarPresenceTable.userId, userId));
    presenceChanged();
    throw new RadarServiceError(
      422,
      "GPS accuracy is too low for the 100-meter radar. Try again outside or wait for a better fix.",
    );
  }

  const nearest = await findNearestHub(input.latitude, input.longitude);
  if (!nearest) throw new RadarServiceError(503, "No campus is configured yet. Ask the app owner to add your college before enabling Radar.");
  if (!isInsideHub(nearest)) {
    await db
      .delete(radarPresenceTable)
      .where(eq(radarPresenceTable.userId, userId));
    presenceChanged();
    throw new RadarServiceError(
      403,
      "Nearby visibility is available only within 2 km of a campus hub.",
    );
  }

  await ensureProfile(userId);
  const now = new Date();
  const existing = await activePresenceForUser(userId);
  const blipId =
    existing?.campusId === nearest.hub.id ? existing.blipId : randomUUID();
  const expiresAt = new Date(now.getTime() + PRESENCE_TTL_MS);

  await db
    .insert(radarPresenceTable)
    .values({
      userId,
      campusId: nearest.hub.id,
      blipId,
      latitude: roundRadarCoordinate(input.latitude),
      longitude: roundRadarCoordinate(input.longitude),
      accuracyMeters: Math.round(input.accuracyMeters),
      updatedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: radarPresenceTable.userId,
      set: {
        campusId: nearest.hub.id,
        blipId,
        latitude: roundRadarCoordinate(input.latitude),
        longitude: roundRadarCoordinate(input.longitude),
        accuracyMeters: Math.round(input.accuracyMeters),
        updatedAt: now,
        expiresAt,
      },
    });

  presenceChanged();
  return {
    visible: true,
    accuracyMeters: Math.round(input.accuracyMeters),
    expiresInSeconds: Math.floor(PRESENCE_TTL_MS / 1000),
  };
}

export async function hideRadarPresence(userId: string): Promise<void> {
  await db
    .delete(radarPresenceTable)
    .where(eq(radarPresenceTable.userId, userId));
  presenceChanged();
}

export async function getNearbyRadarBlips(
  userId: string,
  input: LocationInput,
) {
  if (input.accuracyMeters > RADAR_MAX_ACCURACY_METERS) {
    throw new RadarServiceError(
      422,
      "GPS accuracy is too low for the 100-meter radar.",
    );
  }

  const currentPresence = await activePresenceForUser(userId);
  if (!currentPresence) {
    throw new RadarServiceError(
      403,
      "Turn on nearby visibility to use the radar.",
    );
  }

  const nearest = await findNearestHub(input.latitude, input.longitude);
  if (
    !isInsideHub(nearest, currentPresence.campusId) ||
    haversineDistanceMeters(
      input.latitude,
      input.longitude,
      currentPresence.latitude,
      currentPresence.longitude,
    ) > 250
  ) {
    await hideRadarPresence(userId);
    throw new RadarServiceError(
      403,
      "Your current location no longer matches the active radar presence.",
    );
  }

  const candidates = await db
    .select({
      userId: radarPresenceTable.userId,
      blipId: radarPresenceTable.blipId,
      latitude: radarPresenceTable.latitude,
      longitude: radarPresenceTable.longitude,
    })
    .from(radarPresenceTable)
    .where(
      and(
        eq(radarPresenceTable.campusId, currentPresence.campusId),
        gt(radarPresenceTable.expiresAt, new Date()),
        lte(radarPresenceTable.accuracyMeters, RADAR_MAX_ACCURACY_METERS),
      ),
    );

  const blockRows = await db
    .select({
      blockerUserId: radarBlocksTable.blockerUserId,
      blockedUserId: radarBlocksTable.blockedUserId,
    })
    .from(radarBlocksTable)
    .where(
      or(
        eq(radarBlocksTable.blockerUserId, userId),
        eq(radarBlocksTable.blockedUserId, userId),
      ),
    );
  const hiddenUsers = new Set<string>();
  for (const block of blockRows) {
    hiddenUsers.add(
      block.blockerUserId === userId ? block.blockedUserId : block.blockerUserId,
    );
  }

  const blips = candidates.flatMap((candidate) => {
    if (candidate.userId === userId || hiddenUsers.has(candidate.userId)) {
      return [];
    }
    const coarse = coarseRadarLocation(
      currentPresence.latitude,
      currentPresence.longitude,
      candidate.latitude,
      candidate.longitude,
    );
    return coarse ? [{ blipId: candidate.blipId, ...coarse }] : [];
  });

  return {
    hub: nearest.hub,
    radiusMeters: RADAR_RADIUS_METERS,
    accuracyMeters: currentPresence.accuracyMeters,
    blips,
    checkedAt: new Date(),
  };
}

export async function sendRadarPing(
  senderUserId: string,
  blipId: string,
): Promise<{ ping: { id: string; createdAt: Date; expiresAt: Date } }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PING_TTL_MS);

  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`radar-ping:${senderUserId}`})::bigint)`,
    );
    const [sender] = await tx
      .select()
      .from(radarPresenceTable)
      .where(
        and(
          eq(radarPresenceTable.userId, senderUserId),
          gt(radarPresenceTable.expiresAt, now),
        ),
      )
      .limit(1)
      .for("update");
    const [recipient] = await tx
      .select()
      .from(radarPresenceTable)
      .where(
        and(
          eq(radarPresenceTable.blipId, blipId),
          gt(radarPresenceTable.expiresAt, now),
          lte(radarPresenceTable.accuracyMeters, RADAR_MAX_ACCURACY_METERS),
        ),
      )
      .limit(1);

    if (
      !sender ||
      !recipient ||
      sender.userId === recipient.userId ||
      sender.campusId !== recipient.campusId ||
      haversineDistanceMeters(
        sender.latitude,
        sender.longitude,
        recipient.latitude,
        recipient.longitude,
      ) > RADAR_RADIUS_METERS
    ) {
      throw new RadarServiceError(404, "That nearby signal is no longer available.");
    }

    const [block] = await tx
      .select({ blockerUserId: radarBlocksTable.blockerUserId })
      .from(radarBlocksTable)
      .where(
        or(
          and(
            eq(radarBlocksTable.blockerUserId, senderUserId),
            eq(radarBlocksTable.blockedUserId, recipient.userId),
          ),
          and(
            eq(radarBlocksTable.blockerUserId, recipient.userId),
            eq(radarBlocksTable.blockedUserId, senderUserId),
          ),
        ),
      )
      .limit(1);
    if (block) {
      throw new RadarServiceError(404, "That nearby signal is no longer available.");
    }

    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(radarPingsTable)
      .where(
        and(
          eq(radarPingsTable.senderUserId, senderUserId),
          gte(
            radarPingsTable.createdAt,
            new Date(now.getTime() - PING_WINDOW_MS),
          ),
        ),
      );
    if ((countRow?.count ?? 0) >= MAX_PINGS_PER_WINDOW) {
      throw new RadarServiceError(
        429,
        "You have reached the Ping limit. Please wait a few minutes.",
      );
    }

    const [recentPairPing] = await tx
      .select({ id: radarPingsTable.id, status: radarPingsTable.status })
      .from(radarPingsTable)
      .where(
        and(
          eq(radarPingsTable.senderUserId, senderUserId),
          eq(radarPingsTable.recipientUserId, recipient.userId),
          gte(
            radarPingsTable.createdAt,
            new Date(now.getTime() - PING_TARGET_COOLDOWN_MS),
          ),
        ),
      )
      .limit(1);
    if (recentPairPing) {
      throw new RadarServiceError(
        recentPairPing.status === "pending" ? 409 : 429,
        recentPairPing.status === "pending"
          ? "A Ping to this person is already waiting for a response."
          : "You recently sent a Ping to this person. Try again later.",
      );
    }

    const pingId = randomUUID();
    const [ping] = await tx
      .insert(radarPingsTable)
      .values({
        id: pingId,
        senderUserId,
        recipientUserId: recipient.userId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        expiresAt,
      })
      .onConflictDoNothing()
      .returning({
        id: radarPingsTable.id,
        createdAt: radarPingsTable.createdAt,
        expiresAt: radarPingsTable.expiresAt,
      });

    if (!ping) {
      throw new RadarServiceError(
        409,
        "A Ping to this person is already waiting for a response.",
      );
    }
    return { ping, recipientUserId: recipient.userId };
  });

  sendRadarEvent(result.recipientUserId, pingSocketPayload(result.ping));
  return { ping: result.ping };
}

type PingActionResult = {
  pingId: string;
  status: "accepted" | "declined";
  chatId: string | null;
};

export async function acceptRadarPing(
  recipientUserId: string,
  pingId: string,
): Promise<PingActionResult> {
  const outcome = await db.transaction(async (tx) => {
    const [ping] = await tx
      .select()
      .from(radarPingsTable)
      .where(
        and(
          eq(radarPingsTable.id, pingId),
          eq(radarPingsTable.recipientUserId, recipientUserId),
        ),
      )
      .limit(1)
      .for("update");

    if (!ping) return { kind: "missing" as const };
    if (ping.status === "accepted") {
      const [existingChat] = await tx
        .select({ id: radarChatsTable.id })
        .from(radarChatsTable)
        .where(eq(radarChatsTable.pingId, ping.id))
        .limit(1);
      return {
        kind: "accepted" as const,
        ping,
        chatId: existingChat?.id ?? null,
      };
    }
    if (ping.status !== "pending") {
      return { kind: "conflict" as const };
    }
    if (ping.expiresAt <= new Date()) {
      await tx
        .update(radarPingsTable)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(radarPingsTable.id, ping.id));
      return { kind: "conflict" as const };
    }

    const [block] = await tx
      .select({ blockerUserId: radarBlocksTable.blockerUserId })
      .from(radarBlocksTable)
      .where(
        or(
          and(
            eq(radarBlocksTable.blockerUserId, ping.senderUserId),
            eq(radarBlocksTable.blockedUserId, ping.recipientUserId),
          ),
          and(
            eq(radarBlocksTable.blockerUserId, ping.recipientUserId),
            eq(radarBlocksTable.blockedUserId, ping.senderUserId),
          ),
        ),
      )
      .limit(1);
    if (block) return { kind: "conflict" as const };

    const chatId = randomUUID();
    await tx.insert(radarChatsTable).values({
      id: chatId,
      pingId: ping.id,
      participantOneUserId: ping.senderUserId,
      participantTwoUserId: ping.recipientUserId,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await tx
      .update(radarPingsTable)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(radarPingsTable.id, ping.id));
    return { kind: "accepted" as const, ping, chatId };
  });

  if (outcome.kind === "missing") {
    throw new RadarServiceError(404, "That Ping is no longer available.");
  }
  if (outcome.kind === "conflict") {
    throw new RadarServiceError(409, "That Ping is no longer waiting for a response.");
  }
  if (!outcome.chatId) {
    throw new RadarServiceError(409, "The anonymous chat could not be opened.");
  }

  const result: PingActionResult = {
    pingId: outcome.ping.id,
    status: "accepted",
    chatId: outcome.chatId,
  };
  sendRadarEvent(outcome.ping.senderUserId, {
    type: "ping_updated",
    ...result,
  });
  return result;
}

export async function declineRadarPing(
  recipientUserId: string,
  pingId: string,
): Promise<PingActionResult> {
  const outcome = await db.transaction(async (tx) => {
    const [ping] = await tx
      .select()
      .from(radarPingsTable)
      .where(
        and(
          eq(radarPingsTable.id, pingId),
          eq(radarPingsTable.recipientUserId, recipientUserId),
        ),
      )
      .limit(1)
      .for("update");
    if (!ping) return { kind: "missing" as const };
    if (ping.status === "declined") {
      return { kind: "declined" as const, ping };
    }
    if (ping.status !== "pending") {
      return { kind: "conflict" as const };
    }
    if (ping.expiresAt <= new Date()) {
      await tx
        .update(radarPingsTable)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(radarPingsTable.id, ping.id));
      return { kind: "conflict" as const };
    }
    await tx
      .update(radarPingsTable)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(radarPingsTable.id, ping.id));
    return { kind: "declined" as const, ping };
  });

  if (outcome.kind === "missing") {
    throw new RadarServiceError(404, "That Ping is no longer available.");
  }
  if (outcome.kind === "conflict") {
    throw new RadarServiceError(409, "That Ping is no longer waiting for a response.");
  }

  const result: PingActionResult = {
    pingId: outcome.ping.id,
    status: "declined",
    chatId: null,
  };
  sendRadarEvent(outcome.ping.senderUserId, {
    type: "ping_updated",
    ...result,
  });
  return result;
}

export async function getRadarInbox(userId: string) {
  const now = new Date();
  await db
    .update(radarPingsTable)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(radarPingsTable.status, "pending"),
        lte(radarPingsTable.expiresAt, now),
      ),
    );

  const pingRows = await db
    .select()
    .from(radarPingsTable)
    .where(
      and(
        or(
          eq(radarPingsTable.senderUserId, userId),
          eq(radarPingsTable.recipientUserId, userId),
        ),
        gte(
          radarPingsTable.createdAt,
          new Date(now.getTime() - VISIBLE_PING_HISTORY_MS),
        ),
      ),
    )
    .orderBy(desc(radarPingsTable.createdAt))
    .limit(60);

  const pingIds = pingRows.map((ping) => ping.id);
  const linkedChats = pingIds.length
    ? await db
        .select({ pingId: radarChatsTable.pingId, chatId: radarChatsTable.id })
        .from(radarChatsTable)
        .where(inArray(radarChatsTable.pingId, pingIds))
    : [];
  const chatByPingId = new Map(
    linkedChats.map((chat) => [chat.pingId, chat.chatId]),
  );

  const chats = await db
    .select()
    .from(radarChatsTable)
    .where(
      and(
        eq(radarChatsTable.status, "active"),
        or(
          eq(radarChatsTable.participantOneUserId, userId),
          eq(radarChatsTable.participantTwoUserId, userId),
        ),
      ),
    )
    .orderBy(desc(radarChatsTable.updatedAt))
    .limit(50);

  const lastMessages = chats.length
    ? await db
        .selectDistinctOn([radarMessagesTable.chatId], {
          chatId: radarMessagesTable.chatId,
          text: radarMessagesTable.text,
        })
        .from(radarMessagesTable)
        .where(
          inArray(
            radarMessagesTable.chatId,
            chats.map((chat) => chat.id),
          ),
        )
        .orderBy(radarMessagesTable.chatId, desc(radarMessagesTable.sentAt))
    : [];
  const lastMessageByChatId = new Map(
    lastMessages.map((message) => [message.chatId, message.text]),
  );

  const toPingResponse = (
    ping: (typeof pingRows)[number],
    direction: "incoming" | "outgoing",
  ) => ({
    pingId: ping.id,
    createdAt: ping.createdAt,
    expiresAt: ping.expiresAt,
    status: ping.status as PingStatus,
    direction,
    chatId: chatByPingId.get(ping.id) ?? null,
  });

  return {
    incomingPings: pingRows
      .filter((ping) => ping.recipientUserId === userId)
      .map((ping) => toPingResponse(ping, "incoming")),
    outgoingPings: pingRows
      .filter((ping) => ping.senderUserId === userId)
      .map((ping) => toPingResponse(ping, "outgoing")),
    chats: chats.map((chat) => ({
      chatId: chat.id,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      lastMessage: lastMessageByChatId.get(chat.id) ?? null,
    })),
  };
}

async function getActiveChatForUser(userId: string, chatId: string) {
  const [chat] = await db
    .select()
    .from(radarChatsTable)
    .where(
      and(
        eq(radarChatsTable.id, chatId),
        eq(radarChatsTable.status, "active"),
        or(
          eq(radarChatsTable.participantOneUserId, userId),
          eq(radarChatsTable.participantTwoUserId, userId),
        ),
      ),
    )
    .limit(1);
  return chat ?? null;
}

export async function listRadarChatMessages(userId: string, chatId: string) {
  const chat = await getActiveChatForUser(userId, chatId);
  if (!chat) {
    throw new RadarServiceError(404, "That anonymous chat is no longer available.");
  }

  const rows = await db
    .select()
    .from(radarMessagesTable)
    .where(eq(radarMessagesTable.chatId, chatId))
    .orderBy(desc(radarMessagesTable.sentAt))
    .limit(50);
  return {
    chatId,
    messages: rows.reverse().map((message) => ({
      id: message.id,
      text: message.text,
      sentAt: message.sentAt,
      fromMe: message.senderUserId === userId,
    })),
  };
}

export async function sendRadarChatMessage(
  userId: string,
  chatId: string,
  rawText: string,
): Promise<{ message: { id: string; text: string; sentAt: Date; fromMe: true } }> {
  const text = rawText.trim();
  if (!text || text.length > 500) {
    throw new RadarServiceError(400, "Messages must contain 1 to 500 characters.");
  }
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`radar-chat:${userId}`})::bigint)`,
    );
    const [chat] = await tx
      .select()
      .from(radarChatsTable)
      .where(
        and(
          eq(radarChatsTable.id, chatId),
          eq(radarChatsTable.status, "active"),
          or(
            eq(radarChatsTable.participantOneUserId, userId),
            eq(radarChatsTable.participantTwoUserId, userId),
          ),
        ),
      )
      .limit(1)
      .for("update");
    if (!chat) {
      throw new RadarServiceError(404, "That anonymous chat is no longer available.");
    }
    const otherUserId =
      chat.participantOneUserId === userId
        ? chat.participantTwoUserId
        : chat.participantOneUserId;
    const [block] = await tx
      .select({ blockerUserId: radarBlocksTable.blockerUserId })
      .from(radarBlocksTable)
      .where(
        or(
          and(
            eq(radarBlocksTable.blockerUserId, userId),
            eq(radarBlocksTable.blockedUserId, otherUserId),
          ),
          and(
            eq(radarBlocksTable.blockerUserId, otherUserId),
            eq(radarBlocksTable.blockedUserId, userId),
          ),
        ),
      )
      .limit(1);
    if (block) {
      throw new RadarServiceError(404, "That anonymous chat is no longer available.");
    }

    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(radarMessagesTable)
      .where(
        and(
          eq(radarMessagesTable.senderUserId, userId),
          gte(
            radarMessagesTable.sentAt,
            new Date(now.getTime() - CHAT_MESSAGE_WINDOW_MS),
          ),
        ),
      );
    if ((countRow?.count ?? 0) >= MAX_CHAT_MESSAGES_PER_WINDOW) {
      throw new RadarServiceError(
        429,
        "You are sending messages too quickly. Please wait a moment.",
      );
    }

    const [message] = await tx
      .insert(radarMessagesTable)
      .values({
        id: randomUUID(),
        chatId,
        senderUserId: userId,
        text,
        sentAt: now,
      })
      .returning({
        id: radarMessagesTable.id,
        text: radarMessagesTable.text,
        sentAt: radarMessagesTable.sentAt,
      });
    await tx
      .update(radarChatsTable)
      .set({ updatedAt: now })
      .where(eq(radarChatsTable.id, chatId));
    return { message, otherUserId };
  });

  const message = { ...result.message, fromMe: true as const };
  sendRadarEvent(result.otherUserId, {
    type: "chat_message",
    chatId,
    message: { ...message, fromMe: false },
  });
  return { message };
}

async function closePairChatsAndPings(userA: string, userB: string): Promise<void> {
  const now = new Date();
  const closedChats = await db
    .update(radarChatsTable)
    .set({ status: "closed", updatedAt: now })
    .where(
      and(
        eq(radarChatsTable.status, "active"),
        or(
          and(
            eq(radarChatsTable.participantOneUserId, userA),
            eq(radarChatsTable.participantTwoUserId, userB),
          ),
          and(
            eq(radarChatsTable.participantOneUserId, userB),
            eq(radarChatsTable.participantTwoUserId, userA),
          ),
        ),
      ),
    )
    .returning({ chatId: radarChatsTable.id });
  for (const chat of closedChats) {
    sendRadarEvent(userA, { type: "chat_closed", chatId: chat.chatId });
    sendRadarEvent(userB, { type: "chat_closed", chatId: chat.chatId });
  }

  const declinedPings = await db
    .update(radarPingsTable)
    .set({ status: "declined", updatedAt: now })
    .where(
      and(
        eq(radarPingsTable.status, "pending"),
        or(
          and(
            eq(radarPingsTable.senderUserId, userA),
            eq(radarPingsTable.recipientUserId, userB),
          ),
          and(
            eq(radarPingsTable.senderUserId, userB),
            eq(radarPingsTable.recipientUserId, userA),
          ),
        ),
      ),
    )
    .returning({
      id: radarPingsTable.id,
      senderUserId: radarPingsTable.senderUserId,
      recipientUserId: radarPingsTable.recipientUserId,
    });
  for (const ping of declinedPings) {
    const otherUserId =
      ping.senderUserId === userA ? ping.recipientUserId : ping.senderUserId;
    sendRadarEvent(otherUserId, {
      type: "ping_updated",
      pingId: ping.id,
      status: "declined",
      chatId: null,
    });
  }
}

export async function blockRadarUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  if (blockerUserId === blockedUserId) {
    throw new RadarServiceError(404, "That participant is no longer available.");
  }
  await db
    .insert(radarBlocksTable)
    .values({ blockerUserId, blockedUserId })
    .onConflictDoNothing();
  await closePairChatsAndPings(blockerUserId, blockedUserId);
  presenceChanged();
}

export async function blockRadarBlip(
  userId: string,
  blipId: string,
): Promise<void> {
  const [target] = await db
    .select({ userId: radarPresenceTable.userId })
    .from(radarPresenceTable)
    .where(
      and(
        eq(radarPresenceTable.blipId, blipId),
        gt(radarPresenceTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!target) {
    throw new RadarServiceError(404, "That participant is no longer available.");
  }
  await blockRadarUser(userId, target.userId);
}

export async function blockRadarChatParticipant(
  userId: string,
  chatId: string,
): Promise<void> {
  const [chat] = await db
    .select()
    .from(radarChatsTable)
    .where(
      and(
        eq(radarChatsTable.id, chatId),
        or(
          eq(radarChatsTable.participantOneUserId, userId),
          eq(radarChatsTable.participantTwoUserId, userId),
        ),
      ),
    )
    .limit(1);
  if (!chat) {
    throw new RadarServiceError(404, "That anonymous chat is no longer available.");
  }
  const otherUserId =
    chat.participantOneUserId === userId
      ? chat.participantTwoUserId
      : chat.participantOneUserId;
  await blockRadarUser(userId, otherUserId);
}

async function createRadarReport(
  reporterUserId: string,
  reportedUserId: string,
  source: "radar" | "chat",
  reason: ReportReason,
  details?: string,
): Promise<void> {
  if (reporterUserId === reportedUserId) {
    throw new RadarServiceError(404, "That participant is no longer available.");
  }
  const now = new Date();
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(radarReportsTable)
    .where(
      and(
        eq(radarReportsTable.reporterUserId, reporterUserId),
        gte(
          radarReportsTable.createdAt,
          new Date(now.getTime() - REPORT_WINDOW_MS),
        ),
      ),
    );
  if ((countRow?.count ?? 0) >= MAX_REPORTS_PER_WINDOW) {
    throw new RadarServiceError(
      429,
      "You have reached the report limit. Please try again later.",
    );
  }
  await db.insert(radarReportsTable).values({
    id: randomUUID(),
    reporterUserId,
    reportedUserId,
    source,
    reason,
    details: details?.trim() || null,
    createdAt: now,
  });
}

export async function reportRadarBlip(
  userId: string,
  blipId: string,
  reason: ReportReason,
  details?: string,
): Promise<{ ok: true }> {
  const [target] = await db
    .select({ userId: radarPresenceTable.userId })
    .from(radarPresenceTable)
    .where(
      and(
        eq(radarPresenceTable.blipId, blipId),
        gt(radarPresenceTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!target) {
    throw new RadarServiceError(404, "That participant is no longer available.");
  }
  await createRadarReport(userId, target.userId, "radar", reason, details);
  return { ok: true };
}

export async function reportRadarChatParticipant(
  userId: string,
  chatId: string,
  reason: ReportReason,
  details?: string,
): Promise<{ ok: true }> {
  const [chat] = await db
    .select()
    .from(radarChatsTable)
    .where(
      and(
        eq(radarChatsTable.id, chatId),
        or(
          eq(radarChatsTable.participantOneUserId, userId),
          eq(radarChatsTable.participantTwoUserId, userId),
        ),
      ),
    )
    .limit(1);
  if (!chat) {
    throw new RadarServiceError(404, "That anonymous chat is no longer available.");
  }
  const otherUserId =
    chat.participantOneUserId === userId
      ? chat.participantTwoUserId
      : chat.participantOneUserId;
  await createRadarReport(userId, otherUserId, "chat", reason, details);
  return { ok: true };
}

export async function cleanupRadarData(): Promise<boolean> {
  const now = new Date();
  const deletedPresence = await db
    .delete(radarPresenceTable)
    .where(lte(radarPresenceTable.expiresAt, now))
    .returning({ userId: radarPresenceTable.userId });
  await db
    .update(radarPingsTable)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(radarPingsTable.status, "pending"),
        lte(radarPingsTable.expiresAt, now),
      ),
    );
  await db
    .delete(radarPingsTable)
    .where(
      and(
        lte(
          radarPingsTable.createdAt,
          new Date(now.getTime() - VISIBLE_PING_HISTORY_MS),
        ),
        inArray(radarPingsTable.status, ["declined", "expired"]),
      ),
    );
  await db
    .delete(radarSocketTicketsTable)
    .where(lte(radarSocketTicketsTable.expiresAt, now));

  if (deletedPresence.length > 0) presenceChanged();
  return deletedPresence.length > 0;
}