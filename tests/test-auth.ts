import type { RequestHandler, Response } from '../artifacts/api-server/node_modules/express';
export const requireAuth: RequestHandler = (req, res, next) => {
  const user = req.headers['x-test-user'];
  if (typeof user !== 'string') { res.status(401).json({ error: 'Sign in to continue.' }); return; }
  res.locals.userId = user; next();
};
export const authenticatedUserId = (res: Response) => res.locals.userId as string;
