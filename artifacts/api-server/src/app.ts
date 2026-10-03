import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import path from "node:path";
import { existsSync } from "node:fs";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";


const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: process.env.APP_ORIGIN?.split(',').map(origin => origin.trim()) ?? false }));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api", (_req, res) => { res.status(404).json({ error: 'Endpoint not found.' }); });
const publicDir = path.resolve(import.meta.dirname, '../../campus-echo/dist/public');
if (existsSync(path.join(publicDir, 'index.html'))) {
  app.use(express.static(publicDir));
  app.get('/{*splat}', (_req, res) => { res.sendFile(path.join(publicDir, 'index.html')); });
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) { res.end(); return; }
  logger.error({ err }, 'Request failed');
  const status = err?.status === 413 ? 413 : err instanceof SyntaxError ? 400 : 500;
  res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again.' : 'Invalid request body.' });
};
app.use(errorHandler);
export default app;
