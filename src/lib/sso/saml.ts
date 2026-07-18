// SAML 2.0 SSO stub — interface + configuration structure only.
//
// Full implementation requires @node-saml/passport-saml (or equivalent)
// plus enterprise license + SAML IdP metadata exchange. This module
// exposes the configuration shape + a status helper so:
//   1. The /api/auth/sso/status route can report whether SAML is wired.
//   2. The /api/auth/sso/saml/login route can short-circuit with a
//      "not configured" message instead of crashing.
//   3. When the enterprise tier is activated, an engineer can drop in
//      the real passport-saml strategy without touching call sites.
//
// Configuration is read from env vars (see .env.example):
//   SAML_ENTRY_POINT  — IdP Single Sign-On URL (where we redirect to)
//   SAML_ISSUER       — Our entity ID (defaults to "quaesitor")
//   SAML_CALLBACK_URL — Our ACS URL (defaults to /api/auth/sso/saml/callback)
//   SAML_CERT         — IdP signing certificate (PEM, used to verify
//                       the SAML response signature)

export interface SAMLConfig {
  entryPoint: string; // IdP SSO URL
  issuer: string; // Entity ID
  callbackUrl: string; // Our ACS URL
  cert: string; // IdP signing cert
}

/** Returns true if both required SAML env vars (entry point + cert) are set. */
export function isSAMLConfigured(): boolean {
  return !!(process.env.SAML_ENTRY_POINT && process.env.SAML_CERT);
}

/**
 * Returns the resolved SAML configuration, or null if SAML is not
 * configured. Callers MUST check `isSAMLConfigured()` (or null-check
 * the return value) before attempting to use the config — the values
 * are not guaranteed to be valid URLs/certs otherwise.
 */
export function getSAMLConfig(): SAMLConfig | null {
  if (!isSAMLConfigured()) return null;
  return {
    entryPoint: process.env.SAML_ENTRY_POINT!,
    issuer: process.env.SAML_ISSUER || "quaesitor",
    callbackUrl: process.env.SAML_CALLBACK_URL || "/api/auth/sso/saml/callback",
    cert: process.env.SAML_CERT!,
  };
}
