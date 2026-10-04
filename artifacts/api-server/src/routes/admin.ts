import { Router, type ErrorRequestHandler, type IRouter } from "express";
import { authenticatedUserId, requireAuth } from "../lib/auth";
import {
  getAdminQueue,
  getMyAdminStatus,
  setContentHidden,
} from "../lib/adminService";
import { RadarServiceError } from "../lib/radarService";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/admin/me", async (_req, res): Promise<void> => {
  const status = await getMyAdminStatus(authenticatedUserId(res));
  res.json(status);
});

router.get("/admin/queue", async (_req, res): Promise<void> => {
  const queue = await getAdminQueue(authenticatedUserId(res));
  res.json(queue);
});

router.post("/admin/content/:kind/:id/visibility", async (req, res): Promise<void> => {
  const kind = req.params.kind;
  const id = kind === "group" ? String(req.params.id) : Number(req.params.id);
  const hidden = Boolean(req.body?.hidden);
  if (!["post", "poll", "discussion", "group"].includes(kind) || (kind === "group" ? !/^[a-f0-9-]{36}$/.test(String(id)) : !Number.isFinite(id))) {
    res.status(400).json({ error: "Invalid content target." });
    return;
  }
  const result = await setContentHidden(
    authenticatedUserId(res),
    kind as "post" | "poll" | "discussion" | "group",
    id,
    hidden,
  );
  res.json(result);
});

const adminErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (error instanceof RadarServiceError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
};
router.use(adminErrorHandler);

export default router;
