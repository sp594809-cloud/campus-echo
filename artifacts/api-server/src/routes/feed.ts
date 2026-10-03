import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetFeedQueryParams,
  GetFeedResponse,
  SubscribeToFeedQueryParams,
} from "@workspace/api-zod";
import {
  db,
  pollOptionsTable,
  pollReportsTable,
  pollVotesTable,
  pollsTable,
  postReportsTable,
  postVotesTable,
  postsTable,
  profilesTable,
} from "@workspace/db";
import { authenticatedUserId, requireAuth } from "../lib/auth";
import { getCommunityHub } from "../lib/community";
import { subscribeToCampusFeed } from "../lib/feedEvents";

const router: IRouter = Router();
const FEED_PAGE_SIZE = 100;

router.get("/feed", requireAuth, async (req, res): Promise<void> => {
  const params = GetFeedQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = authenticatedUserId(res);
  const nearest = await getCommunityHub();
  if (!nearest) { res.status(503).json({ error: "The community is not configured yet." }); return; }

  const now = new Date();
  const [postRows, pollRows] = await Promise.all([
    db
      .select({
        id: postsTable.id,
        content: postsTable.content,
        createdAt: postsTable.createdAt,
        expiresAt: postsTable.expiresAt,
        alias: profilesTable.alias,
      })
      .from(postsTable)
      .innerJoin(profilesTable, eq(postsTable.userId, profilesTable.userId))
      .where(
        and(
          eq(postsTable.campusId, nearest.hub.id),
          eq(postsTable.hidden, false),
          gt(postsTable.expiresAt, now),
        ),
      )
      .orderBy(desc(postsTable.createdAt))
      .limit(FEED_PAGE_SIZE),
    db
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
          eq(pollsTable.campusId, nearest.hub.id),
          eq(pollsTable.hidden, false),
          gt(pollsTable.expiresAt, now),
        ),
      )
      .orderBy(desc(pollsTable.createdAt))
      .limit(FEED_PAGE_SIZE),
  ]);

  const postIds = postRows.map((post) => post.id);
  const pollIds = pollRows.map((poll) => poll.id);
  const [postVoteRows, postReportRows, options, pollVoteCounts, myPollVotes, pollReportRows] =
    await Promise.all([
      postIds.length
        ? db
            .select({
              postId: postVotesTable.postId,
              score: sql<number>`coalesce(sum(${postVotesTable.value}), 0)::int`,
              myVote: sql<number | null>`max(case when ${postVotesTable.userId} = ${userId} then ${postVotesTable.value} end)::int`,
            })
            .from(postVotesTable)
            .where(inArray(postVotesTable.postId, postIds))
            .groupBy(postVotesTable.postId)
        : Promise.resolve([]),
      postIds.length
        ? db
            .select({
              postId: postReportsTable.postId,
              reportCount: sql<number>`count(*)::int`,
            })
            .from(postReportsTable)
            .where(inArray(postReportsTable.postId, postIds))
            .groupBy(postReportsTable.postId)
        : Promise.resolve([]),
      pollIds.length
        ? db
            .select()
            .from(pollOptionsTable)
            .where(inArray(pollOptionsTable.pollId, pollIds))
            .orderBy(pollOptionsTable.id)
        : Promise.resolve([] as (typeof pollOptionsTable.$inferSelect)[]),
      pollIds.length
        ? db
            .select({
              pollId: pollVotesTable.pollId,
              optionId: pollVotesTable.optionId,
              votes: sql<number>`count(*)::int`,
            })
            .from(pollVotesTable)
            .where(inArray(pollVotesTable.pollId, pollIds))
            .groupBy(pollVotesTable.pollId, pollVotesTable.optionId)
        : Promise.resolve([]),
      pollIds.length
        ? db
            .select({
              pollId: pollVotesTable.pollId,
              optionId: pollVotesTable.optionId,
            })
            .from(pollVotesTable)
            .where(
              and(
                inArray(pollVotesTable.pollId, pollIds),
                eq(pollVotesTable.userId, userId),
              ),
            )
        : Promise.resolve([]),
      pollIds.length
        ? db
            .select({
              pollId: pollReportsTable.pollId,
              reportCount: sql<number>`count(*)::int`,
            })
            .from(pollReportsTable)
            .where(inArray(pollReportsTable.pollId, pollIds))
            .groupBy(pollReportsTable.pollId)
        : Promise.resolve([]),
    ]);

  const postVotesById = new Map(postVoteRows.map((row) => [row.postId, row]));
  const postReportsById = new Map(
    postReportRows.map((row) => [row.postId, row.reportCount]),
  );
  const optionVoteCounts = new Map(
    pollVoteCounts.map((row) => [`${row.pollId}:${row.optionId}`, row.votes]),
  );
  const myPollVotesById = new Map(myPollVotes.map((row) => [row.pollId, row.optionId]));
  const pollReportsById = new Map(
    pollReportRows.map((row) => [row.pollId, row.reportCount]),
  );

  const posts = postRows.map((post) => {
    const vote = postVotesById.get(post.id);
    return {
      ...post,
      score: vote?.score ?? 0,
      myVote: vote?.myVote ?? null,
      reportCount: postReportsById.get(post.id) ?? 0,
    };
  });

  const polls = pollRows.map((poll) => {
    const pollOptions = options.filter((option) => option.pollId === poll.id);
    const totalVotes = pollOptions.reduce(
      (total, option) =>
        total + (optionVoteCounts.get(`${poll.id}:${option.id}`) ?? 0),
      0,
    );

    return {
      ...poll,
      options: pollOptions.map((option) => {
        const votes = optionVoteCounts.get(`${poll.id}:${option.id}`) ?? 0;
        return {
          id: option.id,
          text: option.text,
          votes,
          percentage: totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100),
        };
      }),
      totalVotes,
      myVoteOptionId: myPollVotesById.get(poll.id) ?? null,
      reportCount: pollReportsById.get(poll.id) ?? 0,
    };
  });

  if (params.data.sort === "popular") {
    posts.sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime());
    polls.sort(
      (a, b) =>
        b.totalVotes - a.totalVotes || b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  res.json(
    GetFeedResponse.parse({
      hub: nearest.hub,
      distanceKm: null,
      posts,
      polls,
      updatedAt: new Date(),
    }),
  );
});

router.get("/feed/events", requireAuth, async (req, res): Promise<void> => {
  const params = SubscribeToFeedQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const nearest = await getCommunityHub();
  if (!nearest) { res.status(503).json({ error: "The community is not configured yet." }); return; }

  const unsubscribe = subscribeToCampusFeed(nearest.hub.id, res);
  res.on("close", unsubscribe);
});

export default router;