import type { RequestHandler, Response } from "express";
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) { res.status(401).json({ error: "Sign in to continue." }); return; }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
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