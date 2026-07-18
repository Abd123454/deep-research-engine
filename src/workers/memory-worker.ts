// Memory worker — processes memory extraction jobs from the BullMQ queue.
//
// Ethical #4 — respects the user's opt-in consent gate. Jobs that arrive
// for users who haven't enabled memory extraction are silently dropped
// (the queue is fired from /api/chat before the consent check completes
// in some code paths; the worker is the final gate). The dropped job is
// logged so ops can spot misconfigured callers.

import { createMemoryWorker } from "../lib/queue";
import {
  extractAndStoreMemories,
  isMemoryExtractionEnabled,
  detectMemoryCommand,
  storeExplicitMemory,
} from "../lib/memory-extractor";
import { logger } from "../lib/logger";

export const memoryWorker = createMemoryWorker(async (data) => {
  const { userId, conversation } = data;
  logger.info({ userId }, "Memory worker processing job");

  // Consent gate (Ethical #4): default is FALSE.
  // V3 audit fix: reads the consent_ledger table (GDPR Art. 7) — async.
  if (!(await isMemoryExtractionEnabled(userId))) {
    // Exception (Ethical #5): scan the conversation for explicit memory
    // commands ("remember that..."). These bypass the consent gate
    // because the user directly asked us to remember.
    const lines = typeof conversation === "string" ? conversation.split("\n") : [];
    let storedExplicit = 0;
    for (const line of lines) {
      // Lines look like "user: remember that I prefer concise answers".
      const userLine = line.toLowerCase().startsWith("user:") ? line.slice(5).trim() : line;
      const cmd = detectMemoryCommand(userLine);
      if (cmd.isMemoryCommand && cmd.content) {
        const ok = await storeExplicitMemory(userId, cmd.content);
        if (ok) storedExplicit++;
      }
    }
    if (storedExplicit > 0) {
      logger.info({ userId, storedExplicit }, "Memory worker stored explicit memory commands (consent gate otherwise closed)");
    } else {
      logger.info({ userId }, "Memory worker skipping extraction — consent not enabled");
    }
    return;
  }

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
