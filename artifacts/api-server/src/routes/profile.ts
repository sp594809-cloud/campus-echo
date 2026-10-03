import { Router, type IRouter } from "express";
import { GetMyProfileResponse } from "@workspace/api-zod";
import { authenticatedUserId, requireAuth } from "../lib/auth";
import { refreshVerifiedStudentStatus } from "../lib/profiles";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/me", requireAuth, async (_req, res): Promise<void> => {
  const userId = authenticatedUserId(res);
  try {
    const profile = await refreshVerifiedStudentStatus(userId, res.locals.authUser);
    res.json(
      GetMyProfileResponse.parse({
        alias: profile.alias,
        studentVerified: profile.studentVerified,
      }),
    );
  } catch (err) {
    logger.error({ err }, "Could not load anonymous profile");
    res.status(503).json({ error: "Your profile is temporarily unavailable." });
  }
});

export default router;