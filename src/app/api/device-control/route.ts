// POST /api/device-control — execute a device action.
//
// Body: { action: DeviceAction, params: Record<string, unknown> }
//
// Returns 200 with `{ ok, result: DeviceActionResult }` on success or
// 400/401 on validation/auth failure. The result's `success` flag
// reflects whether the device action itself completed — the HTTP status
// reflects whether the request was well-formed + authorized.
//
// SECURITY: this route exposes the user's device (filesystem, shell,
// processes, clipboard) to a remote caller. The security boundary is:
//   1. requireAuth + getUserId — only the authenticated user can call.
//   2. audit log — every invocation is recorded with the action slug,
//      target path / pid / command (for destructive ops), and the
//      caller's IP + user-agent. The OUTPUT is intentionally NOT
//      logged — a read_file on ~/.ssh/id_rsa must not land in the
//      audit trail.
//   3. action allow-list — only the 16 actions in DEVICE_ACTIONS are
//      accepted. Unknown actions are rejected with 400.
//
// The route does NOT impose an IP allowlist (requireAdminAccess) — it
// is user-facing, not admin tooling. A production deployment that
// wants to lock down device control further can set ADMIN_IP_ALLOWLIST
// and call requireAdminAccess first.
//
// The route runs in the nodejs runtime (not edge) because the
// device-control library uses child_process / fs / os which are not
// available in the edge runtime.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId, requireAdminAccess } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { sanitizeError } from "@/lib/sanitize-error";
import { logger } from "@/lib/logger";
import {
  executeDeviceAction,
  isDeviceAction,
  DEVICE_ACTIONS,
  type DeviceAction,
} from "@/lib/device-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DeviceControlBody {
  action?: unknown;
  params?: unknown;
}

/**
 * Sanitize the action-specific metadata that gets audit-logged.
 *
 * We deliberately do NOT include the action's output (size + privacy —
 * a read_file on a private key must not land in the audit trail). We
 * DO include the target path / PID / command for destructive ops so an
 * operator reviewing the audit log can see exactly what was touched.
 */
function auditMetadata(
  action: DeviceAction,
  params: Record<string, unknown>
): Record<string, unknown> {
  const meta: Record<string, unknown> = { action };
  // Whitelist the fields that are safe + useful for audit reconstruction.
  if (typeof params.path === "string") meta.path = params.path;
  if (typeof params.command === "string") meta.command = params.command.slice(0, 500);
  if (typeof params.package === "string") meta.package = params.package;
  if (typeof params.pid === "number") meta.pid = params.pid;
  if (typeof params.url === "string") meta.url = params.url.slice(0, 500);
  // content / text (write_file, clipboard_write) are intentionally
  // omitted — they can be large and can contain sensitive data.
  return meta;
}

export async function POST(req: NextRequest) {
  // NC-1 (CVSS 9.8) v5 audit fix: device-control exposes the user's
  // filesystem + shell at near-arbitrary scope. In addition to the
  // library-level path/command allowlists, the route is now admin-only
  // via `requireAdminAccess`. Operators must set ADMIN_IP_ALLOWLIST
  // (comma-separated IPs) to lock device-control to known operational
  // egress IPs. When ADMIN_IP_ALLOWLIST is unset, the check is a no-op
  // (preserves existing dev/preview behavior).
  const adminFail = requireAdminAccess(req);
  if (adminFail) return adminFail;
  // Auth: device control exposes the user's filesystem + shell. Only
  // the authenticated user can invoke it. (API-key auth is intentionally
  // NOT supported here — programmatic device control should go through
  // a dedicated, separately-audited integration, not the user's API key.)
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  let body: DeviceControlBody;
  try {
    body = (await req.json()) as DeviceControlBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const action = body.action;
  if (!isDeviceAction(action)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unknown or missing action. Valid actions: ${DEVICE_ACTIONS.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  // Validate params shape — must be a flat object (or absent).
  let params: Record<string, unknown> = {};
  if (body.params !== undefined) {
    if (
      typeof body.params !== "object" ||
      body.params === null ||
      Array.isArray(body.params)
    ) {
      return NextResponse.json(
        { ok: false, error: "'params' must be an object." },
        { status: 400 }
      );
    }
    params = body.params as Record<string, unknown>;
  }

  // Audit-log BEFORE executing so even a failed execution is recorded.
  // The metadata includes the action slug + target path / pid / command
  // (whitelist — see auditMetadata). The output is NOT logged.
  logSensitiveAction("device_control.action", userId, req, auditMetadata(action, params));

  try {
    const result = executeDeviceAction(action, params);
    logger.debug(
      {
        module: "device-control",
        userId,
        action,
        success: result.success,
        os: result.os,
      },
      "Device action executed"
    );
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    // The library is designed to never throw — all errors are returned
    // as `{ success: false, error }` in the DeviceActionResult. This
    // catch is defense-in-depth for unexpected failures (e.g. a panic
    // in a native module).
    logger.warn(
      {
        module: "device-control",
        userId,
        action,
        err: sanitizeError(err),
      },
      "Device action threw unexpectedly"
    );
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeError(err) || "Device action failed.",
      },
      { status: 500 }
    );
  }
}
