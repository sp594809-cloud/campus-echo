import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  discussionReportsTable,
  discussionsTable,
  pollReportsTable,
  pollsTable,
  postReportsTable,
  postsTable,
  profilesTable,
  radarReportsTable,
} from "@workspace/db";
import { RadarServiceError } from "./radarService";

export async function requireAdmin(userId: string): Promise<void> {
  const [profile] = await db
    .select({ isAdmin: profilesTable.isAdmin })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  if (!profile?.isAdmin) {
    throw new RadarServiceError(403, "Admin access required.");
  }
}

export async function getAdminQueue(userId: string) {
  await requireAdmin(userId);

  const [postReports, pollReports, discussionReports, radarReports, hiddenPosts, hiddenPolls, hiddenDiscussions] =
    await Promise.all([
      db
        .select({
          id: postReportsTable.id,
          postId: postReportsTable.postId,
          userId: postReportsTable.userId,
          reason: postReportsTable.reason,
          createdAt: postReportsTable.createdAt,
          content: postsTable.content,
          hidden: postsTable.hidden,
        })
        .from(postReportsTable)
        .leftJoin(postsTable, eq(postReportsTable.postId, postsTable.id))
        .orderBy(desc(postReportsTable.createdAt))
        .limit(100),
      db
        .select({
          id: pollReportsTable.id,
          pollId: pollReportsTable.pollId,
          userId: pollReportsTable.userId,
          reason: pollReportsTable.reason,
          createdAt: pollReportsTable.createdAt,
          question: pollsTable.question,
          hidden: pollsTable.hidden,
        })
        .from(pollReportsTable)
        .leftJoin(pollsTable, eq(pollReportsTable.pollId, pollsTable.id))
        .orderBy(desc(pollReportsTable.createdAt))
        .limit(100),
      db
        .select({
          id: discussionReportsTable.id,
          messageId: discussionReportsTable.messageId,
          userId: discussionReportsTable.userId,
          reason: discussionReportsTable.reason,
          createdAt: discussionReportsTable.createdAt,
          content: discussionsTable.content,
          hidden: discussionsTable.hidden,
        })
        .from(discussionReportsTable)
        .leftJoin(discussionsTable, eq(discussionReportsTable.messageId, discussionsTable.id))
        .orderBy(desc(discussionReportsTable.createdAt))
        .limit(100),
      db
        .select()
        .from(radarReportsTable)
        .orderBy(desc(radarReportsTable.createdAt))
        .limit(100),
      db.select().from(postsTable).where(eq(postsTable.hidden, true)).orderBy(desc(postsTable.createdAt)).limit(50),
      db.select().from(pollsTable).where(eq(pollsTable.hidden, true)).orderBy(desc(pollsTable.createdAt)).limit(50),
      db
        .select()
        .from(discussionsTable)
        .where(eq(discussionsTable.hidden, true))
        .orderBy(desc(discussionsTable.createdAt))
        .limit(50),
    ]);

  return {
    postReports,
    pollReports,
    discussionReports,
    radarReports,
    hiddenPosts,
    hiddenPolls,
    hiddenDiscussions,
  };
}

export async function setContentHidden(
  adminUserId: string,
  kind: "post" | "poll" | "discussion",
  id: number,
  hidden: boolean,
) {
  await requireAdmin(adminUserId);
  if (kind === "post") {
    await db.update(postsTable).set({ hidden }).where(eq(postsTable.id, id));
  } else if (kind === "poll") {
    await db.update(pollsTable).set({ hidden }).where(eq(pollsTable.id, id));
  } else {
    await db.update(discussionsTable).set({ hidden }).where(eq(discussionsTable.id, id));
  }
  return { kind, id, hidden };
}

export async function getMyAdminStatus(userId: string) {
  const [profile] = await db
    .select({ isAdmin: profilesTable.isAdmin })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  return { isAdmin: Boolean(profile?.isAdmin) };
}
