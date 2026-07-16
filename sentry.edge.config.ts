// Sentry edge config — runs in the Edge runtime.
// Only initializes if SENTRY_DSN is set.

import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    release: process.env.npm_package_version,
  });
}
