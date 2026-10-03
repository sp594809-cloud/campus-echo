import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";
import { radarChatsTable } from "./radar";

export const radarChatReadsTable = pgTable(
  "radar_chat_reads",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => radarChatsTable.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "radar_chat_reads_pk",
      columns: [table.userId, table.chatId],
    }),
    index("radar_chat_reads_user_idx").on(table.userId),
  ],
);

export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: varchar("user_agent", { length: 300 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
    index("push_subscriptions_user_idx").on(table.userId),
  ],
);

export type RadarChatRead = typeof radarChatReadsTable.$inferSelect;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
