import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { createRealtime } from "./realtime/socket.js";
import { refreshAllPriorities } from "./services/incident.service.js";

const app = createApp();
const httpServer = createServer(app);
const io = createRealtime(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`Response Hub API listening on http://localhost:${env.PORT} (realtime path /realtime)`);
});

// Waiting-time escalation: unattended incidents climb in priority. Also backfills
// priority for rows created before the Round 2 migration (priorityUpdatedAt IS NULL).
async function priorityJob() {
  try {
    const changed = await refreshAllPriorities();
    if (changed) logger.info({ changed }, "priorities refreshed");
  } catch (err) {
    logger.error({ err }, "priority refresh failed");
  }
}
void priorityJob();
const priorityTimer = setInterval(() => void priorityJob(), env.PRIORITY_REFRESH_SECONDS * 1000);
priorityTimer.unref();

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  clearInterval(priorityTimer);
  await io.close(); // also closes the HTTP server
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (err) => logger.error({ err }, "unhandled rejection"));
