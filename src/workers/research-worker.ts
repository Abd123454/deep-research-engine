// Research worker — processes research jobs from the BullMQ queue.
// Runs in a separate process (worker.ts) to avoid blocking the web server.

import { createResearchWorker } from "../lib/queue";
import { runResearch } from "../lib/research-engine";
import { logger } from "../lib/logger";

export const researchWorker = createResearchWorker(async (data) => {
  const { jobId, query } = data;
  logger.info({ jobId, query: query.slice(0, 80) }, "Research worker processing job");

  try {
    await runResearch(jobId);
    logger.info({ jobId }, "Research worker completed job");
  } catch (err) {
    logger.error({ err, jobId }, "Research worker failed");
    throw err; // BullMQ will retry
  }
});

if (researchWorker) {
  researchWorker.on("completed", (job) => {
    logger.info({ jobId: job.data.jobId }, "Research job completed");
  });
  researchWorker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.data.jobId }, "Research job failed");
  });
}
