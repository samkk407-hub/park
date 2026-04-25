import "dotenv/config";
import http from "node:http";
import https from "node:https";
import app from "./app";
import { logError } from "./lib/errorLog";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const keepAliveUrl = process.env["KEEP_ALIVE_URL"];
const keepAliveEnabled = process.env["KEEP_ALIVE_ENABLED"] === "true";

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
  void logError({ area: "process.unhandledRejection", error: reason });
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  void logError({ area: "process.uncaughtException", error: err });
});

function startKeepAlive() {
  if (!keepAliveEnabled || !keepAliveUrl) return;

  const client = keepAliveUrl.startsWith("https://") ? https : http;

  setInterval(() => {
    client.get(keepAliveUrl, (res) => {
      logger.info(
        { statusCode: res.statusCode, keepAliveUrl },
        "Keep-alive ping sent",
      );
      res.resume();
    }).on("error", (err) => {
      logger.error({ err, keepAliveUrl }, "Keep-alive ping failed");
    });
  }, 3 * 60 * 1000);
}

app.listen(port, () => {
  logger.info({ port }, "Server listening");
  startKeepAlive();
}).on('error', (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
