import { and, eq, gt, sql } from "drizzle-orm";
import {
  db,
  pollOptionsTable,
  pollReportsTable,
  pollVotesTable,
  pollsTable,
  profilesTable,
} from "@workspace/db";

export async function getPollView(pollId: number, userId: string) {
  const [poll] = await db
    .select({
      id: pollsTable.id,
      question: pollsTable.question,
      createdAt: pollsTable.createdAt,
      expiresAt: pollsTable.expiresAt,
      alias: profilesTable.alias,
    })
    .from(pollsTable)
    .innerJoin(profilesTable, eq(pollsTable.userId, profilesTable.userId))
    .where(
      and(
        eq(pollsTable.id, pollId),
        eq(pollsTable.hidden, false),
        gt(pollsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!poll) return null;

  const [options, counts, myVotes, reports] = await Promise.all([
    db
      .select()
      .from(pollOptionsTable)
      .where(eq(pollOptionsTable.pollId, pollId))
      .orderBy(pollOptionsTable.id),
    db
      .select({
        optionId: pollVotesTable.optionId,
        votes: sql<number>`count(*)::int`,
      })
      .from(pollVotesTable)
      .where(eq(pollVotesTable.pollId, pollId))
      .groupBy(pollVotesTable.optionId),
    db
      .select({ optionId: pollVotesTable.optionId })
      .from(pollVotesTable)
      .where(
        and(
          eq(pollVotesTable.pollId, pollId),
          eq(pollVotesTable.userId, userId),
        ),
      )
      .limit(1),
    db
      .select({ reportCount: sql<number>`count(*)::int` })
      .from(pollReportsTable)
      .where(eq(pollReportsTable.pollId, pollId)),
  ]);

  const countsByOption = new Map(counts.map((row) => [row.optionId, row.votes]));
  const totalVotes = counts.reduce((sum, row) => sum + row.votes, 0);

  return {
    ...poll,
    options: options.map((option) => {
      const votes = countsByOption.get(option.id) ?? 0;
      return {
        id: option.id,
        text: option.text,
        votes,
        percentage: totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100),
      };
    }),
    totalVotes,
    myVoteOptionId: myVotes[0]?.optionId ?? null,
    reportCount: reports[0]?.reportCount ?? 0,
  };
}