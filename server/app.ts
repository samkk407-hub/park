import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { connectMongo } from "./lib/mongoose";
import { getJwtSecret } from "./lib/config";
import { logError } from "./lib/errorLog";

const app: Express = express();
getJwtSecret();

connectMongo().catch((err) => {
  logger.error({ err }, "Failed to connect to MongoDB");
  process.exit(1);
});

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
const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8081",
  "http://localhost:19006",
  "http://localhost:3000",
];

function getAllowedOrigins() {
  const envOrigins = (process.env["CORS_ORIGINS"] || process.env["CORS_ORIGIN"] || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));
}

const allowedOrigins = getAllowedOrigins();
const allowAnyOrigin = allowedOrigins.includes("*");

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowAnyOrigin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = origin.replace(/\/$/, "");
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use(async (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, path: req.originalUrl }, "Unhandled request error");
  await logError({ area: "express.unhandled", error: err, req });
  if (res.headersSent) return;
  const isDevelopment = ["development", "dev", "developer"].includes((process.env["APP_ENV"] || "development").toLowerCase());
  const message = isDevelopment && err instanceof Error ? err.message : "Internal server error";
  return res.status(500).json({ error: message, code: "INTERNAL_SERVER_ERROR" });
});

export default app;
