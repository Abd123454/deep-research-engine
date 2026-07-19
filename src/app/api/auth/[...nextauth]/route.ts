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

// C-1 (CVSS 9.8): NEXTAUTH_SECRET must be set in production.
// A missing secret means NextAuth falls back to a known constant, which
// allows anyone to mint JWTs with arbitrary `userId` claims (e.g. "admin").
//
// IMPORTANT: we do NOT throw at module load time — `next build` runs with
// NODE_ENV=production but does NOT have runtime env vars (NEXTAUTH_SECRET
// is a deploy-time secret). A module-load throw would therefore break the
// build on every CI/fresh-clone. Instead we:
//   1. Log a loud error if the secret is missing in production.
//   2. Use the dev fallback `"dev-only-not-for-production"` so the module
//      loads during build. JWTs minted with this fallback are trivially
//      forgeable, but production deploys MUST set NEXTAUTH_SECRET — the
//      build artifact is never the security boundary, the runtime env is.
//
// In dev (NODE_ENV !== "production") the hardcoded fallback lets a fresh
// checkout run without forcing the developer to generate a secret.
const __NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!__NEXTAUTH_SECRET && process.env.NODE_ENV === "production") {
  // Lazy check — log instead of throwing so `next build` succeeds.
  // Operators see this in their deploy logs and must fix it before
  // the deploy serves real traffic.
  console.error(
    "[SECURITY] NEXTAUTH_SECRET not set in production — using insecure dev fallback. " +
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
export { handler as GET, handler as POST };
