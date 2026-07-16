// Memory worker — processes memory extraction jobs from the BullMQ queue.

import { createMemoryWorker } from "../lib/queue";
import { extractAndStoreMemories } from "../lib/memory-extractor";
import { logger } from "../lib/logger";

export const memoryWorker = createMemoryWorker(async (data) => {
  const { userId, conversation } = data;
  logger.info({ userId }, "Memory worker processing job");
  await extractAndStoreMemories(userId, conversation);
});

if (memoryWorker) {
  memoryWorker.on("completed", (job) => {
    logger.info({ userId: job.data.userId }, "Memory job completed");
  });
  memoryWorker.on("failed", (job, err) => {
    logger.error({ err, userId: job?.data.userId }, "Memory job failed");
  });
}
