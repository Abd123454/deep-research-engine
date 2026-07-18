// GET /api/auth/sso/saml/login — initiate SAML SSO.
//
// Stub: when SAML is not configured (the default), returns a 501 with
// a structured "not configured" body so the frontend can render an
// appropriate message. When SAML IS configured (SAML_ENTRY_POINT +
// SAML_CERT set), this route would normally:
//   1. Build a SAML AuthnRequest.
//   2. Sign + deflate it.
//   3. Redirect (302) to the IdP's entryPoint with the request as a
//      query param.
// The redirect logic is intentionally NOT implemented here — it
// requires @node-saml/passport-saml, which is an enterprise-tier
// dependency. The stub keeps the route shape stable so wiring the real
// strategy later is a drop-in change.

import { NextResponse } from "next/server";
import { isSAMLConfigured, getSAMLConfig } from "@/lib/sso/saml";

export async function GET() {
  if (!isSAMLConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        provider: "saml",
        error:
          "SAML SSO is not configured. Set SAML_ENTRY_POINT and SAML_CERT environment variables to enable.",
      },
      { status: 501 }
    );
  }

  const config = getSAMLConfig()!;
  // Stub: in the full implementation this would be a 302 redirect to
  // `${config.entryPoint}?SAMLRequest=...`. Returning the config
  // destination as JSON so the frontend can show where the user
  // *would* be redirected (useful for the enterprise onboarding
  // wizard).
  return NextResponse.json(
    {
      ok: true,
      configured: true,
      provider: "saml",
      entryPoint: config.entryPoint,
      issuer: config.issuer,
      callbackUrl: config.callbackUrl,
      message:
        "SAML is configured but the redirect requires @node-saml/passport-saml (enterprise tier).",
    },
    { status: 200 }
  );
}
