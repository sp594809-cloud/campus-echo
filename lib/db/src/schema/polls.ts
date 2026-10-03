import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campusesTable } from "./campuses";
import { profilesTable } from "./profiles";

export const pollsTable = pgTable(
  "polls",
  {
    id: serial("id").primaryKey(),
    campusId: integer("campus_id")
      .notNull()
      .references(() => campusesTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    question: varchar("question", { length: 200 }).notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("polls_campus_created_idx").on(table.campusId, table.createdAt),
    index("polls_expiration_idx").on(table.expiresAt),
    check("polls_question_nonempty", sql`length(trim(${table.question})) > 0`),
  ],
);

export const pollOptionsTable = pgTable(
  "poll_options",
  {
    id: serial("id").primaryKey(),
    pollId: integer("poll_id")
      .notNull()
      .references(() => pollsTable.id, { onDelete: "cascade" }),
    text: varchar("text", { length: 100 }).notNull(),
  },
  (table) => [index("poll_options_poll_idx").on(table.pollId)],
);

export const pollVotesTable = pgTable(
  "poll_votes",
  {
    id: serial("id").primaryKey(),
    pollId: integer("poll_id")
      .notNull()
      .references(() => pollsTable.id, { onDelete: "cascade" }),
    optionId: integer("option_id")
      .notNull()
      .references(() => pollOptionsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("poll_votes_poll_user_unique").on(table.pollId, table.userId),
  ],
);

export const pollReportsTable = pgTable(
  "poll_reports",
  {
    id: serial("id").primaryKey(),
    pollId: integer("poll_id")
      .notNull()
      .references(() => pollsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("poll_reports_poll_user_unique").on(table.pollId, table.userId),
  ],
);

export const insertPollSchema = createInsertSchema(pollsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPoll = z.infer<typeof insertPollSchema>;
export type Poll = typeof pollsTable.$inferSelect;
export type PollOption = typeof pollOptionsTable.$inferSelect;
export type PollVote = typeof pollVotesTable.$inferSelect;
export type PollReport = typeof pollReportsTable.$inferSelect;