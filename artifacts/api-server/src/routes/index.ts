import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hubsRouter from "./hubs";
import profileRouter from "./profile";
import feedRouter from "./feed";
import postsRouter from "./posts";
import pollsRouter from "./polls";
import radarRouter from "./radar";

import discussionsRouter from "./discussions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hubsRouter);
router.use(profileRouter);
router.use(feedRouter);
router.use(postsRouter);
router.use(pollsRouter);
router.use(radarRouter);
router.use(discussionsRouter);

export default router;
