import { findGuestSession } from './guestSessions';
import type { RequestHandler, Response } from "express";
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) {
    try {
      const session = await findGuestSession(req);
      if (session) { res.locals.userId=session.user_id; next(); return; }
      res.status(401).json({error:'Enter the chat to continue.'});
    } catch { res.status(503).json({error:'Your session is temporarily unavailable.'}); }
    return;
  }
  // Public project settings only; no service-role key or password belongs here.
  const defaultUrl = "https://rztexnwjsmlofmlelovq.supabase.co";
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || defaultUrl).replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (url === defaultUrl ? "sb_publishable_wJ-LMxryEKpLw8IUW9MWGw_tf-zJ1wT" : undefined);
  if (!url || !key) { res.status(503).json({ error: "Sign-in is not configured." }); return; }
  try {
    const result = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!result.ok) { res.status(result.status >= 500 || result.status === 429 ? 503 : 401).json({ error: "Unable to verify sign-in." }); return; }
    const user = await result.json();
    if (!user || typeof user !== "object" || !("id" in user) || typeof user.id !== "string" || !user.id) { res.status(401).json({ error: "Invalid sign-in." }); return; }
    res.locals.userId = user.id;
    res.locals.authUser = user;
    next();
  } catch { res.status(503).json({ error: "Sign-in is temporarily unavailable." }); }
};

export function authenticatedUserId(res: Response): string {
  const userId: unknown = res.locals.userId;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("Authenticated user ID is missing from the request.");
  }
  return userId;
}