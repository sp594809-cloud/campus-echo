import { Router, type IRouter, type Request, type Response } from 'express';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db, discussionsTable as messages, discussionReportsTable as reports, postsTable, profilesTable, radarBlocksTable } from '@workspace/db';
import { requireAuth, authenticatedUserId } from '../lib/auth';
import { getCommunityHub } from '../lib/community';
import { ensureProfile } from '../lib/profiles';
import { blockRadarUser } from '../lib/radarService';
import { publishCampusFeedUpdate } from '../lib/feedEvents';

const router: IRouter = Router();
export const coordinatesSchema = z.object({ latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180) });
export const discussionInput = z.object({ content: z.string().trim().min(1).max(1000) });
async function scope(req: Request, res: Response, source: unknown) {
  const nearest = await getCommunityHub();
  if (!nearest) { res.status(503).json({ error: 'The community is not configured yet.' }); return null; }
  const userId = authenticatedUserId(res);
  const rawId = req.params.postId;
  const postId = rawId === undefined ? null : Number(rawId);
  if (postId !== null) {
    if (!Number.isSafeInteger(postId) || postId <= 0) { res.status(400).json({ error: 'Invalid post.' }); return null; }
    const [post] = await db.select().from(postsTable).where(and(eq(postsTable.id, postId), eq(postsTable.campusId, nearest.hub.id), eq(postsTable.hidden, false), gt(postsTable.expiresAt, new Date()))).limit(1);
    if (!post) { res.status(404).json({ error: 'That post is no longer available.' }); return null; }
    return { campusId: nearest.hub.id, postId, userId, expiresAt: post.expiresAt };
  }
  return { campusId: nearest.hub.id, postId: null, userId, expiresAt: new Date(Date.now() + 86400000) };
}
const scopeCondition = (s: { campusId: number; postId: number | null }) => and(eq(messages.campusId, s.campusId), s.postId === null ? isNull(messages.postId) : eq(messages.postId, s.postId));
router.get(['/chat/public', '/posts/:postId/replies'], requireAuth, async (req, res) => {
  const s = await scope(req, res, req.query); if (!s) return;
  const rows = await db.select({ id: messages.id, content: messages.content, alias: profilesTable.alias, userId: messages.userId, createdAt: messages.createdAt }).from(messages).innerJoin(profilesTable, eq(messages.userId, profilesTable.userId)).where(and(scopeCondition(s), eq(messages.hidden, false), gt(messages.expiresAt, new Date()), sql`not exists (select 1 from ${radarBlocksTable} b where (b.blocker_user_id = ${s.userId} and b.blocked_user_id = ${messages.userId}) or (b.blocked_user_id = ${s.userId} and b.blocker_user_id = ${messages.userId}))`)).orderBy(desc(messages.createdAt), desc(messages.id)).limit(100);
  res.json({ messages: rows.reverse().map(({ userId, ...r }) => ({ ...r, fromMe: userId === s.userId })) });
});
router.post(['/chat/public', '/posts/:postId/replies'], requireAuth, async (req, res) => {
  const input = discussionInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Enter 1–1000 characters of text.' }); return; }
  const s = await scope(req, res, input.data); if (!s) return;
  const profile = await ensureProfile(s.userId);
  const row = await db.transaction(async tx => {
    // Serialize each user's writes so concurrent requests cannot bypass the limit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${s.userId}))`);
    const recent = await tx.select({ id: messages.id }).from(messages).where(and(eq(messages.userId, s.userId), gt(messages.createdAt, new Date(Date.now() - 60000)))).limit(10);
    if (recent.length >= 10) return null;
    const [r] = await tx.insert(messages).values({ campusId: s.campusId, postId: s.postId, userId: s.userId, content: input.data.content, expiresAt: s.expiresAt }).returning();
    return r;
  });
  if (!row) { res.status(429).json({ error: 'Please slow down. Try again in a minute.' }); return; }
  publishCampusFeedUpdate(s.campusId);
  res.status(201).json({ id: row.id, content: row.content, alias: profile.alias, createdAt: row.createdAt, fromMe: true });
});
router.post('/discussions/:messageId/report', requireAuth, async (req, res) => {
  const id = Number(req.params.messageId);
  if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).json({ error: 'Invalid message.' }); return; }
  const s = await scope(req, res, req.body); if (!s) return;
  const [row] = await db.select().from(messages).where(and(eq(messages.id, id), eq(messages.campusId, s.campusId), gt(messages.expiresAt, new Date()), eq(messages.hidden, false))).limit(1);
  if (!row) { res.status(404).json({ error: 'Message is no longer available.' }); return; }
  const reason = z.string().trim().min(1).max(200).safeParse(req.body.reason);
  if (!reason.success) { res.status(400).json({ error: 'Please give a reason.' }); return; }
  await ensureProfile(s.userId);
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(${id})`);
    await tx.insert(reports).values({ messageId: id, userId: s.userId, reason: reason.data }).onConflictDoNothing();
    const [count] = await tx.select({ total: sql<number>`count(*)::int` }).from(reports).where(eq(reports.messageId, id));
    if (count.total >= 5) await tx.update(messages).set({ hidden: true }).where(eq(messages.id, id));
  });
  publishCampusFeedUpdate(s.campusId);
  res.json({ reported: true });
});
router.post('/discussions/:messageId/block', requireAuth, async (req, res) => {
  const id = Number(req.params.messageId);
  if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).json({ error: 'Invalid message.' }); return; }
  const s = await scope(req, res, req.body); if (!s) return;
  const [row] = await db.select().from(messages).where(and(eq(messages.id, id), eq(messages.campusId, s.campusId), gt(messages.expiresAt, new Date()))).limit(1);
  if (!row || row.userId === s.userId) { res.status(400).json({ error: 'Cannot block this participant.' }); return; }
  await ensureProfile(s.userId);
  await blockRadarUser(s.userId, row.userId);
  publishCampusFeedUpdate(s.campusId);
  res.json({ blocked: true });
});
export default router;
