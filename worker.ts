// Worker process entry point — starts all BullMQ workers.
// Run with: bun run worker
// This process runs separately from the Next.js web server.

import { researchWorker } from "./src/workers/research-worker";
import { emailWorker } from "./src/workers/email-worker";
import { memoryWorker } from "./src/workers/memory-worker";
import { closeQueues } from "./src/lib/queue";
import { logger } from "./src/lib/logger";

logger.info("Starting BullMQ workers...");

if (!researchWorker && !emailWorker && !memoryWorker) {
  logger.warn("No workers created — Redis not configured. Exiting.");
  process.exit(0);
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down workers...");
  await researchWorker?.close();
  await emailWorker?.close();
  await memoryWorker?.close();
  await closeQueues();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

logger.info("Workers running. Press Ctrl+C to stop.");
