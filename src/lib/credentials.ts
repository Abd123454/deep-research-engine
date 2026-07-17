// At-rest encryption for connector credentials (and other secrets stored
// in the DB). Uses AES-256-GCM with a random 12-byte IV per record.
//
// Key source (in priority order):
//   1. CREDENTIALS_ENCRYPTION_KEY  — production secret (recommended)
//   2. AUTH_PASSWORD                — fallback so dev/single-tenant setups
//                                     get encryption without extra config
//   3. "quaesitor-dev-key-change-me" — last-resort dev default. Loud warning
//                                     is appropriate but we don't print one
//                                     here on every call (the auth module
//                                     already warns about missing creds).
//
// Backward compatibility: `decryptSafe()` returns the original plaintext
// if the payload is not in our `iv:tag:enc` format. This means existing
// plaintext credentials in the DB keep working until they're next saved
// (at which point they get encrypted on write).

import crypto from "crypto";

const ALGO = "aes-256-gcm";
const DEV_FALLBACK_KEY = "quaesitor-dev-key-change-me";

/**
 * Resolve the 32-byte AES key from env. SHA-256 normalises any-length
 * inputs to the required 32 bytes; we never store the raw secret.
 *
 * SECURITY: In production, we fail-closed if no key source is configured
 * (no CREDENTIALS_ENCRYPTION_KEY and no AUTH_PASSWORD). The dev fallback
 * is ONLY available when NODE_ENV !== "production".
 */
function getKey(): Buffer {
  const raw =
    process.env.CREDENTIALS_ENCRYPTION_KEY ||
    process.env.AUTH_PASSWORD;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Credentials encryption key not configured. Set CREDENTIALS_ENCRYPTION_KEY (recommended) or AUTH_PASSWORD. " +
          "Production deployments MUST NOT use the dev fallback key."
      );
    }
    // Dev only — loud warning logged at module load (see below)
    return crypto.createHash("sha256").update(DEV_FALLBACK_KEY).digest();
  }
  return crypto.createHash("sha256").update(raw).digest();
}

// Loud warning when the dev fallback is in use
if (
  process.env.NODE_ENV !== "production" &&
  !process.env.CREDENTIALS_ENCRYPTION_KEY &&
  !process.env.AUTH_PASSWORD
) {
  // eslint-disable-next-line no-console
  console.warn(
    "[SECURITY] Using dev fallback key for credentials encryption. " +
      "Set CREDENTIALS_ENCRYPTION_KEY or AUTH_PASSWORD for production."
  );
}

/**
 * Encrypt a UTF-8 plaintext string.
 * Returns `iv:tag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a payload produced by `encrypt()`.
 * Throws if the payload is malformed or the auth tag doesn't verify
 * (e.g. tampered ciphertext or wrong key).
 */
export function decrypt(payload: string): string {
  const [ivHex, tagHex, encHex] = payload.split(":");
  if (!ivHex || !tagHex || !encHex) {
    throw new Error("Invalid encrypted payload");
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/** Format marker used to detect already-encrypted payloads. */
export const ENCRYPTED_PREFIX_REGEX = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]*$/i;

/**
 * Backward-compatible decrypt.
 *
 * - If `payload` is null/empty → returns null.
 * - If `payload` matches the `iv:tag:enc` format → decrypts.
 * - If `payload` does NOT match (legacy plaintext stored by an older
 *   version of the app) → returns the raw string unchanged so the
 *   connector keeps working. The next save will encrypt it.
 */
export function decryptSafe(payload: string | null | undefined): string | null {
  if (payload == null || payload === "") return null;
  if (!ENCRYPTED_PREFIX_REGEX.test(payload)) {
    // Legacy plaintext — return as-is for backward compatibility.
    return payload;
  }
  try {
    return decrypt(payload);
  } catch {
    // Decryption failed (wrong key, corrupted, etc.). Return raw so the
    // caller can decide what to do — better than crashing the request.
    return payload;
  }
}

/**
 * Encrypt a JSON-serializable credentials object.
 * Returns the `iv:tag:enc` string suitable for DB storage.
 */
export function encryptCredentials(creds: unknown): string {
  return encrypt(JSON.stringify(creds));
}

/**
 * Decrypt a stored credentials payload and parse as JSON.
 * Falls back to parsing legacy plaintext JSON. Returns `null` if the
 * payload is null/empty or cannot be parsed.
 */
export function decryptCredentials<T = unknown>(
  payload: string | null | undefined
): T | null {
  const raw = decryptSafe(payload);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Plaintext token (not JSON) — wrap as `{ token: ... }` for callers
    // that expect an object.
    return { token: raw } as unknown as T;
  }
}
