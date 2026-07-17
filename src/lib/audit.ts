// Audit logging — records every significant user action for enterprise compliance.

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
