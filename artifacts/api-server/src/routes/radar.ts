import {
  Router,
  type ErrorRequestHandler,
  type IRouter,
} from "express";
import {
  AcceptRadarPingParams,
  AcceptRadarPingResponse,
  BlockRadarBlipParams,
  BlockRadarChatParticipantParams,
  CreateRadarSocketTicketResponse,
  DeclineRadarPingParams,
  DeclineRadarPingResponse,
  GetNearbyRadarBlipsQueryParams,
  GetNearbyRadarBlipsResponse,
  GetRadarInboxResponse,
  ListRadarChatMessagesParams,
  ListRadarChatMessagesResponse,
  ReportRadarBlipBody,
  ReportRadarBlipParams,
  ReportRadarBlipResponse,
  ReportRadarChatParticipantBody,
  ReportRadarChatParticipantParams,
  ReportRadarChatParticipantResponse,
  SendRadarChatMessageBody,
  SendRadarChatMessageParams,
  SendRadarChatMessageResponse,
  SendRadarPingBody,
  SendRadarPingResponse,
  UpdateRadarPresenceBody,
  UpdateRadarPresenceResponse,
} from "@workspace/api-zod";
import { authenticatedUserId, requireAuth } from "../lib/auth";
import {
  acceptRadarPing,
  blockRadarBlip,
  blockRadarChatParticipant,
  declineRadarPing,
  getNearbyRadarBlips,
  getRadarInbox,
  hideRadarPresence,
  listRadarChatMessages,
  reportRadarBlip,
  reportRadarChatParticipant,
  sendRadarChatMessage,
  sendRadarPing,
  updateRadarPresence,
  RadarServiceError,
} from "../lib/radarService";
import { markRadarChatRead } from "../lib/markChatRead";
import { createRadarSocketTicket } from "../lib/radarSockets";
import { ensureProfile } from "../lib/profiles";

const router: IRouter = Router();
// Retire location collection for all clients, including older installed versions.
router.all(['/radar/presence','/radar/nearby','/radar/pings','/radar/blips/:blipId/block','/radar/blips/:blipId/report'], (_req,res) => {
  res.status(410).json({error:'Location features have been retired. Use anonymous groups and chat.'});
});
router.use(requireAuth);

router.put("/radar/presence", async (req, res): Promise<void> => {
  const body = UpdateRadarPresenceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: body.error.issues[0]?.message ?? "Invalid radar location.",
    });
    return;
  }
  const result = await updateRadarPresence(
    authenticatedUserId(res),
    body.data,
  );
  res.json(UpdateRadarPresenceResponse.parse(result));
});

router.delete("/radar/presence", async (_req, res): Promise<void> => {
  await hideRadarPresence(authenticatedUserId(res));
  res.sendStatus(204);
});

router.get("/radar/nearby", async (req, res): Promise<void> => {
  const query = GetNearbyRadarBlipsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({
      error: query.error.issues[0]?.message ?? "Invalid radar location.",
    });
    return;
  }
  const response = await getNearbyRadarBlips(
    authenticatedUserId(res),
    query.data,
  );
  res.json(GetNearbyRadarBlipsResponse.parse(response));
});

router.get("/radar/inbox", async (_req, res): Promise<void> => {
  const response = await getRadarInbox(authenticatedUserId(res));
  res.json(GetRadarInboxResponse.parse(response));
});

router.post("/radar/socket-ticket", async (_req, res): Promise<void> => {
  const userId = authenticatedUserId(res);
  await ensureProfile(userId);
  const ticket = await createRadarSocketTicket(userId);
  res
    .status(201)
    .json(CreateRadarSocketTicketResponse.parse(ticket));
});

router.post("/radar/pings", async (req, res): Promise<void> => {
  const body = SendRadarPingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: body.error.issues[0]?.message ?? "Invalid Ping request.",
    });
    return;
  }
  const result = await sendRadarPing(
    authenticatedUserId(res),
    body.data.blipId,
  );
  res.status(201).json(
    SendRadarPingResponse.parse({
      pingId: result.ping.id,
      status: "pending",
      createdAt: result.ping.createdAt,
    }),
  );
});

router.post("/radar/pings/:pingId/accept", async (req, res): Promise<void> => {
  const params = AcceptRadarPingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid Ping ID." });
    return;
  }
  const result = await acceptRadarPing(
    authenticatedUserId(res),
    params.data.pingId,
  );
  res.status(201).json(AcceptRadarPingResponse.parse(result));
});

router.post("/radar/pings/:pingId/decline", async (req, res): Promise<void> => {
  const params = DeclineRadarPingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid Ping ID." });
    return;
  }
  const result = await declineRadarPing(
    authenticatedUserId(res),
    params.data.pingId,
  );
  res.json(DeclineRadarPingResponse.parse(result));
});

router.get(
  "/radar/chats/:chatId/messages",
  async (req, res): Promise<void> => {
    const params = ListRadarChatMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid chat ID." });
      return;
    }
    const result = await listRadarChatMessages(
      authenticatedUserId(res),
      params.data.chatId,
    );
    res.json(ListRadarChatMessagesResponse.parse(result));
  },
);

router.post(
  "/radar/chats/:chatId/messages",
  async (req, res): Promise<void> => {
    const params = SendRadarChatMessageParams.safeParse(req.params);
    const body = SendRadarChatMessageBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid chat message." });
      return;
    }
    const result = await sendRadarChatMessage(
      authenticatedUserId(res),
      params.data.chatId,
      body.data.text,
    );
    res.status(201).json(SendRadarChatMessageResponse.parse(result.message));
  },
);

router.post(
  "/radar/blips/:blipId/block",
  async (req, res): Promise<void> => {
    const params = BlockRadarBlipParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid nearby signal." });
      return;
    }
    await blockRadarBlip(authenticatedUserId(res), params.data.blipId);
    res.sendStatus(204);
  },
);

router.post(
  "/radar/blips/:blipId/report",
  async (req, res): Promise<void> => {
    const params = ReportRadarBlipParams.safeParse(req.params);
    const body = ReportRadarBlipBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid report." });
      return;
    }
    const result = await reportRadarBlip(
      authenticatedUserId(res),
      params.data.blipId,
      body.data.reason,
      body.data.details,
    );
    res.status(201).json(ReportRadarBlipResponse.parse(result));
  },
);

router.post(
  "/radar/chats/:chatId/block",
  async (req, res): Promise<void> => {
    const params = BlockRadarChatParticipantParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid chat ID." });
      return;
    }
    await blockRadarChatParticipant(
      authenticatedUserId(res),
      params.data.chatId,
    );
    res.sendStatus(204);
  },
);

router.post(
  "/radar/chats/:chatId/report",
  async (req, res): Promise<void> => {
    const params = ReportRadarChatParticipantParams.safeParse(req.params);
    const body = ReportRadarChatParticipantBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid report." });
      return;
    }
    const result = await reportRadarChatParticipant(
      authenticatedUserId(res),
      params.data.chatId,
      body.data.reason,
      body.data.details,
    );
    res.status(201).json(ReportRadarChatParticipantResponse.parse(result));
  },
);

router.post(
  "/radar/chats/:chatId/read",
  async (req, res): Promise<void> => {
    const chatId = typeof req.params.chatId === "string" ? req.params.chatId : "";
    if (!chatId) {
      res.status(400).json({ error: "Invalid chat ID." });
      return;
    }
    const result = await markRadarChatRead(authenticatedUserId(res), chatId);
    res.json(result);
  },
);

const radarErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (error instanceof RadarServiceError) {
    req.log.warn({ statusCode: error.statusCode }, "Radar request rejected");
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
};

router.use(radarErrorHandler);

export default router;
