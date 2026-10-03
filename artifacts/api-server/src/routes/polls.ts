import { and, eq, gt, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreatePollBody,
  CreatePollResponse,
  ReportPollBody,
  ReportPollParams,
  ReportPollResponse,
  VoteOnPollBody,
  VoteOnPollParams,
  VoteOnPollResponse,
} from "@workspace/api-zod";
import {
  db,
  pollOptionsTable,
  pollReportsTable,
  pollVotesTable,
  pollsTable,
} from "@workspace/db";
import { authenticatedUserId, requireAuth } from "../lib/auth";
import { getCommunityHub } from "../lib/community";
import { publishCampusFeedUpdate } from "../lib/feedEvents";
import { getPollView } from "../lib/pollViews";
import { ensureProfile } from "../lib/profiles";

const router: IRouter = Router();
const CONTENT_LIFETIME_MS = 24 * 60 * 60 * 1000;

router.post("/polls", requireAuth, async (req, res): Promise<void> => {
  const body = CreatePollBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid poll." });
    return;
  }
  const question = body.data.question.trim();
  const options = body.data.options.map((option) => option.trim());
  if (
    !question ||
    options.some((option) => !option) ||
    new Set(options.map((option) => option.toLowerCase())).size !== options.length
  ) {
    res.status(400).json({
      error: "Add a question and 2–4 distinct, non-empty poll options.",
    });
    return;
  }

  const nearest = await getCommunityHub();
  if (!nearest) { res.status(503).json({ error: "The community is not configured yet." }); return; }

  const userId = authenticatedUserId(res);
  const profile = await ensureProfile(userId);
  const createdAt = new Date();
  const result = await db.transaction(async (tx) => {
    const [poll] = await tx
      .insert(pollsTable)
      .values({
        campusId: nearest.hub.id,
        userId,
        question,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + CONTENT_LIFETIME_MS),
      })
      .returning();
    const insertedOptions = await tx
      .insert(pollOptionsTable)
      .values(options.map((text) => ({ pollId: poll.id, text })))
      .returning();
    return { poll, options: insertedOptions };
  });

  publishCampusFeedUpdate(nearest.hub.id);
  res.status(201).json(
    CreatePollResponse.parse({
      id: result.poll.id,
      alias: profile.alias,
      question: result.poll.question,
      options: result.options.map((option) => ({
        id: option.id,
        text: option.text,
        votes: 0,
        percentage: 0,
      })),
      createdAt: result.poll.createdAt,
      expiresAt: result.poll.expiresAt,
      totalVotes: 0,
      myVoteOptionId: null,
      reportCount: 0,
    }),
  );
});

router.put("/polls/:pollId/vote", requireAuth, async (req, res): Promise<void> => {
  const params = VoteOnPollParams.safeParse(req.params);
  const body = VoteOnPollBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid poll vote." });
    return;
  }
  const [poll] = await db
    .select({
      id: pollsTable.id,
      campusId: pollsTable.campusId,
    })
    .from(pollsTable)
    .where(
      and(
        eq(pollsTable.id, params.data.pollId),
        eq(pollsTable.hidden, false),
        gt(pollsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!poll) {
    res.status(404).json({ error: "That poll is no longer available." });
    return;
  }

  const nearest = await getCommunityHub();
  if (!nearest) { res.status(503).json({ error: "The community is not configured yet." }); return; }

  const [option] = await db
    .select({ id: pollOptionsTable.id })
    .from(pollOptionsTable)
    .where(
      and(
        eq(pollOptionsTable.id, body.data.optionId),
        eq(pollOptionsTable.pollId, poll.id),
      ),
    )
    .limit(1);
  if (!option) {
    res.status(404).json({ error: "That poll option does not exist." });
    return;
  }

  const userId = authenticatedUserId(res);
  await ensureProfile(userId);
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(pollVotesTable)
      .where(
        and(
          eq(pollVotesTable.pollId, poll.id),
          eq(pollVotesTable.userId, userId),
        ),
      )
      .limit(1);
    if (existing) {
      await tx
        .update(pollVotesTable)
        .set({ optionId: option.id, createdAt: new Date() })
        .where(eq(pollVotesTable.id, existing.id));
    } else {
      await tx.insert(pollVotesTable).values({
        pollId: poll.id,
        optionId: option.id,
        userId,
      });
    }
  });

  const view = await getPollView(poll.id, userId);
  if (!view) {
    res.status(404).json({ error: "That poll is no longer available." });
    return;
  }
  publishCampusFeedUpdate(poll.campusId);
  res.json(VoteOnPollResponse.parse(view));
});

router.post("/polls/:pollId/report", requireAuth, async (req, res): Promise<void> => {
  const params = ReportPollParams.safeParse(req.params);
  const body = ReportPollBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid poll report." });
    return;
  }
  const [poll] = await db
    .select({
      id: pollsTable.id,
      campusId: pollsTable.campusId,
    })
    .from(pollsTable)
    .where(
      and(
        eq(pollsTable.id, params.data.pollId),
        eq(pollsTable.hidden, false),
        gt(pollsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!poll) {
    res.status(404).json({ error: "That poll is no longer available." });
    return;
  }

  const nearest = await getCommunityHub();
  if (!nearest) { res.status(503).json({ error: "The community is not configured yet." }); return; }

  const userId = authenticatedUserId(res);
  await ensureProfile(userId);
  try {
    const result = await db.transaction(async (tx) => {
      await tx.insert(pollReportsTable).values({
        pollId: poll.id,
        userId,
        reason: body.data.reason,
      });
      const [countRow] = await tx
        .select({ reportCount: sql<number>`count(*)::int` })
        .from(pollReportsTable)
        .where(eq(pollReportsTable.pollId, poll.id));
      const reportCount = countRow?.reportCount ?? 0;
      const hidden = reportCount >= 5;
      if (hidden) {
        await tx
          .update(pollsTable)
          .set({ hidden: true })
          .where(eq(pollsTable.id, poll.id));
      }
      return { reportCount, hidden };
    });

    publishCampusFeedUpdate(poll.campusId);
    res.json(
      ReportPollResponse.parse({
        reported: true,
        reportCount: result.reportCount,
        hidden: result.hidden,
      }),
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "You have already reported this poll." });
      return;
    }
    throw err;
  }
});

export default router;