# Task p0-compliance — 3 P0 Compliance Fixes

**Agent:** p0-compliance
**Task ID:** p0-compliance
**Status:** ✅ Complete
**Date:** 2026-07-17 (per system clock)

## Scope

Close the three remaining P0 compliance gaps:

1. **FIX 1 — Age gate (13+) in registration** (COPPA + GDPR Art. 8)
2. **FIX 2 — `GET/POST /api/consent` consent ledger** (GDPR Art. 7)
3. **FIX 3 — Memory consent toggle UI in `/settings/memory`**

## What was done

### FIX 1 — Age gate
- `src/app/api/auth/register/route.ts`:
  - Extended the Zod schema to accept `dateOfBirth` (ISO date) and
    `ageConfirmed` (boolean).
  - Server computes age from DOB when provided; under-13 → 403 with
    the exact error string `"You must be at least 13 years old to use
    Quaesitor."`. Self-attestation (`ageConfirmed: true`) is the
    fallback when no DOB is supplied. Missing both → 403.
  - Lazily adds `date_of_birth TEXT` and `age_confirmed_at TEXT`/
    `TIMESTAMPTZ` columns to the `users` table (SQLite try/catch,
    Postgres `ADD COLUMN IF NOT EXISTS`).
  - Writes an `ageConfirmation` consent row to the `consent_ledger`
    table on success (canonical record for `/api/consent`).
  - `account.create` audit metadata now records
    `ageGateMethod: "dateOfBirth" | "selfAttestation"`.
- `src/app/register/page.tsx`:
  - Added a `<input type="date">` for DOB (optional, `max` set to
    13 years ago so the picker can't select a disqualifying date).
  - Added a required checkbox "I confirm I am at least 13 years
    old…" with links to Terms and Privacy Policy.
  - Submit button is disabled until the checkbox is checked
    (`canSubmit = ageConfirmed && !loading`).
- `e2e/auth.spec.ts`: signup test now checks `#ageConfirmed` before
  clicking submit (Playwright would otherwise time out on the
  disabled button).

### FIX 2 — Consent ledger
- **Created** `src/lib/consent.ts`:
  - `CONSENT_KEYS` = `termsOfService`, `privacyPolicy`,
    `memoryExtraction`, `marketing`, `ageConfirmation`.
  - `CURRENT_POLICY_VERSION = "1.0"`.
  - `getConsents(userId)` → full `ConsentMap` (every key present,
    missing rows default to `{ granted: false, timestamp: null,
    version: null }`).
  - `setConsent(userId, key, granted, version?)` → upserts the
    ledger row with a fresh timestamp.
  - `isConsentGranted(userId, key)` → boolean convenience helper.
  - Owns the `consent_ledger` table schema (created lazily on both
    SQLite and Postgres). Composite PK on `(user_id, key)`.
- **Created** `src/app/api/consent/route.ts`:
  - `GET /api/consent` — returns `{ ok, userId, consents }` in the
    exact shape the audit specified.
  - `POST /api/consent` — body `{ key, granted, version? }`,
    Zod-validated against `CONSENT_KEYS`. Writes via `setConsent`,
    audit-logs via `logSensitiveAction("consent.update", userId,
    req, { key, granted, version })`. When `key ===
    "memoryExtraction"`, mirrors the value into the legacy
    `user_preferences.memory_consent` column via
    `setMemoryExtractionConsent` so the existing hot-path gate
    (`isMemoryExtractionEnabled`, read by `/api/chat`,
    `/api/chat/agent`, `/api/memories/extract`) keeps working
    without a migration.
- **Modified** `src/lib/audit.ts`: added `"consent.update":
  "consent"` to `SENSITIVE_ACTIONS` so the new slug is canonical
  and surfaces in SOC 2 / GDPR reports.

### FIX 3 — Memory consent toggle UI
- `src/app/settings/memory/page.tsx`:
  - Added a prominent consent card at the top of the page with:
    - Shield icon (Lucide) in a saddle-brown tinted square.
    - Label "Memory extraction" (font-ui).
    - Description: "When enabled, Quaesitor will automatically
      extract and store key facts from your conversations to
      provide personalized responses. You can delete all memories
      at any time. See Privacy Policy." (font-body, with a real
      link to `/privacy`).
    - A `role="switch"` toggle button: `#8b4513` background when
      ON, `#d9d4c7` when OFF, white knob, smooth transition,
      keyboard-accessible, `aria-checked` reflects state, `sr-only`
      label for screen readers.
  - Loads initial state from `GET /api/preferences/memory` on mount.
  - On toggle, calls `POST /api/preferences/memory` with
    `{ enabled: next }`. Surfaces loading / saving / error states
    via `aria-live="polite"` and `role="alert"`.

### Bonus — pre-existing lint fix
- `src/lib/auth.ts` line 148 had a pre-existing
  `@typescript-eslint/no-require-imports` error on the MFA
  `require("./mfa")` lazy-load. Added an `eslint-disable-next-line`
  comment so `bun run lint` reports 0 errors. (Converting to a
  dynamic `import()` would require making `requireAuth` async and
  touching every caller — out of scope for this task.)

## Files Touched

| File | Action |
|---|---|
| `src/lib/consent.ts` | **created** |
| `src/app/api/consent/route.ts` | **created** |
| `src/lib/audit.ts` | modified (added `consent.update` slug) |
| `src/app/api/auth/register/route.ts` | modified (age gate + ledger write) |
| `src/app/register/page.tsx` | modified (DOB input + checkbox) |
| `src/app/settings/memory/page.tsx` | modified (consent toggle card) |
| `e2e/auth.spec.ts` | modified (check `#ageConfirmed` before submit) |
| `src/lib/auth.ts` | modified (eslint-disable on MFA lazy require) |

## Verification

| Check | Result |
|---|---|
| `bunx tsc --noEmit --strict` | **0 errors** |
| `bun run lint` | **0 errors** (5 pre-existing warnings, none from this task) |
| `bun run test` | **446 passed \| 1 skipped (447)** — identical to baseline |

## Key Design Decisions

1. **The `consent_ledger` table is the canonical source of truth.**
   The legacy `user_preferences.memory_consent` column is now a
   denormalized cache that `/api/consent` keeps in sync. New
   consent-gated features should write to the ledger via
   `setConsent()` and read via `isConsentGranted()` — not add
   another ad-hoc column.

2. **DOB is stored on the `users` row, NOT in the ledger.** DOB is
   PII; the ledger only records the *fact* of age confirmation
   (`ageConfirmation: granted=true, timestamp, version`). This keeps
   the ledger lightweight and ensures the GDPR Art. 17 erasure path
   (`DELETE /api/account`) drops the DOB along with the user row.

3. **Two age-gate paths, server re-validates both.** The UI gate
   (disabled submit until checkbox) is UX, not security — the
   server independently requires either a valid 13+ DOB or an
   explicit `ageConfirmed: true`. A crafted request without either
   is refused with 403.

4. **`ageGateMethod` in the audit metadata** distinguishes
   `dateOfBirth` from `selfAttestation` so a future compliance
   review can find self-attested accounts if a jurisdiction tightens
   the proof requirement (e.g. GDPR Art. 8(2) member-state
   derogations for under-16s).

5. **The memory toggle is a native `role="switch"` button**, not a
   shadcn Switch — there isn't one in `src/components/ui`. It's
   keyboard-accessible (Space/Enter flips it) and announces state
   via `aria-checked`. Swap for a real Switch component if one is
   added later.
