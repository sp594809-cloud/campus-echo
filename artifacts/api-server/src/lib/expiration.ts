import { lte, sql } from "drizzle-orm";
import {
  db,
  discussionsTable,
  pollsTable,
  postsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { publishCampusFeedUpdate } from "./feedEvents";

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export async function removeExpiredContent(): Promise<void> {
  const cutoff = new Date();
  await db.execute(sql`delete from public.echo_sessions where expires_at <= now()`);
  const [expiredPosts, expiredPolls] = await Promise.all([
    db
      .delete(postsTable)
      .where(lte(postsTable.expiresAt, cutoff))
      .returning({ campusId: postsTable.campusId }),
    db
      .delete(pollsTable)
      .where(lte(pollsTable.expiresAt, cutoff))
      .returning({ campusId: pollsTable.campusId }),
  ]);

  const expiredMessages = await db.delete(discussionsTable).where(lte(discussionsTable.expiresAt, cutoff)).returning({ campusId: discussionsTable.campusId });

  const affectedCampusIds = new Set([
    ...expiredMessages.map((message) => message.campusId),
    ...expiredPosts.map((post) => post.campusId),
    ...expiredPolls.map((poll) => poll.campusId),
  ]);
  for (const campusId of affectedCampusIds) publishCampusFeedUpdate(campusId);
}

export function startExpirationCleanup(): void {
  void removeExpiredContent().catch((err) =>
    logger.error({ err }, "Initial expired-content cleanup failed"),
  );

  const timer = setInterval(() => {
    void removeExpiredContent().catch((err) =>
      logger.error({ err }, "Expired-content cleanup failed"),
    );
  }, CLEANUP_INTERVAL_MS);
  timer.unref();
}