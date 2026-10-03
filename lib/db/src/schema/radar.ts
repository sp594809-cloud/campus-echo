import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campusesTable } from "./campuses";
import { profilesTable } from "./profiles";

export const radarPresenceTable = pgTable(
  "radar_presence",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    campusId: integer("campus_id")
      .notNull()
      .references(() => campusesTable.id, { onDelete: "cascade" }),
    blipId: uuid("blip_id").notNull().unique(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    accuracyMeters: integer("accuracy_meters").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("radar_presence_campus_expiration_idx").on(
      table.campusId,
      table.expiresAt,
    ),
    index("radar_presence_expiration_idx").on(table.expiresAt),
    check(
      "radar_presence_accuracy_valid",
      sql`${table.accuracyMeters} BETWEEN 0 AND 75`,
    ),
    check(
      "radar_presence_coordinates_valid",
      sql`${table.latitude} BETWEEN -90 AND 90 AND ${table.longitude} BETWEEN -180 AND 180`,
    ),
  ],
);

export const radarPingsTable = pgTable(
  "radar_pings",
  {
    id: uuid("id").primaryKey(),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("radar_pings_sender_created_idx").on(
      table.senderUserId,
      table.createdAt,
    ),
    index("radar_pings_recipient_created_idx").on(
      table.recipientUserId,
      table.createdAt,
    ),
    uniqueIndex("radar_pings_one_pending_pair_unique")
      .on(table.senderUserId, table.recipientUserId)
      .where(sql`${table.status} = 'pending'`),
    check(
      "radar_pings_status_valid",
      sql`${table.status} IN ('pending', 'accepted', 'declined', 'expired')`,
    ),
    check("radar_pings_not_self", sql`${table.senderUserId} <> ${table.recipientUserId}`),
  ],
);

export const radarChatsTable = pgTable(
  "radar_chats",
  {
    id: uuid("id").primaryKey(),
    pingId: uuid("ping_id")
      .notNull()
      .unique()
      .references(() => radarPingsTable.id, { onDelete: "cascade" }),
    participantOneUserId: text("participant_one_user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    participantTwoUserId: text("participant_two_user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("radar_chats_participant_one_idx").on(table.participantOneUserId),
    index("radar_chats_participant_two_idx").on(table.participantTwoUserId),
    check(
      "radar_chats_status_valid",
      sql`${table.status} IN ('active', 'closed')`,
    ),
    check(
      "radar_chats_distinct_participants",
      sql`${table.participantOneUserId} <> ${table.participantTwoUserId}`,
    ),
  ],
);

export const radarMessagesTable = pgTable(
  "radar_messages",
  {
    id: uuid("id").primaryKey(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => radarChatsTable.id, { onDelete: "cascade" }),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    text: varchar("text", { length: 500 }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("radar_messages_chat_sent_idx").on(table.chatId, table.sentAt),
    check("radar_messages_nonempty", sql`length(trim(${table.text})) > 0`),
  ],
);

export const radarBlocksTable = pgTable(
  "radar_blocks",
  {
    blockerUserId: text("blocker_user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    blockedUserId: text("blocked_user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "radar_blocks_pk",
      columns: [table.blockerUserId, table.blockedUserId],
    }),
    check(
      "radar_blocks_not_self",
      sql`${table.blockerUserId} <> ${table.blockedUserId}`,
    ),
  ],
);

export const radarReportsTable = pgTable(
  "radar_reports",
  {
    id: uuid("id").primaryKey(),
    reporterUserId: text("reporter_user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    reportedUserId: text("reported_user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    source: varchar("source", { length: 16 }).notNull(),
    reason: varchar("reason", { length: 16 }).notNull(),
    details: varchar("details", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("radar_reports_created_idx").on(table.createdAt),
    index("radar_reports_target_created_idx").on(
      table.reportedUserId,
      table.createdAt,
    ),
    check(
      "radar_reports_source_valid",
      sql`${table.source} IN ('radar', 'chat')`,
    ),
    check(
      "radar_reports_reason_valid",
      sql`${table.reason} IN ('harassment', 'unsafe', 'spam', 'other')`,
    ),
    check(
      "radar_reports_not_self",
      sql`${table.reporterUserId} <> ${table.reportedUserId}`,
    ),
  ],
);

export const radarSocketTicketsTable = pgTable(
  "radar_socket_tickets",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("radar_socket_tickets_expiration_idx").on(table.expiresAt),
  ],
);

export const insertRadarPresenceSchema = createInsertSchema(radarPresenceTable).omit({
  updatedAt: true,
});
export type InsertRadarPresence = z.infer<typeof insertRadarPresenceSchema>;
export type RadarPresence = typeof radarPresenceTable.$inferSelect;
export type RadarPing = typeof radarPingsTable.$inferSelect;
export type RadarChat = typeof radarChatsTable.$inferSelect;
export type RadarMessage = typeof radarMessagesTable.$inferSelect;
export type RadarBlock = typeof radarBlocksTable.$inferSelect;
export type RadarReport = typeof radarReportsTable.$inferSelect;
export type RadarSocketTicket = typeof radarSocketTicketsTable.$inferSelect;