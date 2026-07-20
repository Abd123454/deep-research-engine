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
  // Developer platform — API key lifecycle. Every create / revoke is
  // auditable so a compromised key's blast radius can be reconstructed
  // from the audit trail. The `key_prefix` (e.g. "qaesitor_••••") is
  // included in the metadata so the audit log identifies WHICH key was
  // rotated without exposing the secret.
  "apikey.create": "apikey",
  "apikey.delete": "apikey",
  "research.start": "research",
  "research.stop": "research",
  "research.delete": "research",
  // Project lifecycle — every project create / update / delete is
  // auditable so an operator can reconstruct who modified a project
  // (and its connectors) and when. The projectId is recorded in
  // metadata so the audit log identifies WHICH project was touched.
  "project.create": "project",
  "project.update": "project",
  "project.delete": "project",
  "swarm.start": "swarm",
  "code.execute": "code",
  "admin.access": "admin",
  // GDPR Art. 7 — demonstrable consent. Every grant / revoke of a consent
  // key (termsOfService, privacyPolicy, memoryExtraction, marketing,
  // ageConfirmation) is logged with this slug so the consent ledger is
  // fully auditable. See /api/consent.
  "consent.update": "consent",
  // GDPR Art. 20 (subset) — memory portability. The full account export
  // (`account.export`) covers memories as part of the bundle; this slug
  // is for the narrower `/api/memory/export` endpoint that exports ONLY
  // the user's long-term memories + embeddings + access metadata.
  "memory.export": "memory",
  // RBAC — multi-tenant workspace membership lifecycle. Every create /
  // invite / remove is auditable so a workspace admin's invite/remove
  // history can be reconstructed from the audit trail. The workspace
  // (project) id and the target member's userId are included in the
  // metadata so the audit log identifies WHO was added/removed by WHOM.
  "workspace.create": "workspace",
  "workspace.invite": "workspace",
  "workspace.remove": "workspace",
  // MCP transport lifecycle — connecting to / disconnecting from external
  // MCP servers is an auditable action because it potentially exposes
  // research/chat content to a third-party server. The server id and
  // transport type (stdio / sse) are recorded in metadata.
  "mcp.connect": "mcp",
  "mcp.disconnect": "mcp",
  // Computer Use — every browser automation action (click / type /
  // scroll / navigate / screenshot) is auditable because the model can
  // do anything a desktop user can. The action type and (for click /
  // scroll) the target coordinates are recorded. The base64 screenshot
  // is NOT logged (size + privacy).
  "computer_use.action": "computer_use",
  // Device Control — every cross-platform device action (file ops,
  // shell command, package install, process kill, clipboard access,
  // open URL, network/disk probe) is auditable. The action slug +
  // (for destructive ops) the target path / PID / command are
  // recorded in metadata. Output is NOT logged (size + privacy — a
  // read_file on a private key, for example, must not land in the
  // audit trail). See /api/device-control.
  "device_control.action": "device_control",
  // P2-final-wave / Feature 2: Real-time Collaboration. Every create /
  // join / leave / inspect of a Yjs collaboration session is auditable
  // so an operator can reconstruct who collaborated on what document
  // and when. The `op` field in metadata ("create" / "join" / "leave"
  // / "inspect") distinguishes the action; the `sessionId` + (for
  // create) `documentId` are recorded for correlation. See
  // /api/collab/[sessionId].
  "collab.session": "collab",
  // P2-final-wave / Feature 3: Video Understanding. Every video
  // analysis request is auditable because (a) it's CPU-intensive (DoS
  // surface) and (b) the video content may contain sensitive information
  // (a screen recording, a whiteboard with proprietary info, etc.).
  // The videoPath / videoUrl is recorded (capped at 500 chars) so an
  // operator can reconstruct what was analyzed and by whom. The
  // ANALYSIS RESULT (keyframes + transcript) is NOT logged — it can be
  // large and contain sensitive content. See /api/video/analyze.
  "video.analyze": "video",
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
