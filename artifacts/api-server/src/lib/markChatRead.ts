import { and, eq, or } from "drizzle-orm";
import { db, radarChatReadsTable, radarChatsTable } from "@workspace/db";
import { RadarServiceError } from "./radarService";

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

export async function markRadarChatRead(userId: string, chatId: string) {
  const chat = await getActiveChatForUser(userId, chatId);
  if (!chat) {
    throw new RadarServiceError(404, "That anonymous chat is no longer available.");
  }
  const now = new Date();
  await db
    .insert(radarChatReadsTable)
    .values({ userId, chatId, lastReadAt: now })
    .onConflictDoUpdate({
      target: [radarChatReadsTable.userId, radarChatReadsTable.chatId],
      set: { lastReadAt: now },
    });
  return { chatId, lastReadAt: now.toISOString() };
}
