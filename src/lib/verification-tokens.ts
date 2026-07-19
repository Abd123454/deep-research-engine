// verification-tokens — single-use tokens for email verification and
// password reset flows.
//
// C-2 (CVSS 9.1): previously /api/auth/verify and /api/auth/reset-password
// accepted ANY non-empty token as valid — an attacker could bypass email
// verification by posting `{ token: "x" }` and could reset ANY user's
// password by posting `{ token: "x", password: "new" }` (the route didn't
// even know which user to update). This module fixes both by storing
// real signed random tokens in a `verification_tokens` table with:
//   - expiry (24h for email verification, 1h for password reset)
//   - single-use (consumed atomically via `used_at`)
//   - typed (so a verification token can't be used as a reset token)
//
// The token is 32 random bytes hex-encoded (256 bits of entropy). It is
// stored verbatim — we trust the DB layer (the same layer that stores
// bcrypt password hashes) to keep the table confidential. For higher
// assurance, hash the token at rest like the `api_keys` table does; the
// API surface here is intentionally minimal so the migration is easy.
//
// Schema (matches the C-2 audit prescription):
//   CREATE TABLE IF NOT EXISTS verification_tokens (
//     id          TEXT PRIMARY KEY,
//     user_id     TEXT NOT NULL,
//     token       TEXT UNIQUE NOT NULL,
//     type        TEXT NOT NULL,
//     expires_at  DATETIME NOT NULL,
//     used_at     DATETIME,
//     created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
//   )

import * as crypto from "crypto";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { logger } from "./logger";

export type VerificationTokenType = "email_verification" | "password_reset";

export interface VerificationTokenRow {
  id: string;
  user_id: string;
  token: string;
  type: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

/** TTLs per token type. */
const TTL_MS: Record<VerificationTokenType, number> = {
  email_verification: 24 * 60 * 60 * 1000, // 24h
  password_reset: 60 * 60 * 1000, // 1h
};

/** Lazily create the verification_tokens table on both backends. */
export async function ensureVerificationTokensTable(): Promise<void> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS verification_tokens (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            token       TEXT UNIQUE NOT NULL,
            type        TEXT NOT NULL,
            expires_at  TIMESTAMPTZ NOT NULL,
            used_at     TIMESTAMPTZ,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token)`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id)`;
        return;
      }
    } catch (err) {
      logger.warn(
        { module: "verification-tokens", err: err instanceof Error ? err.message : String(err) },
        "Failed to ensure verification_tokens table on Postgres — falling back to SQLite"
      );
    }
  }

  try {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        token       TEXT UNIQUE NOT NULL,
        type        TEXT NOT NULL,
        expires_at  TEXT NOT NULL,
        used_at     TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id)`);
  } catch (err) {
    logger.error(
      { module: "verification-tokens", err: err instanceof Error ? err.message : String(err) },
      "Failed to ensure verification_tokens table on SQLite"
    );
  }
}

/**
 * Mint a single-use token of the given type for the given user. Returns the
 * raw token string (NOT a hash) — the caller emails it to the user and the
 * verification endpoint matches it verbatim against the `token` column.
 */
export async function createVerificationToken(
  userId: string,
  type: VerificationTokenType
): Promise<string> {
  await ensureVerificationTokensTable();
  const id = crypto.randomUUID();
  // 32 random bytes → 64 hex chars. 256 bits of entropy — unbruteforceable.
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS[type]).toISOString();

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.$executeRaw`
          INSERT INTO verification_tokens (id, user_id, token, type, expires_at)
          VALUES (${id}, ${userId}, ${token}, ${type}, ${expiresAt})
        `;
        return token;
      }
    } catch (err) {
      logger.warn(
        { module: "verification-tokens", err: err instanceof Error ? err.message : String(err) },
        "Postgres insert failed — falling back to SQLite"
      );
    }
  }

  const db = getDb();
  db.prepare(
    "INSERT INTO verification_tokens (id, user_id, token, type, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, userId, token, type, expiresAt);
  return token;
}

/**
 * Look up a token without consuming it. Returns the row if the token exists,
 * is of the right type, is not expired, and has not been used. Otherwise null.
 *
 * Use `consumeVerificationToken` for the actual verify/reset flows — that
 * version atomically marks the token as used so it can't be replayed.
 */
export async function findValidVerificationToken(
  token: string,
  type: VerificationTokenType
): Promise<VerificationTokenRow | null> {
  await ensureVerificationTokensTable();

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const rows = await prisma.$queryRaw<VerificationTokenRow[]>`
          SELECT id, user_id, token, type, expires_at, used_at, created_at
          FROM verification_tokens
          WHERE token = ${token}
            AND type = ${type}
            AND used_at IS NULL
            AND expires_at > CURRENT_TIMESTAMP
        `;
        return rows[0] ?? null;
      }
    } catch (err) {
      logger.warn(
        { module: "verification-tokens", err: err instanceof Error ? err.message : String(err) },
        "Postgres lookup failed — falling back to SQLite"
      );
    }
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, token, type, expires_at, used_at, created_at
       FROM verification_tokens
       WHERE token = ? AND type = ? AND used_at IS NULL AND expires_at > datetime('now')`
    )
    .get(token, type) as VerificationTokenRow | undefined;
  return row ?? null;
}

/**
 * Atomically validate + consume a token. Returns the `{ userId }` on success
 * or `null` if the token is missing, wrong type, expired, or already used.
 *
 * The consume is wrapped in a transaction so two concurrent requests with
 * the same token can't both succeed (the first wins, the second sees
 * `used_at IS NOT NULL` and fails).
 */
export async function consumeVerificationToken(
  token: string,
  type: VerificationTokenType
): Promise<{ userId: string } | null> {
  await ensureVerificationTokensTable();

  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        // Postgres RETURNING gives us an atomic consume.
        const rows = await prisma.$queryRaw<{ user_id: string }[]>`
          UPDATE verification_tokens
          SET used_at = CURRENT_TIMESTAMP
          WHERE token = ${token}
            AND type = ${type}
            AND used_at IS NULL
            AND expires_at > CURRENT_TIMESTAMP
          RETURNING user_id
        `;
        if (rows.length === 0) return null;
        return { userId: rows[0].user_id };
      }
    } catch (err) {
      logger.warn(
        { module: "verification-tokens", err: err instanceof Error ? err.message : String(err) },
        "Postgres consume failed — falling back to SQLite"
      );
    }
  }

  // SQLite — better-sqlite3 transactions are synchronous, so we can use
  // BEGIN IMMEDIATE to lock the row against concurrent requests.
  const db = getDb();
  const consume = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT user_id FROM verification_tokens
         WHERE token = ? AND type = ? AND used_at IS NULL AND expires_at > datetime('now')`
      )
      .get(token, type) as { user_id: string } | undefined;
    if (!row) return null;
    db.prepare(
      `UPDATE verification_tokens SET used_at = datetime('now') WHERE token = ? AND type = ?`
    ).run(token, type);
    return { userId: row.user_id };
  });
  return consume();
}

/**
 * Best-effort cleanup of expired or already-used tokens. Call this from a
 * background worker or on token creation (rate-limited) to keep the table
 * from growing unboundedly. Errors are logged and swallowed — cleanup is
 * not on the critical path.
 */
export async function pruneVerificationTokens(): Promise<void> {
  try {
    await ensureVerificationTokensTable();
    if (isPostgresAvailable()) {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.$executeRaw`DELETE FROM verification_tokens WHERE expires_at < CURRENT_TIMESTAMP OR used_at IS NOT NULL`;
        return;
      }
    }
    const db = getDb();
    db.prepare(
      `DELETE FROM verification_tokens WHERE expires_at < datetime('now') OR used_at IS NOT NULL`
    ).run();
  } catch (err) {
    logger.warn(
      { module: "verification-tokens", err: err instanceof Error ? err.message : String(err) },
      "Failed to prune verification_tokens (non-fatal)"
    );
  }
}
