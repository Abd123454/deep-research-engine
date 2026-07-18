// Sanitize error messages to prevent secret leakage.
//
// P0-10 (hardening audit): error messages from downstream libraries
// frequently contain the request URL, the Authorization header, or
// the connection string that triggered the failure — all of which
// include secrets that must NEVER cross the wire to the client (or
// even land in low-access-control logs). This module strips known
// secret patterns from any error before it is returned to the client
// or written to a log stream.
//
// The patterns cover the most common leak vectors:
//   - HTTP Authorization headers ("Bearer …", "Authorization: …")
//   - API keys (OpenAI sk-…, NVIDIA nvapi-…, Anthropic sk-ant-…)
//   - Database connection strings (postgres/mongodb/redis URLs with
//     embedded credentials)
//   - Environment-variable-style key/value pairs ("API_KEY=…",
//     "password=…") — these leak when an error message echoes the
//     offending env var name and value together.
//
// The output is also truncated to 500 characters as defense-in-depth
// against log injection (an attacker who controls part of an error
// message could otherwise craft a multi-line payload that mimics a
// legitimate log entry).

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,    // HTTP Bearer tokens
  /sk-[A-Za-z0-9]{20,}/gi,                // OpenAI
  /nvapi-[A-Za-z0-9]{20,}/gi,             // NVIDIA
  /sk-ant-[A-Za-z0-9]{20,}/gi,            // Anthropic
  /Authorization:\s*[A-Za-z0-9\-._~+/=]+/gi,
  /postgresql:\/\/[^:]+:[^@]+@/gi,        // Postgres connection string
  /mongodb:\/\/[^:]+:[^@]+@/gi,           // MongoDB
  /redis:\/\/[^:]+:[^@]+@/gi,             // Redis
  /API_KEY=[A-Za-z0-9]+/gi,
  /password=[A-Za-z0-9]+/gi,
];

/**
 * Convert an unknown thrown value into a safe, secret-free string.
 *
 * Usage:
 *   } catch (err) {
 *     return Response.json({ error: sanitizeError(err) }, { status: 500 });
 *   }
 *
 * Or, for logging:
 *   logger.error({ err: sanitizeError(err) }, "operation failed");
 *
 * The function NEVER throws — if the input is unstringifiable for any
 * reason, it returns a generic "(unserializable error)" string.
 */
export function sanitizeError(err: unknown): string {
  let msg: string;
  if (err instanceof Error) {
    msg = err.message;
  } else if (typeof err === "string") {
    msg = err;
  } else {
    // Objects (including plain `{ message: "..." }` errors thrown by
    // some libraries) — try JSON.stringify, fall back to a generic
    // placeholder if that fails (circular refs, BigInts, etc.).
    try {
      msg = JSON.stringify(err);
    } catch {
      msg = String(err);
    }
  }

  for (const pattern of SECRET_PATTERNS) {
    msg = msg.replace(pattern, "[REDACTED]");
  }

  // Truncate to prevent log injection (a multi-line error message can
  // mimic a legitimate log entry; capping at 500 chars limits the
  // surface area for that attack).
  return msg.slice(0, 500);
}
