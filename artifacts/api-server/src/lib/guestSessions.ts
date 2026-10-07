import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';
import { ensureProfile } from './profiles';
import type { Request, Response } from 'express';
export const cookieName = 'echo_session';
export function sessionHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function sessionToken(req: Request) {
  const value = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function findGuestSession(req: Request) {
  const token = sessionToken(req); if (!token) return null;
  const result = await db.execute(sql`select s.user_id, p.alias from public.echo_sessions s join public.profiles p on p.user_id=s.user_id where s.token_hash=${sessionHash(token)} and s.expires_at > now() limit 1`);
  return result.rows[0] as { user_id: string; alias: string } | undefined;
}
export function setSessionCookie(res: Response, token: string, clear = false) {
  res.setHeader('Set-Cookie', `${cookieName}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 2592000}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  res.setHeader('Cache-Control', 'no-store');
}
export async function createGuestSession(res: Response) {
  const userId = `guest:${randomUUID()}`;
  const token = randomBytes(32).toString('hex');
  const profile = await ensureProfile(userId);
  await db.execute(sql`insert into public.echo_sessions(token_hash,user_id,expires_at) values (${sessionHash(token)},${userId},now()+interval '30 days')`);
  setSessionCookie(res, token);
  return { userId, alias: profile.alias };
}
