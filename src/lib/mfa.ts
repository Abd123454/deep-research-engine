// TOTP (Time-based One-Time Password) — RFC 6238.
//
// Minimal, zero-dependency implementation: 30-second window, 6 digits,
// SHA-1 (the de-facto TOTP standard used by Google Authenticator,
// 1Password, Authy, etc.). Backup codes are 8-digit single-use codes
// stored as SHA-256 hashes (plaintext is shown to the user exactly once,
// at setup time).
//
// Storage: SQLite (`user_mfa` table, lazily created on first use). For
// Postgres deployments, add a Prisma model mirroring the SQLite schema
// in `db.ts` and add a `getPrismaDb()` branch to each helper below.
//
// SECURITY: timing-safe comparisons are used for both TOTP and backup
// code verification to prevent timing attacks. The clock-skew window is
// ±1 step (±30s) by default — generous enough for 手机 clock drift,
// tight enough to limit brute-force surface.

import crypto from "crypto";
import { getDb } from "./db";
import { logger } from "./logger";

// ---------- Base32 (RFC 4648) ----------
// Node's Buffer doesn't natively support "base32" — we implement the
// standard alphabet (A–Z, 2–7, no padding required for our use case).
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const c of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(c);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ---------- TOTP core ----------
/** Generate a fresh 20-byte (160-bit) base32-encoded TOTP secret. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** Build the otpauth:// URI that QR-code generators expect. */
export function generateTotpUri(secret: string, label: string): string {
  const issuer = "Quaesitor";
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Compute the 6-digit TOTP for a given time step (Unix seconds / 30). */
function generateTotpForStep(secret: string, step: number): string {
  const buf = Buffer.alloc(8);
  // Steps beyond 2^53 won't fit in a JS number — use BigInt to be safe
  // (the practical range covers any plausible TOTP step until the year
  // ~4147 CE).
  buf.writeBigUInt64BE(BigInt(step));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      (hmac[offset + 1] << 16) |
      (hmac[offset + 2] << 8) |
      hmac[offset + 3]) %
    1_000_000;
  return code.toString().padStart(6, "0");
}

/** Constant-time string comparison (lengths must match). */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a 6-digit TOTP token against a base32 secret.
 *
 * @param token  User-supplied 6-digit code (whitespace stripped).
 * @param secret Base32-encoded shared secret.
 * @param window Number of steps before/after the current time to accept
 *               (default 1 → ±30s of clock skew tolerated).
 */
export function verifyTotp(token: string, secret: string, window = 1): boolean {
  const t = (token || "").replace(/\s/g, "");
  // Strict 6-digit format — fail fast on malformed input so we don't
  // waste cycles generating comparison candidates.
  if (!/^\d{6}$/.test(t)) return false;
  const time = Math.floor(Date.now() / 1000);
  for (let i = -window; i <= window; i++) {
    const step = Math.floor(time / 30) + i;
    if (timingSafeEqualStr(t, generateTotpForStep(secret, step))) return true;
  }
  return false;
}

// ---------- Backup codes ----------
/**
 * Generate `count` single-use 8-digit backup codes (zero-padded).
 * Plaintext is shown to the user exactly once at setup time; only the
 * SHA-256 hashes are persisted (see `hashBackupCode`).
 */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomInt(0, 100_000_000).toString().padStart(8, "0")
  );
}

/** Hash a backup code for storage. SHA-256 is sufficient here because
 * backup codes are 8-digit decimal (10^8 = ~26.6 bits of entropy) and
 * single-use — by the time an attacker could brute-force the hash, the
 * code has already been consumed. */
export function hashBackupCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.replace(/\s/g, ""))
    .digest("hex");
}

/**
 * Verify a user-supplied backup code against a list of stored hashes.
 * Returns the index of the matching hash, or -1 if none match. Uses
 * constant-time comparison to avoid leaking which hash matched.
 */
export function verifyBackupCode(code: string, hashes: string[]): number {
  const candidate = hashBackupCode(code);
  let matched = -1;
  for (let i = 0; i < hashes.length; i++) {
    // Compare lengths first; only do timingSafeEqual on equal-length
    // strings (crypto.timingSafeEqual throws on length mismatch).
    if (candidate.length === hashes[i].length && timingSafeEqualStr(candidate, hashes[i])) {
      matched = i;
      // Do NOT break — iterate over all codes so timing doesn't leak
      // which position matched.
    }
  }
  return matched;
}

// ---------- Storage (SQLite) ----------

export interface MfaRecord {
  userId: string;
  secret: string;          // base32-encoded shared secret
  backupCodeHashes: string[]; // SHA-256 hashes of unused backup codes
  enabled: boolean;        // false = pending setup, true = active
  createdAt: string;
  updatedAt: string;
}

/** Lazily create the `user_mfa` table if it doesn't exist. */
function ensureTable(): void {
  try {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_mfa (
        user_id TEXT PRIMARY KEY,
        secret TEXT NOT NULL,
        backup_code_hashes TEXT NOT NULL DEFAULT '[]',
        enabled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch (err) {
    logger.warn(
      { module: "mfa", err: err instanceof Error ? err.message : String(err) },
      "Failed to ensure user_mfa table"
    );
  }
}

function rowToRecord(row: Record<string, unknown>): MfaRecord {
  return {
    userId: String(row.user_id),
    secret: String(row.secret),
    backupCodeHashes: JSON.parse(String(row.backup_code_hashes || "[]")) as string[],
    enabled: Number(row.enabled) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Get the current MFA state for a user, or null if not configured. */
export function getMfaRecord(userId: string): MfaRecord | null {
  try {
    ensureTable();
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM user_mfa WHERE user_id = ?")
      .get(userId) as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : null;
  } catch (err) {
    logger.warn(
      { module: "mfa", userId, err: err instanceof Error ? err.message : String(err) },
      "Failed to read MFA record"
    );
    return null;
  }
}

/** True if the user has an ENABLED (active) MFA configuration. */
export function isMfaEnabled(userId: string): boolean {
  const rec = getMfaRecord(userId);
  return !!rec && rec.enabled;
}

/**
 * Stage a new MFA setup: store the secret + backup code hashes as
 * `enabled=0` (pending). The user then proves possession by submitting
 * a valid TOTP via `enableMfa()`. If a pending setup already exists for
 * this user, it is overwritten.
 */
export function setPendingMfaSecret(
  userId: string,
  secret: string,
  backupCodeHashes: string[]
): void {
  ensureTable();
  const db = getDb();
  db.prepare(`
    INSERT INTO user_mfa (user_id, secret, backup_code_hashes, enabled, created_at, updated_at)
    VALUES (?, ?, ?, 0, datetime('now'), datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      secret = excluded.secret,
      backup_code_hashes = excluded.backup_code_hashes,
      enabled = 0,
      updated_at = datetime('now')
  `).run(userId, secret, JSON.stringify(backupCodeHashes));
}

/**
 * Verify a TOTP against the pending secret and, on success, mark MFA as
 * enabled. Returns true on success.
 *
 * If no pending setup exists, or the token is wrong, returns false.
 */
export function enableMfa(userId: string, token: string): boolean {
  const rec = getMfaRecord(userId);
  if (!rec || rec.enabled) return false;
  if (!verifyTotp(token, rec.secret)) return false;
  const db = getDb();
  db.prepare(`
    UPDATE user_mfa SET enabled = 1, updated_at = datetime('now') WHERE user_id = ?
  `).run(userId);
  return true;
}

/**
 * Verify a TOTP against the active secret and, on success, delete the
 * MFA record entirely. Returns true on success.
 *
 * If no MFA is enabled, or the token is wrong, returns false. As a
 * safety valve, a valid backup code may be supplied instead via the
 * optional second argument.
 */
export function disableMfa(userId: string, token: string, backupCode?: string): boolean {
  const rec = getMfaRecord(userId);
  if (!rec || !rec.enabled) return false;

  let tokenValid = verifyTotp(token, rec.secret);
  let consumedBackupIndex = -1;
  if (!tokenValid && backupCode) {
    consumedBackupIndex = verifyBackupCode(backupCode, rec.backupCodeHashes);
    tokenValid = consumedBackupIndex >= 0;
  }
  if (!tokenValid) return false;

  // If the user used a backup code (rather than a TOTP) to disable MFA,
  // we still delete the entire record — disabling MFA is itself the
  // revocation. (The backup code is consumed as a side effect.)
  const db = getDb();
  db.prepare("DELETE FROM user_mfa WHERE user_id = ?").run(userId);
  return true;
}

/**
 * Consume a backup code (mark it as used by removing it from the
 * stored list). Used during MFA-gated login when the user has lost
 * their authenticator device. Returns true if the code was valid and
 * consumed.
 */
export function consumeBackupCode(userId: string, code: string): boolean {
  const rec = getMfaRecord(userId);
  if (!rec || !rec.enabled) return false;
  const idx = verifyBackupCode(code, rec.backupCodeHashes);
  if (idx < 0) return false;
  const remaining = rec.backupCodeHashes.filter((_, i) => i !== idx);
  const db = getDb();
  db.prepare(`
    UPDATE user_mfa SET backup_code_hashes = ?, updated_at = datetime('now') WHERE user_id = ?
  `).run(JSON.stringify(remaining), userId);
  return true;
}
