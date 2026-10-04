import { pgTable, uuid, text, varchar, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { profilesTable } from './profiles';
export const groupsTable = pgTable('echo_groups', {
  id: uuid('id').primaryKey(),
  name: varchar('name', {length: 60}).notNull(),
  description: varchar('description', {length: 240}).notNull().default(''),
  ownerId: text('owner_id').notNull().references(() => profilesTable.userId, {onDelete:'cascade'}),
  inviteHash: text('invite_hash').notNull().unique(),
  createdAt: timestamp('created_at', {withTimezone:true}).notNull().defaultNow(),
}, t => [index('echo_groups_owner_created_idx').on(t.ownerId,t.createdAt)]);
export const groupMembersTable = pgTable('echo_group_members', {
  id: uuid('id').primaryKey(),
  groupId: uuid('group_id').notNull().references(() => groupsTable.id,{onDelete:'cascade'}),
  userId: text('user_id').notNull().references(() => profilesTable.userId,{onDelete:'cascade'}),
  alias: varchar('alias',{length:48}).notNull(),
  banned: boolean('banned').notNull().default(false),
  removed: boolean('removed').notNull().default(false),
  joinedAt: timestamp('joined_at',{withTimezone:true}).notNull().defaultNow(),
}, t => [uniqueIndex('echo_member_group_user_unique').on(t.groupId,t.userId),index('echo_member_user_idx').on(t.userId)]);
export const groupMessagesTable = pgTable('echo_group_messages', {
  id: uuid('id').primaryKey(),
  groupId: uuid('group_id').notNull().references(() => groupsTable.id,{onDelete:'cascade'}),
  memberId: uuid('member_id').notNull().references(() => groupMembersTable.id,{onDelete:'cascade'}),
  content: varchar('content',{length:2000}).notNull(),
  hidden: boolean('hidden').notNull().default(false),
  createdAt: timestamp('created_at',{withTimezone:true,precision:3}).notNull().defaultNow(),
}, t => [index('echo_message_group_created_idx').on(t.groupId,t.createdAt,t.id),index('echo_message_member_created_idx').on(t.memberId,t.createdAt)]);
export const groupReportsTable = pgTable('echo_group_reports', {
  id: uuid('id').primaryKey(),
  messageId: uuid('message_id').notNull().references(() => groupMessagesTable.id,{onDelete:'cascade'}),
  reporterId: text('reporter_id').notNull().references(() => profilesTable.userId,{onDelete:'cascade'}),
  reason: varchar('reason',{length:200}).notNull(),
  createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
}, t => [uniqueIndex('echo_group_report_unique').on(t.messageId,t.reporterId)]);
