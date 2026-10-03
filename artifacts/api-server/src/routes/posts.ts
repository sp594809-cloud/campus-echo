import { and, eq, gt, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreatePostBody,
  CreatePostResponse,
  ReportPostBody,
  ReportPostParams,
  ReportPostResponse,
  VoteOnPostBody,
  VoteOnPostParams,
  VoteOnPostResponse,
} from "@workspace/api-zod";
import {
  db,
  postReportsTable,
  postVotesTable,
  postsTable,
} from "@workspace/db";
import { authenticatedUserId, requireAuth } from "../lib/auth";
import { findNearestHub, geofenceErrorPayload, isInsideHub } from "../lib/geofencing";
import { publishCampusFeedUpdate } from "../lib/feedEvents";
import { ensureProfile } from "../lib/profiles";

const router: IRouter = Router();
const CONTENT_LIFETIME_MS = 24 * 60 * 60 * 1000;

router.post("/posts", requireAuth, async (req, res): Promise<void> => {
  const body = CreatePostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid post." });
    return;
  }
  const content = body.data.content.trim();
  if (!content) {
    res.status(400).json({ error: "Post text cannot be empty." });
    return;
  }
  const nearest = await findNearestHub(body.data.latitude, body.data.longitude);
  if (!isInsideHub(nearest)) {
    res.status(403).json(geofenceErrorPayload(nearest));
    return;
  }

  const userId = authenticatedUserId(res);
  const profile = await ensureProfile(userId);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + CONTENT_LIFETIME_MS);
  const [post] = await db
    .insert(postsTable)
    .values({
      campusId: nearest.hub.id,
      userId,
      content,
      createdAt,
      expiresAt,
    })
    .returning();

  publishCampusFeedUpdate(nearest.hub.id);
  res.status(201).json(
    CreatePostResponse.parse({
      id: post.id,
      alias: profile.alias,
      content: post.content,
      createdAt: post.createdAt,
      expiresAt: post.expiresAt,
      score: 0,
      myVote: null,
      reportCount: 0,
    }),
  );
});

router.put("/posts/:postId/vote", requireAuth, async (req, res): Promise<void> => {
  const params = VoteOnPostParams.safeParse(req.params);
  const body = VoteOnPostBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid vote." });
    return;
  }
  const [post] = await db
    .select({
      id: postsTable.id,
      campusId: postsTable.campusId,
    })
    .from(postsTable)
    .where(
      and(
        eq(postsTable.id, params.data.postId),
        eq(postsTable.hidden, false),
        gt(postsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!post) {
    res.status(404).json({ error: "That post is no longer available." });
    return;
  }

  const nearest = await findNearestHub(body.data.latitude, body.data.longitude);
  if (!isInsideHub(nearest, post.campusId)) {
    res.status(403).json(geofenceErrorPayload(nearest));
    return;
  }

  const userId = authenticatedUserId(res);
  await ensureProfile(userId);
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(postVotesTable)
      .where(
        and(
          eq(postVotesTable.postId, post.id),
          eq(postVotesTable.userId, userId),
        ),
      )
      .limit(1);

    let myVote: number | null = body.data.value;
    if (existing?.value === body.data.value) {
      await tx
        .delete(postVotesTable)
        .where(eq(postVotesTable.id, existing.id));
      myVote = null;
    } else if (existing) {
      await tx
        .update(postVotesTable)
        .set({ value: body.data.value, createdAt: new Date() })
        .where(eq(postVotesTable.id, existing.id));
    } else {
      await tx.insert(postVotesTable).values({
        postId: post.id,
        userId,
        value: body.data.value,
      });
    }

    const [scoreRow] = await tx
      .select({
        score: sql<number>`coalesce(sum(${postVotesTable.value}), 0)::int`,
      })
      .from(postVotesTable)
      .where(eq(postVotesTable.postId, post.id));
    return { score: scoreRow?.score ?? 0, myVote };
  });

  publishCampusFeedUpdate(post.campusId);
  res.json(
    VoteOnPostResponse.parse({
      postId: post.id,
      score: result.score,
      myVote: result.myVote,
    }),
  );
});

router.post("/posts/:postId/report", requireAuth, async (req, res): Promise<void> => {
  const params = ReportPostParams.safeParse(req.params);
  const body = ReportPostBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid report." });
    return;
  }
  const [post] = await db
    .select({
      id: postsTable.id,
      campusId: postsTable.campusId,
    })
    .from(postsTable)
    .where(
      and(
        eq(postsTable.id, params.data.postId),
        eq(postsTable.hidden, false),
        gt(postsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!post) {
    res.status(404).json({ error: "That post is no longer available." });
    return;
  }

  const nearest = await findNearestHub(body.data.latitude, body.data.longitude);
  if (!isInsideHub(nearest, post.campusId)) {
    res.status(403).json(geofenceErrorPayload(nearest));
    return;
  }

  const userId = authenticatedUserId(res);
  await ensureProfile(userId);
  try {
    const result = await db.transaction(async (tx) => {
      await tx.insert(postReportsTable).values({
        postId: post.id,
        userId,
        reason: body.data.reason,
      });

      const [countRow] = await tx
        .select({ reportCount: sql<number>`count(*)::int` })
        .from(postReportsTable)
        .where(eq(postReportsTable.postId, post.id));
      const reportCount = countRow?.reportCount ?? 0;
      const hidden = reportCount >= 5;
      if (hidden) {
        await tx
          .update(postsTable)
          .set({ hidden: true })
          .where(eq(postsTable.id, post.id));
      }
      return { reportCount, hidden };
    });

    publishCampusFeedUpdate(post.campusId);
    res.json(
      ReportPostResponse.parse({
        reported: true,
        reportCount: result.reportCount,
        hidden: result.hidden,
      }),
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "You have already reported this post." });
      return;
    }
    throw err;
  }
});

export default router;