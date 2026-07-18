// GET /api/auth/sso/oidc/login — initiate OIDC SSO.
//
// Stub: when OIDC is not configured (the default), returns a 501 with
// a structured "not configured" body so the frontend can render an
// appropriate message. When OIDC IS configured (OIDC_ISSUER +
// OIDC_CLIENT_ID set), this route would normally:
//   1. Discover the provider's authorization_endpoint via the
//      well-known /.well-known/openid-configuration document.
//   2. Build an authorization URL with state + PKCE challenge.
//   3. Redirect (302) the browser to that URL.
// The redirect logic is intentionally NOT implemented here — it
// requires `openid-client`, which is an enterprise-tier dependency.
// The stub keeps the route shape stable so wiring the real strategy
// later is a drop-in change.

import { NextResponse } from "next/server";
import { isOIDCConfigured, getOIDCConfig } from "@/lib/sso/oidc";

export async function GET() {
  if (!isOIDCConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        provider: "oidc",
        error:
          "OIDC SSO is not configured. Set OIDC_ISSUER and OIDC_CLIENT_ID environment variables to enable.",
      },
      { status: 501 }
    );
  }

  const config = getOIDCConfig()!;
  // Stub: in the full implementation this would be a 302 redirect to
  // `${config.issuer}/authorize?response_type=code&client_id=...&...`.
  // Returning the config destination as JSON so the frontend can show
  // where the user *would* be redirected (useful for the enterprise
  // onboarding wizard).
  return NextResponse.json(
    {
      ok: true,
      configured: true,
      provider: "oidc",
      issuer: config.issuer,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scope: config.scope,
      message:
        "OIDC is configured but the redirect requires openid-client (enterprise tier).",
    },
    { status: 200 }
  );
}
