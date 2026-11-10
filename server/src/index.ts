import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { createRealtime } from "./realtime/socket.js";

const app = createApp();
const httpServer = createServer(app);
const io = createRealtime(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`Response Hub API listening on http://localhost:${env.PORT} (realtime path /realtime)`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  await io.close(); // also closes the HTTP server
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (err) => logger.error({ err }, "unhandled rejection"));
