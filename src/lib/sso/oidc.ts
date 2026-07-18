// OIDC SSO stub — interface + configuration structure only.
//
// Full implementation requires `openid-client` (or equivalent) plus a
// registered OIDC provider (Google Workspace, Okta, Auth0, Keycloak,
// etc.). This module exposes the configuration shape + a status helper
// so:
//   1. The /api/auth/sso/status route can report whether OIDC is wired.
//   2. The /api/auth/sso/oidc/login route can short-circuit with a
//      "not configured" message instead of crashing.
//   3. When SSO is activated, an engineer can drop in the real
//      openid-client strategy without touching call sites.
//
// Configuration is read from env vars (see .env.example):
//   OIDC_ISSUER       — OIDC issuer URL (e.g. https://accounts.google.com)
//   OIDC_CLIENT_ID    — Client ID registered with the provider
//   OIDC_CLIENT_SECRET — Client secret
//   OIDC_REDIRECT_URI — Our callback URL (defaults to
//                       /api/auth/sso/oidc/callback)
//   OIDC_SCOPE        — Space-delimited scopes (defaults to
//                       "openid profile email")

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

/** Returns true if both required OIDC env vars (issuer + client ID) are set. */
export function isOIDCConfigured(): boolean {
  return !!(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID);
}

/**
 * Returns the resolved OIDC configuration, or null if OIDC is not
 * configured. Callers MUST check `isOIDCConfigured()` (or null-check
 * the return value) before attempting to use the config.
 */
export function getOIDCConfig(): OIDCConfig | null {
  if (!isOIDCConfigured()) return null;
  return {
    issuer: process.env.OIDC_ISSUER!,
    clientId: process.env.OIDC_CLIENT_ID!,
    clientSecret: process.env.OIDC_CLIENT_SECRET || "",
    redirectUri: process.env.OIDC_REDIRECT_URI || "/api/auth/sso/oidc/callback",
    scope: process.env.OIDC_SCOPE || "openid profile email",
  };
}
