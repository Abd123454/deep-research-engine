// GET /api/preferences — get user preferences.
// PUT /api/preferences — update preferences.
import * as Sentry from "@sentry/nextjs";


import { NextRequest, NextResponse } from "next/server";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import type { UserPreferenceRow } from "@/lib/sqlite-types";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth";

const DEFAULT_PREFS = {
  preferredLanguage: "auto",
  preferredDepth: "standard",
  preferredFormat: "markdown",
  preferredProvider: "auto",
  timezone: null as string | null,
};

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  // Try Postgres.
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const prefs = await prisma.userPreference.findUnique({ where: { userId: "default" } });
        return NextResponse.json({ ok: true, preferences: prefs || DEFAULT_PREFS });
      }
    } catch (err) {
      // Non-critical: Postgres preference lookup failed. Fall through to
      // SQLite — if that also fails, the user gets DEFAULT_PREFS (safe).
      Sentry.captureException(err);
      logger.warn(
        { module: "preferences", err: err instanceof Error ? err.message : String(err) },
        "GET: Postgres preference lookup failed — falling back to SQLite"
      );
    }
  }

  // SQLite fallback.
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get("default") as UserPreferenceRow | undefined;
    if (row) {
      return NextResponse.json({
        ok: true,
        preferences: {
          preferredLanguage: row.preferred_language || "auto",
          preferredDepth: row.preferred_depth || "standard",
          preferredFormat: row.preferred_format || "markdown",
          preferredProvider: row.preferred_provider || "auto",
          timezone: row.timezone,
        },
      });
    }
  } catch (err) {
    // Non-critical: SQLite preference lookup failed (DB locked, table
    // missing). Default preferences are a safe fallback — the UI still
    // works, the user just doesn't see their saved prefs this turn.
    Sentry.captureException(err);
    logger.warn(
      { module: "preferences", err: err instanceof Error ? err.message : String(err) },
      "GET: SQLite preference lookup failed — returning defaults"
    );
  }

  return NextResponse.json({ ok: true, preferences: DEFAULT_PREFS });
}

export async function PUT(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    const body = await req.json();
    const prefs = {
      preferredLanguage: body.preferredLanguage || "auto",
      preferredDepth: body.preferredDepth || "standard",
      preferredFormat: body.preferredFormat || "markdown",
      preferredProvider: body.preferredProvider || "auto",
      timezone: body.timezone || null,
    };

    // Postgres.
    if (isPostgresAvailable()) {
      try {
        const prisma = await getPrismaDb();
        if (prisma) {
          await prisma.userPreference.upsert({
            where: { userId: "default" },
            create: { userId: "default", ...prefs },
            update: prefs,
          });
          return NextResponse.json({ ok: true, preferences: prefs });
        }
      } catch (err) {
        // Non-critical: Postgres preference upsert failed. Fall through to
        // SQLite — if that also fails, the caller below logs and returns.
        Sentry.captureException(err);
        logger.warn(
          { module: "preferences", err: err instanceof Error ? err.message : String(err) },
          "PUT: Postgres preference upsert failed — falling back to SQLite"
        );
      }
    }

    // SQLite fallback.
    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO user_preferences (user_id, preferred_language, preferred_depth, preferred_format, preferred_provider, timezone)
         VALUES ('default', ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           preferred_language = excluded.preferred_language,
           preferred_depth = excluded.preferred_depth,
           preferred_format = excluded.preferred_format,
           preferred_provider = excluded.preferred_provider,
           timezone = excluded.timezone`
      ).run(prefs.preferredLanguage, prefs.preferredDepth, prefs.preferredFormat, prefs.preferredProvider, prefs.timezone);
      return NextResponse.json({ ok: true, preferences: prefs });
    } catch (err) {
      logger.error(
        { module: "preferences", err: err instanceof Error ? err.message : String(err) },
        "SQLite update failed"
      );
    }

    return NextResponse.json({ ok: true, preferences: prefs });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}
