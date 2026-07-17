// POST /api/memories/extract — auto-extract memories from a conversation.
// Body: { conversation: [{ role, content }] }
//
// Ethical #4 — Memory consent gate: this endpoint respects the user's
// opt-in preference for automatic extraction. When the preference is not
// set (the default), the endpoint returns { ok: true, stored: 0,
// reason: "memory_consent_disabled" } instead of extracting — no error,
// because the user's UI is allowed to call this proactively after every
// conversation; the consent gate simply makes it a no-op.

import { NextRequest, NextResponse } from "next/server";
import { extractAndStoreMemories, isMemoryExtractionEnabledAsync } from "@/lib/memory-extractor";
import { sanitizeQuery, sanitizeInput } from "@/lib/prompt-security";
import { getUserId, requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Refuse anonymous access when auth is configured.
    const authFail = requireAuth(req);
    if (authFail) return authFail;
    const userId = getUserId(req);

    const body = await req.json();
    const conversation = body.conversation as { role: string; content: string }[];
    if (!Array.isArray(conversation) || conversation.length === 0) {
      return NextResponse.json({ ok: false, error: "No conversation provided." }, { status: 400 });
    }

    // ---------- Consent gate (Ethical #4) ----------
    // Default is FALSE — extraction is skipped until the user opts in via
    // /api/preferences/memory. We return a structured "no-op" response so
    // the UI can distinguish "consent disabled" from "extraction ran but
    // found nothing".
    const consented = await isMemoryExtractionEnabledAsync(userId);
    if (!consented) {
      return NextResponse.json({
        ok: true,
        stored: 0,
        reason: "memory_consent_disabled",
        message:
          "Automatic memory extraction is off. Turn it on in Settings → Memory to let Quaesitor remember facts about you across conversations.",
      });
    }

    // Prompt injection defense: sanitize each message content before extraction.
    const sanitizedConversation = conversation.map((m) => {
      const injectionCheck = sanitizeQuery(m.content);
      if (injectionCheck.blocked) {
        // Skip blocked content (replace with placeholder).
        return { role: m.role, content: "[content blocked: potential injection]" };
      }
      return { role: m.role, content: sanitizeInput(injectionCheck.sanitized) };
    });

    // Combine conversation into a single text for extraction.
    const text = sanitizedConversation
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");

    const stored = await extractAndStoreMemories(userId, text);
    return NextResponse.json({ ok: true, stored });
  } catch {
    return NextResponse.json({ ok: false, error: "Extraction failed." }, { status: 500 });
  }
}
