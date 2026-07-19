# Migration Notes

## next-auth v4 → Auth.js v5 (PLANNED)

The project currently uses next-auth v4 with Next.js 16. While the integration works, next-auth v4 was designed for Next.js 12-14. Auth.js v5 (next-auth v5) is the recommended upgrade path:

- Better Next.js App Router support
- Native CSRF token handling
- Cookie-based sessions (no JWT)
- Edge runtime compatibility

**Migration effort:** 2-3 days
**Risk:** Medium (session handling, cookie paths may change)
**Priority:** P1 (before enterprise launch)

## bcryptjs → bcrypt (PLANNED)

bcryptjs is pure JS (3x slower than native bcrypt). Migration:
- Replace `import bcrypt from "bcryptjs"` with `import bcrypt from "bcrypt"`
- Add `bcrypt` as dependency, remove `bcryptjs`
- Rehash all existing passwords on next login (compare with both, rehash with native)

**Migration effort:** 1 day
**Priority:** P2 (performance improvement)
