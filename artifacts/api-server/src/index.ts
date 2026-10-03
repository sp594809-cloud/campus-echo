import app from "./app";
import { attachRadarWebSocket } from "./lib/radarSockets";
import { cleanupRadarData } from "./lib/radarService";
import { startExpirationCleanup } from "./lib/expiration";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? "5000";

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

startExpirationCleanup();

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

attachRadarWebSocket(server);
const radarCleanup = setInterval(() => { void cleanupRadarData().catch(err => logger.error({ err }, "Radar cleanup failed")); }, 30000);
radarCleanup.unref();
