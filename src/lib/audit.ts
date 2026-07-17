// Audit logging — records every significant user action for enterprise compliance.

import type { NextRequest } from "next/server";
import { getDb } from "./db";
import { logger } from "./logger";

export interface AuditEntry {
  userId: string;
  action: string;
  resource: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * The canonical list of "sensitive" actions whose audit logging is
 * required by the SOC 2 + GDPR readiness assessment. Each entry maps
 * an action slug to the resource string stored in `audit_logs.resource`.
 *
 * Routes that perform these actions should call `logSensitiveAction()`
 * (which delegates to `logAudit()`) so the action slug is consistently
 * spelled across the codebase. The slug is also used by the SOC 2 /
 * GDPR reports in `/legal/SOC2_READINESS.md`.
 */
export const SENSITIVE_ACTIONS = {
  "account.create": "account",
  "account.delete": "account",
  "account.export": "account",
  "auth.login": "auth",
  "auth.logout": "auth",
  "auth.mfa_enable": "auth",
  "auth.mfa_disable": "auth",
  "auth.mfa_verify": "auth",
  "billing.subscribe": "billing",
  "billing.cancel": "billing",
  "billing.portal_access": "billing",
  "connector.create": "connector",
  "connector.delete": "connector",
  "connector.credentials_access": "connector",
  "research.start": "research",
  "research.stop": "research",
  "research.delete": "research",
  "code.execute": "code",
  "admin.access": "admin",
} as const;

export type SensitiveAction = keyof typeof SENSITIVE_ACTIONS;

/**
 * Convenience helper for logging a sensitive action with a consistent
 * resource string derived from `SENSITIVE_ACTIONS`. Pulls IP + user-agent
 * from the request automatically when supplied.
 *
 * Example:
 *   logSensitiveAction("auth.mfa_enable", userId, req, { method: "totp" });
 */
export function logSensitiveAction(
  action: SensitiveAction,
  userId: string,
  req?: NextRequest | null,
  metadata?: Record<string, unknown>
): void {
  const resource = SENSITIVE_ACTIONS[action];
  const ip =
    req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req?.headers.get("x-real-ip") ||
    undefined;
  const userAgent = req?.headers.get("user-agent") || undefined;
  logAudit({
    userId,
    action,
    resource,
    ip,
    userAgent,
    metadata,
  });
}

export function logAudit(entry: AuditEntry): void {
  try {
    const db = getDb();
    // Ensure table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.prepare(
      "INSERT INTO audit_logs (id, user_id, action, resource, ip, user_agent, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).run(
      crypto.randomUUID(),
      entry.userId,
      entry.action,
      entry.resource,
      entry.ip || null,
      entry.userAgent || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null
    );
  } catch (err) {
    logger.warn({ err, entry }, "Failed to log audit entry");
  }
}

export function getAuditLogs(userId: string, limit = 50): Array<Record<string, unknown>> {
  try {
    const db = getDb();
    return db.prepare(
      "SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(userId, limit) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}
