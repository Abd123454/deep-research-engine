// GET  /api/consent     — GDPR Art. 7 consent ledger (read).
// POST /api/consent     — update a single consent key.
//
// Returns / accepts the five consent keys required by the Quaesitor
// compliance posture:
//   - termsOfService
//   - privacyPolicy
//   - memoryExtraction
//   - marketing
//   - ageConfirmation
//
// GET response shape:
//   {
//     "userId": "admin",
//     "consents": {
//       "termsOfService":   { "granted": true,  "timestamp": "...", "version": "1.0" },
//       "privacyPolicy":    { "granted": true,  "timestamp": "...", "version": "1.0" },
//       "memoryExtraction": { "granted": false, "timestamp": null,  "version": null  },
//       "marketing":        { "granted": false, "timestamp": null,  "version": null  },
//       "ageConfirmation":  { "granted": true,  "timestamp": "...", "version": "1.0" }
//     }
//   }
//
// POST body: { "key": "memoryExtraction", "granted": true }
// POST response: { "ok": true, "consent": { ...the updated record } }
//
// All reads and writes are audit-logged via logSensitiveAction with the
// `consent.update` slug so the consent ledger is fully demonstrable
// (GDPR Art. 7(1) — "demonstrate that the data subject has consented").

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId, requireAuth } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import {
  CONSENT_KEYS,
  getConsents,
  setConsent,
  isValidConsentKey,
  type ConsentKey,
} from "@/lib/consent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostSchema = z.object({
  key: z.enum(CONSENT_KEYS),
  granted: z.boolean(),
  version: z.string().max(20).optional(),
});

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  const consents = await getConsents(userId);
  return NextResponse.json({ ok: true, userId, consents });
}

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  let parsed;
  try {
    parsed = PostSchema.safeParse(await req.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body. Expected { key, granted }." },
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

  const { key, granted, version } = parsed.data;
  // `version` is optional — fall back to the current policy version inside
  // setConsent. Type-narrow to satisfy the lib's ConsentKey type.
  const consentKey: ConsentKey = isValidConsentKey(key) ? key : key as ConsentKey;

  const updated = await setConsent(
    userId,
    consentKey,
    granted,
    version
  );

  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Failed to update consent. Please try again." },
      { status: 500 }
    );
  }

  // GDPR Art. 7 — demonstrable consent. Every grant / revoke is logged
  // with the consent.update slug and the key + new value in metadata.
  logSensitiveAction("consent.update", userId, req, { key, granted, version: updated.version });

  // Side-effect: when the memoryExtraction consent changes, mirror it
  // into the legacy `user_preferences.memory_consent` column so the
  // existing isMemoryExtractionEnabled() gate (read by /api/chat,
  // /api/chat/agent, /api/memories/extract) honors the consent ledger.
  if (consentKey === "memoryExtraction") {
    try {
      const { setMemoryExtractionConsent } = await import("@/lib/memory-extractor");
      setMemoryExtractionConsent(userId, granted);
    } catch {
      // Non-fatal — the consent_ledger row is the source of truth; the
      // legacy column is just a denormalized cache for the hot path.
    }
  }

  return NextResponse.json({ ok: true, consent: updated });
}
