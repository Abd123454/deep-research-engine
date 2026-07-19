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

// C-1 (CVSS 9.8): Fail-closed in production if NEXTAUTH_SECRET is missing.
// A missing secret means NextAuth falls back to a known constant, which
// allows anyone to mint JWTs with arbitrary `userId` claims (e.g. "admin").
// We throw at MODULE LOAD TIME so the app crashes on startup rather than
// silently serving forged sessions.
//
// In dev (NODE_ENV !== "production") we keep a hardcoded fallback so a
// fresh checkout runs without forcing the developer to generate a secret.
const __NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!__NEXTAUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "NEXTAUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32"
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
  Sentry.captureException(err);
/* fall through */ 
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
  Sentry.captureException(err);
/* ignore */ 
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
