// Email worker — processes email jobs from the BullMQ queue.

import { createEmailWorker } from "../lib/queue";
import { sendEmail } from "../lib/email";
import { logger } from "../lib/logger";
import type { EmailTemplate } from "../lib/email";

export const emailWorker = createEmailWorker(async (data) => {
  const { to, template, props } = data;
  logger.info({ to, template }, "Email worker processing job");
  await sendEmail(to, template as EmailTemplate, props);
});

if (emailWorker) {
  emailWorker.on("completed", (job) => {
    logger.info({ to: job.data.to }, "Email job completed");
  });
  emailWorker.on("failed", (job, err) => {
    logger.error({ err, to: job?.data.to }, "Email job failed");
  });
}
