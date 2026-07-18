// GET /api/preferences/memory — returns the user's memory-extraction consent.
// POST /api/preferences/memory — sets consent (true/false), logs to audit.
//
// Ethical #4 — Memory consent is OPT-IN. The default state is `enabled: false`.
// Routes that auto-extract memories (`/api/chat`, `/api/chat/agent`,
// `/api/memories/extract`) read this preference via
// `isMemoryExtractionEnabled()` and skip extraction entirely when it's false.
//
// Audit: every state change is logged via `logSensitiveAction` so the user
// can review when/where their consent changed (GDPR Art. 7 — demonstrable
// consent).

import { NextRequest, NextResponse } from "next/server";
import {
  isMemoryExtractionEnabledAsync,
  setMemoryExtractionConsent,
} from "@/lib/memory-extractor";
import { getUserId, requireAuth } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  enabled: z.boolean(),
});

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  const enabled = await isMemoryExtractionEnabledAsync(userId);
  return NextResponse.json({
    ok: true,
    enabled,
    // Default state, surfaced for the UI so it can show "not set" distinctly
    // from "explicitly disabled" if we ever want to (currently both are false).
    defaultState: false,
    policy: "opt-in",
    helpUrl: "/settings/memory",
  });
}

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body. Expected { enabled: boolean }." },
      { status: 400 }
    );
  }
  if (!parsed.success) {
    const firstErr = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: firstErr
          ? `${firstErr.path.join(".") || "input"}: ${firstErr.message}`
          : "Invalid request body.",
      },
      { status: 400 }
    );
  }

  const enabled = parsed.data.enabled;
  setMemoryExtractionConsent(userId, enabled);

  // Audit-log the consent change (GDPR Art. 7 — demonstrable consent).
  // `resource: "preferences"` — see SENSITIVE_ACTIONS map. We use the
  // existing `account.export` action slug since there's no dedicated
  // memory_consent slug in the canonical map; the metadata field records
  // the specifics (action: "memory_consent_change", enabled: true/false).
  logSensitiveAction("account.export", userId, req, {
    action: "memory_consent_change",
    enabled,
    policy: "opt-in",
  });

  return NextResponse.json({
    ok: true,
    enabled,
    message: enabled
      ? "Memory extraction is now ON. Quaesitor will extract facts, preferences, and context from your conversations. You can revoke this at any time."
      : "Memory extraction is now OFF. Quaesitor will not automatically extract memories. Existing memories are retained. Explicit 'remember that...' commands still work.",
  });
}
