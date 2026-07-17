// Consent ledger — GDPR Article 7 "Demonstrable consent".
//
// Stores per-user consent grants for the five consent keys required by
// the Quaesitor compliance posture:
//   - termsOfService     (accepted at registration)
//   - privacyPolicy      (accepted at registration)
//   - memoryExtraction   (opt-in, toggleable in /settings/memory)
//   - marketing          (opt-in, default false)
//   - ageConfirmation    (COPPA / GDPR Art. 8 — 13+ gate at registration)
//
// Each entry records:
//   - granted:    boolean (true = user has consented, false = revoked)
//   - timestamp:  ISO string of the most recent grant/revoke
//   - version:    the policy version the user consented to
//
// The ledger is the canonical source of truth for "did this user consent
// to X?" — routes that perform the regulated action SHOULD consult the
// ledger (or the convenience helper `isConsentGranted`) before acting.
//
// Storage: SQLite (better-sqlite3) via getDb(). The table is created
// lazily on first access via CREATE TABLE IF NOT EXISTS. Postgres path
// uses $executeRaw to create the table and read/write rows.

import * as Sentry from "@sentry/nextjs";

import { getDb, isPostgresAvailable, getPrismaDb } from "./db";
import { logger } from "./logger";

export const CONSENT_KEYS = [
  "termsOfService",
  "privacyPolicy",
  "memoryExtraction",
  "marketing",
  "ageConfirmation",
] as const;

export type ConsentKey = (typeof CONSENT_KEYS)[number];

export const CURRENT_POLICY_VERSION = "1.0";

export interface ConsentRecord {
  granted: boolean;
  timestamp: string | null;
  version: string | null;
}

export type ConsentMap = Record<ConsentKey, ConsentRecord>;

const EMPTY_CONSENT: ConsentRecord = { granted: false, timestamp: null, version: null };

function isConsentKey(k: string): k is ConsentKey {
  return (CONSENT_KEYS as readonly string[]).includes(k);
}

// ---------- SQLite schema bootstrap ----------

function ensureSqliteTable(): void {
  try {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS consent_ledger (
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        granted INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        version TEXT,
        PRIMARY KEY (user_id, key)
      )
    `);
  } catch (err) {
    // Don't crash — consent lookups degrade to "not granted" on failure.
    logger.warn(
      { module: "consent", err: err instanceof Error ? err.message : String(err) },
      "Failed to ensure consent_ledger table"
    );
  }
}

// ---------- Postgres schema bootstrap ----------

async function ensurePostgresTable(): Promise<void> {
  if (!isPostgresAvailable()) return;
  try {
    const prisma = await getPrismaDb();
    if (!prisma) return;
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS consent_ledger (
        user_id   TEXT NOT NULL,
        key       TEXT NOT NULL,
        granted   BOOLEAN NOT NULL DEFAULT FALSE,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        version   TEXT,
        PRIMARY KEY (user_id, key)
      )
    `;
  } catch (err) {
    Sentry.captureException(err);
    logger.warn(
      { module: "consent", err: err instanceof Error ? err.message : String(err) },
      "Failed to ensure Postgres consent_ledger table"
    );
  }
}

// ---------- Read ----------

/**
 * Returns the user's full consent map. Every CONSENT_KEYS entry is
 * present; keys with no ledger row return the empty record
 * ({ granted: false, timestamp: null, version: null }).
 */
export async function getConsents(userId: string): Promise<ConsentMap> {
  // Postgres.
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await ensurePostgresTable();
        const rows = await prisma.$queryRaw<
          Array<{ key: string; granted: boolean; timestamp: Date | string; version: string | null }>
        >`SELECT key, granted, timestamp, version FROM consent_ledger WHERE user_id = ${userId}`;
        const map = emptyConsentMap();
        for (const row of rows) {
          if (!isConsentKey(row.key)) continue;
          map[row.key] = {
            granted: !!row.granted,
            timestamp:
              row.timestamp instanceof Date
                ? row.timestamp.toISOString()
                : row.timestamp || null,
            version: row.version || null,
          };
        }
        return map;
      }
    } catch (err) {
      Sentry.captureException(err);
      logger.warn(
        { module: "consent", err: err instanceof Error ? err.message : String(err) },
        "Postgres getConsents failed — falling back to SQLite"
      );
    }
  }

  // SQLite.
  try {
    ensureSqliteTable();
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT key, granted, timestamp, version FROM consent_ledger WHERE user_id = ?"
      )
      .all(userId) as Array<{
        key: string;
        granted: number;
        timestamp: string;
        version: string | null;
      }>;
    const map = emptyConsentMap();
    for (const row of rows) {
      if (!isConsentKey(row.key)) continue;
      map[row.key] = {
        granted: row.granted === 1,
        timestamp: row.timestamp || null,
        version: row.version || null,
      };
    }
    return map;
  } catch (err) {
    Sentry.captureException(err);
    logger.warn(
      { module: "consent", err: err instanceof Error ? err.message : String(err) },
      "SQLite getConsents failed — returning empty map"
    );
    return emptyConsentMap();
  }
}

/**
 * Convenience helper — returns true iff the user has granted the given
 * consent key. Returns false on any error (fail-closed).
 */
export async function isConsentGranted(
  userId: string,
  key: ConsentKey
): Promise<boolean> {
  const map = await getConsents(userId);
  return map[key].granted;
}

// ---------- Write ----------

/**
 * Set the user's consent for a single key. Records the timestamp and
 * policy version. Returns the updated record (or null on failure).
 *
 * NOTE: this function does NOT log to the audit trail — callers are
 * responsible for calling `logSensitiveAction("consent.update", ...)`
 * so the audit entry includes request-scoped metadata (IP, user-agent).
 */
export async function setConsent(
  userId: string,
  key: ConsentKey,
  granted: boolean,
  version: string = CURRENT_POLICY_VERSION
): Promise<ConsentRecord | null> {
  // Postgres.
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await ensurePostgresTable();
        await prisma.$executeRaw`
          INSERT INTO consent_ledger (user_id, key, granted, timestamp, version)
          VALUES (${userId}, ${key}, ${granted}, NOW(), ${version})
          ON CONFLICT (user_id, key) DO UPDATE SET
            granted = EXCLUDED.granted,
            timestamp = EXCLUDED.timestamp,
            version = EXCLUDED.version
        `;
        const rows = await prisma.$queryRaw<
          Array<{ timestamp: Date | string }>
        >`SELECT timestamp FROM consent_ledger WHERE user_id = ${userId} AND key = ${key}`;
        const ts =
          rows.length > 0
            ? rows[0]!.timestamp instanceof Date
              ? (rows[0]!.timestamp as Date).toISOString()
              : String(rows[0]!.timestamp)
            : new Date().toISOString();
        return { granted, timestamp: ts, version };
      }
    } catch (err) {
      Sentry.captureException(err);
      logger.warn(
        { module: "consent", err: err instanceof Error ? err.message : String(err) },
        "Postgres setConsent failed — falling back to SQLite"
      );
    }
  }

  // SQLite.
  try {
    ensureSqliteTable();
    const db = getDb();
    db.prepare(
      `INSERT INTO consent_ledger (user_id, key, granted, timestamp, version)
       VALUES (?, ?, ?, datetime('now'), ?)
       ON CONFLICT(user_id, key) DO UPDATE SET
         granted = excluded.granted,
         timestamp = excluded.timestamp,
         version = excluded.version`
    ).run(userId, key, granted ? 1 : 0, version);
    const row = db
      .prepare(
        "SELECT timestamp FROM consent_ledger WHERE user_id = ? AND key = ?"
      )
      .get(userId, key) as { timestamp: string } | undefined;
    return {
      granted,
      timestamp: row?.timestamp || new Date().toISOString(),
      version,
    };
  } catch (err) {
    Sentry.captureException(err);
    logger.warn(
      { module: "consent", err: err instanceof Error ? err.message : String(err) },
      "SQLite setConsent failed"
    );
    return null;
  }
}

// ---------- Helpers ----------

function emptyConsentMap(): ConsentMap {
  return {
    termsOfService: { ...EMPTY_CONSENT },
    privacyPolicy: { ...EMPTY_CONSENT },
    memoryExtraction: { ...EMPTY_CONSENT },
    marketing: { ...EMPTY_CONSENT },
    ageConfirmation: { ...EMPTY_CONSENT },
  };
}

export function isValidConsentKey(k: unknown): k is ConsentKey {
  return typeof k === "string" && isConsentKey(k);
}
