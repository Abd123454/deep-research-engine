// POST /api/auth/register — create a new user account.
// Body: { email, password, name?, dateOfBirth?, ageConfirmed? }
// Returns: { ok: true } or { ok: false, error: string }
//
// ---------- Age gate (COPPA + GDPR Art. 8) ----------
// The user MUST be at least 13 years old to use Quaesitor. Two paths:
//   1. `dateOfBirth` (ISO date string, e.g. "2010-04-15") — the server
//      computes the age and refuses if under 13. This is the stricter
//      path and is recommended.
//   2. `ageConfirmed: true` — a self-attestation checkbox. Used when
//      the user prefers not to disclose their DOB. The timestamp of
//      the confirmation is recorded so the ledger is demonstrable.
//
// If neither field is present, or `ageConfirmed` is false with no DOB,
// the route returns 403 with:
//   "You must be at least 13 years old to use Quaesitor."
//
// On success, the DOB (if provided) and the ageConfirmation consent
// are written to:
//   - the `users` table (date_of_birth, age_confirmed_at columns —
//     added lazily via ALTER TABLE so existing rows don't need a
//     migration)
//   - the `consent_ledger` table (key='ageConfirmation', granted=true)
//     so /api/consent can serve the canonical consent record.

import * as Sentry from "@sentry/nextjs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { createRequestLogger, generateRequestId } from "@/lib/logger";
import { logSensitiveAction } from "@/lib/audit";
import { setConsent } from "@/lib/consent";

const MIN_AGE = 13;

const RegisterSchema = z.object({
  email: z.string().email("Invalid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  name: z.string().max(100).optional(),
  // ISO date string (YYYY-MM-DD). Optional — if provided, the server
  // computes the user's age and refuses registration if under 13.
  dateOfBirth: z.string().optional(),
  // Self-attestation checkbox. Required when dateOfBirth is omitted.
  ageConfirmed: z.boolean().optional(),
});

/** Compute age in whole years from an ISO date string. Returns NaN on bad input. */
function computeAge(isoDob: string, now: Date = new Date()): number {
  // Accept YYYY-MM-DD only. Reject anything that looks like a relative
  // offset or partial date.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDob.trim());
  if (!m) return Number.NaN;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return Number.NaN;
  }
  // Reject obviously invalid calendar dates (e.g. month=13). The Date
  // constructor would happily roll them over, which we don't want.
  if (month < 1 || month > 12 || day < 1 || day > 31) return Number.NaN;
  const dob = new Date(year, month - 1, day);
  // Date rolls over invalid days (e.g. Feb 30 → Mar 2). Detect by
  // checking the components match.
  if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) {
    return Number.NaN;
  }
  let age = now.getFullYear() - year;
  const hadBirthdayThisYear =
    now.getMonth() > month - 1 || (now.getMonth() === month - 1 && now.getDate() >= day);
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, { module: "auth/register" });
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Invalid input." },
        { status: 400 }
      );
    }

    const { email, password, name, dateOfBirth, ageConfirmed } = parsed.data;

    // ---------- Age gate (COPPA + GDPR Art. 8) ----------
    // If dateOfBirth is provided, compute age from it (stricter). Else
    // require ageConfirmed === true (self-attestation). Either path
    // must establish the user is >= 13.
    let ageVerified = false;
    let computedAge: number | null = null;
    if (typeof dateOfBirth === "string" && dateOfBirth.trim().length > 0) {
      const age = computeAge(dateOfBirth);
      if (Number.isNaN(age)) {
        return NextResponse.json(
          { ok: false, error: "Invalid date of birth. Use YYYY-MM-DD format." },
          { status: 400 }
        );
      }
      computedAge = age;
      if (age < MIN_AGE) {
        // COPPA: under-13 is a hard refuse. We do NOT log PII here.
        return NextResponse.json(
          { ok: false, error: "You must be at least 13 years old to use Quaesitor." },
          { status: 403 }
        );
      }
      ageVerified = true;
    } else if (ageConfirmed === true) {
      ageVerified = true;
    } else {
      // No DOB and no explicit confirmation — refuse.
      return NextResponse.json(
        { ok: false, error: "You must be at least 13 years old to use Quaesitor." },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // SENSITIVE ACTION: account creation. The "userId" for the audit
    // entry is the new user's email — they don't have an authenticated
    // session yet, so we use the email as the identifier.
    logSensitiveAction("account.create", email, req, {
      phase: "initiated",
      ageVerified,
      ageGateMethod: computedAge !== null ? "dateOfBirth" : "selfAttestation",
    });

    const ageConfirmedAt = new Date().toISOString();

    // Postgres.
    if (isPostgresAvailable()) {
      try {
        const prisma = await getPrismaDb();
        if (prisma) {
          // Lazily add the date_of_birth / age_confirmed_at columns.
          // Postgres 9.6+ supports ADD COLUMN IF NOT EXISTS.
          try {
            await prisma.$executeRaw`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth TEXT`;
            await prisma.$executeRaw`ALTER TABLE users ADD COLUMN IF NOT EXISTS age_confirmed_at TIMESTAMPTZ`;
          } catch (err) {
            // Non-fatal — older Postgres or column already exists.
            Sentry.captureException(err);
          }

          const existing = await prisma.user.findUnique({ where: { email } });
          if (existing) {
            return NextResponse.json({ ok: false, error: "Email already registered." }, { status: 409 });
          }

          // Create via Prisma (canonical fields), then back-fill the
          // age-gate columns via raw SQL so we don't need to regenerate
          // the Prisma client for this compliance fix.
          const newUser = await prisma.user.create({
            data: { email, passwordHash, name: name || null },
          });

          try {
            await prisma.$executeRaw`UPDATE users SET date_of_birth = ${dateOfBirth ?? null}, age_confirmed_at = ${ageConfirmedAt} WHERE id = ${newUser.id}`;
          } catch (err) {
            Sentry.captureException(err);
          }

          // Record ageConfirmation consent in the ledger (canonical).
          await setConsent(newUser.id, "ageConfirmation", true);

          return NextResponse.json({ ok: true });
        }
      } catch (err) {
        log.warn({ err: err instanceof Error ? err.message : String(err) }, "Postgres failed");
      }
    }

    // SQLite fallback.
    try {
      const db = getDb();
      // Ensure users table exists (with the original columns).
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      // Lazily add the age-gate columns. SQLite's ALTER TABLE ADD COLUMN
      // throws if the column already exists — wrap in try/catch.
      try {
        db.exec(`ALTER TABLE users ADD COLUMN date_of_birth TEXT`);
      } catch { /* column already exists */ }
      try {
        db.exec(`ALTER TABLE users ADD COLUMN age_confirmed_at TEXT`);
      } catch { /* column already exists */ }

      const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
      if (existing) {
        return NextResponse.json({ ok: false, error: "Email already registered." }, { status: 409 });
      }

      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO users (id, email, name, password_hash, date_of_birth, age_confirmed_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, email, name || null, passwordHash, dateOfBirth ?? null, ageConfirmedAt);

      // Record ageConfirmation consent in the ledger (canonical).
      // The user is identified by their new id, so the ledger row is
      // attributable even before they log in.
      try {
        await setConsent(id, "ageConfirmation", true);
      } catch (err) {
        // Non-fatal — the users row is the source of truth for the
        // age gate; the ledger is the demonstrable consent record.
        Sentry.captureException(err);
      }

      return NextResponse.json({ ok: true });
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, "SQLite failed");
      return NextResponse.json({ ok: false, error: "Registration failed." }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}
