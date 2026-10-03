import { sql } from 'drizzle-orm';
import { pgTable, serial, integer, text, varchar, timestamp, boolean, index, check, uniqueIndex } from 'drizzle-orm/pg-core';
import { campusesTable } from './campuses';
import { profilesTable } from './profiles';
import { postsTable } from './posts';

// A null postId is the campus public chat; otherwise this is a post reply.
export const discussionsTable = pgTable('discussions', {
  id: serial('id').primaryKey(),
  campusId: integer('campus_id').notNull().references(() => campusesTable.id, { onDelete: 'cascade' }),
  postId: integer('post_id').references(() => postsTable.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => profilesTable.userId, { onDelete: 'cascade' }),
  content: varchar('content', { length: 1000 }).notNull(),
  hidden: boolean('hidden').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, t => [
  index('discussions_campus_post_created_idx').on(t.campusId, t.postId, t.createdAt),
  index('discussions_expiration_idx').on(t.expiresAt),
  index('discussions_user_created_idx').on(t.userId, t.createdAt),
  check('discussions_content_nonempty', sql`length(trim(${t.content})) > 0`),
]);
export const discussionReportsTable = pgTable('discussion_reports', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull().references(() => discussionsTable.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => profilesTable.userId, { onDelete: 'cascade' }),
  reason: varchar('reason', { length: 200 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('discussion_reports_message_user_unique').on(t.messageId, t.userId)]);
