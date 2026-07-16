// POST /api/auth/register — create a new user account.
// Body: { email, password, name? }
// Returns: { ok: true } or { ok: false, error: string }

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { createRequestLogger, generateRequestId } from "@/lib/logger";

const RegisterSchema = z.object({
  email: z.string().email("Invalid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  name: z.string().max(100).optional(),
});

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

    const { email, password, name } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);

    // Postgres.
    if (isPostgresAvailable()) {
      try {
        const prisma = await getPrismaDb();
        if (prisma) {
          const existing = await prisma.user.findUnique({ where: { email } });
          if (existing) {
            return NextResponse.json({ ok: false, error: "Email already registered." }, { status: 409 });
          }
          await prisma.user.create({
            data: { email, passwordHash, name: name || null },
          });
          return NextResponse.json({ ok: true });
        }
      } catch (err) {
        log.warn({ err: err instanceof Error ? err.message : String(err) }, "Postgres failed");
      }
    }

    // SQLite fallback.
    try {
      const db = getDb();
      // Ensure users table exists.
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

      const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
      if (existing) {
        return NextResponse.json({ ok: false, error: "Email already registered." }, { status: 409 });
      }

      const id = crypto.randomUUID();
      db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)").run(
        id, email, name || null, passwordHash
      );
      return NextResponse.json({ ok: true });
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, "SQLite failed");
      return NextResponse.json({ ok: false, error: "Registration failed." }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}
