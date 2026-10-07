import { Router, type IRouter } from 'express';
import { z } from 'zod/v4';
import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';
import { createGuestSession, findGuestSession, sessionToken, sessionHash, setSessionCookie } from '../lib/guestSessions';
const router: IRouter = Router();
const attempts = new Map<string, { count: number; until: number }>();
router.get('/session', async (req, res) => {
  res.setHeader('Cache-Control','no-store');
  const session = await findGuestSession(req);
  res.json(session ? { userId: session.user_id, alias: session.alias } : null);
});
router.post('/session', async (req, res) => {
  // JSON-only requests and same-site cookies prevent cross-site form submissions.
  if (!req.is('application/json')) { res.status(415).json({error:'Use JSON.'}); return; }
  const email = z.email().max(254).safeParse(req.body.email);
  if (!email.success) { res.status(400).json({error:'Enter a valid email address.'}); return; }
  const existing = await findGuestSession(req);
  if (existing) { res.json({userId:existing.user_id, alias:existing.alias}); return; }
  const now=Date.now();
  for (const [key,value] of attempts) if(value.until<=now) attempts.delete(key);
  const key=req.ip ?? 'unknown';
  const attempt=attempts.get(key) ?? {count:0,until:now+3600000};
  if(attempt.count>=100 || attempts.size>=10000) { res.status(429).json({error:'Too many entries. Please try again later.'}); return; }
  attempt.count++; attempts.set(key,attempt);
  // Email is an unverified entry field, never an account lookup or public identity.
  res.status(201).json(await createGuestSession(res));
});
router.delete('/session', async (req,res) => {
  const token=sessionToken(req);
  if(token) await db.execute(sql`delete from public.echo_sessions where token_hash=${sessionHash(token)}`);
  setSessionCookie(res,'',true); res.json({signedOut:true});
});
export default router;
