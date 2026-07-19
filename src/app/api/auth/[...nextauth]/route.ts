// NextAuth configuration — credentials-based auth (email + password).
//
// Users are stored in Postgres (via Prisma) or SQLite (fallback).
// Passwords are hashed with bcrypt. JWT session strategy (no server-side
// session store needed — works in serverless).
//
// Until auth is fully wired, the app works in "guest mode" (no login
// required). When NEXTAUTH_SECRET is set + user registers, auth activates.
import * as Sentry from "@sentry/nextjs";


import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import type { UserRow } from "@/lib/sqlite-types";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { checkStartRateLimit, releaseConcurrency, getClientIP } from "@/lib/rate-limit";

// C-1 (CVSS 9.8): NEXTAUTH_SECRET must be set in production.
// A missing secret means NextAuth falls back to a known constant, which
// allows anyone to mint JWTs with arbitrary `userId` claims (e.g. "admin").
//
// IMPORTANT — three-mode behaviour:
//   1. `next build` — NEXT_PHASE is `phase-production-build` (main
//        compilation) or `phase-build-data-collection` (page-data
//        collection worker — same name as the audit's prescribed
//        constant, kept for forward-compat). The build runs with
//        NODE_ENV=production but has NO runtime env vars. A module-load
//        throw would break every CI / fresh-clone build. We use the
//        dev fallback silently so the build succeeds.
//      Also covers `phase-export` (next export).
//   2. Runtime production server (`next start`): NEXT_PHASE is
//      `phase-production-server`. THROW if NEXTAUTH_SECRET is missing —
//      the deploy environment MUST set it. Fail-closed is the security
//      boundary.
//   3. Dev (`next dev`): NEXT_PHASE is `phase-development-server`.
//      Use the dev fallback with a loud warning. Lets a fresh checkout
//      run without forcing the developer to generate a secret first.
//
// The build artifact is never the security boundary — the runtime env is.
// This three-mode check keeps the build green AND makes the runtime
// fail-closed if an operator forgets to set the secret.
const __NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const __NEXT_PHASE = process.env.NEXT_PHASE;
// All Next.js phases that indicate we're inside `next build` (or
// `next export`) — NOT a real production server. Module load here must
// not throw, because the build worker doesn't have deploy-time env vars.
//   - "phase-production-build"        — main compilation
//   - "phase-build-data-collection"   — page-data collection worker
//                                       (forward-compat name; not in
//                                       current Next.js constants but
//                                       prescribed by the v4 audit)
//   - "phase-export"                  — next export
const __IS_BUILD_PHASE =
  __NEXT_PHASE === "phase-production-build" ||
  __NEXT_PHASE === "phase-build-data-collection" ||
  __NEXT_PHASE === "phase-export";
// Runtime production: NODE_ENV=production AND NEXT_PHASE is the runtime
// server phase (or unset, for non-Next.js runtime environments).
const __IS_RUNTIME_PRODUCTION =
  process.env.NODE_ENV === "production" &&
  (__NEXT_PHASE === "phase-production-server" || __NEXT_PHASE === undefined) &&
  !__IS_BUILD_PHASE;

if (!__NEXTAUTH_SECRET && __IS_RUNTIME_PRODUCTION) {
  // Fail-closed: the runtime cannot mint JWTs without a real secret.
  // Operators see this error in the boot log and the process exits.
  throw new Error(
    "NEXTAUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32"
  );
}

if (!__NEXTAUTH_SECRET && !__IS_BUILD_PHASE && !__IS_RUNTIME_PRODUCTION) {
  // Dev mode — warn loudly so a developer who copies their .env into a
  // prod deploy still notices the fallback in the logs.
  console.error(
    "[SECURITY] NEXTAUTH_SECRET not set — using insecure dev fallback. " +
      "Generate one with: openssl rand -base64 32"
  );
}

async function findUserByEmail(email: string): Promise<{ id: string; email: string; name: string | null; passwordHash: string } | null> {
  // Postgres.
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user && user.email && user.passwordHash) {
          return { id: user.id, email: user.email, name: user.name, passwordHash: user.passwordHash };
        }
        return null;
      }
    } catch (err) {
      // Non-critical: Postgres user lookup failed (DB unreachable, schema
      // mismatch). Fall through to SQLite — if that also fails, return null
      // (NextAuth treats null as "invalid credentials").
      Sentry.captureException(err);
      logger.warn(
        { module: "nextauth", email, err: err instanceof Error ? err.message : String(err) },
        "findUserByEmail: Postgres lookup failed — falling back to SQLite"
      );
    }
  }

  // SQLite fallback.
  try {
    const db = getDb();
    const row = db.prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?").get(email) as Pick<UserRow, "id" | "email" | "name" | "password_hash"> | undefined;
    if (row && row.password_hash) {
      return { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash };
    }
  } catch (err) {
    // Non-critical: SQLite user lookup failed (DB locked, table missing).
    // Returning null causes NextAuth to treat the credentials as invalid
    // — safer than throwing (which would leak DB state to the client).
    Sentry.captureException(err);
    logger.warn(
      { module: "nextauth", email, err: err instanceof Error ? err.message : String(err) },
      "findUserByEmail: SQLite lookup failed — returning null (invalid-credentials)"
    );
  }
  return null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await findUserByEmail(credentials.email);
        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name || undefined };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  secret: __NEXTAUTH_SECRET || "dev-only-not-for-production",
};

const handler = NextAuth(authOptions);

// NH-1 (CVSS 6.5) v5 audit fix: wrap the NextAuth handler with a
// per-IP rate limit on POST requests (the credential sign-in verb).
// NextAuth internally routes GET (csrf token, session fetch, signout
// form) and POST (signin, signout, csrf verify). Only POST hits the
// credentials provider — that's the brute-force surface we want to
// throttle. GETs are passed through unmodified (they're cheap and
// happen on every page load).
//
// `checkStartRateLimit` enforces max 5/min + 3 concurrent + 50/day
// per IP. The concurrent slot is released in the finally block so
// short-lived auth requests don't pin the bucket.
const rateLimitedHandler = async (req: NextRequest) => {
  if (req.method === "POST") {
    const ip = getClientIP(req);
    const rl = await checkStartRateLimit(ip);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        {
          status: 429,
          headers: rl.retryAfterSec
            ? { "Retry-After": String(rl.retryAfterSec) }
            : {},
        }
      );
    }
    try {
      // NextAuth's handler accepts a NextRequest in App Router and
      // returns a NextResponse. The runtime signature is loose — we
      // cast through `unknown` because the @types package types it
      // for the Pages Router (NextApiRequest/NextApiResponse) and the
      // App Router signature is inferred at the route-module boundary.
      return (await (handler as unknown as (req: NextRequest) => Promise<NextResponse>)(req)) as NextResponse;
    } finally {
      releaseConcurrency(ip);
    }
  }
  return (handler as unknown as (req: NextRequest) => Promise<NextResponse>)(req);
};

export { rateLimitedHandler as GET, rateLimitedHandler as POST };
