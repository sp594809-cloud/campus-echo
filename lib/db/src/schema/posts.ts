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

export const postsTable = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    campusId: integer("campus_id")
      .notNull()
      .references(() => campusesTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    content: varchar("content", { length: 280 }).notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("posts_campus_created_idx").on(table.campusId, table.createdAt),
    index("posts_expiration_idx").on(table.expiresAt),
    check("posts_content_nonempty", sql`length(trim(${table.content})) > 0`),
  ],
);

export const postVotesTable = pgTable(
  "post_votes",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("post_votes_post_user_unique").on(table.postId, table.userId),
    check("post_votes_value_valid", sql`${table.value} IN (-1, 1)`),
  ],
);

export const postReportsTable = pgTable(
  "post_reports",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("post_reports_post_user_unique").on(table.postId, table.userId),
  ],
);

export const insertPostSchema = createInsertSchema(postsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
export type PostVote = typeof postVotesTable.$inferSelect;
export type PostReport = typeof postReportsTable.$inferSelect;