// Structured logging using pino.
//
// Replaces ad-hoc console logging with structured JSON logs in production
// and pretty-printed logs in development. All sensitive fields are redacted.

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  base: {
    service: "quaesitor",
    version: process.env.npm_package_version || "unknown",
  },
  redact: {
    paths: [
      "apiKey",
      "password",
      "passwordHash",
      "token",
      "authorization",
      "cookie",
      "*.apiKey",
      "*.password",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname,service,version",
        },
      }
    : undefined,
});

export function createRequestLogger(
  requestId: string,
  extra?: Record<string, unknown>
) {
  return logger.child({ requestId, ...extra });
}

export function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export async function withLoggedError<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.error(
      {
        operation,
        err:
          err instanceof Error
            ? { message: err.message, stack: err.stack }
            : String(err),
        ...context,
      },
      `Error in ${operation}`
    );
    throw err;
  }
}
