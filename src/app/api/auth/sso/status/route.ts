// GET /api/auth/sso/status — report which SSO providers are configured.
//
// Public endpoint (no auth required) — the login page calls this to
// decide whether to render SSO buttons. The response only contains a
// boolean per provider (configured / not configured); it does NOT leak
// the actual config values (entryPoint URL, client ID, etc.) to
// unauthenticated callers.
//
// Response shape:
//   {
//     ok: true,
//     providers: {
//       saml: { configured: boolean, issuer?: string },
//       oidc: { configured: boolean, issuer?: string }
//     }
//   }
//
// When a provider is configured, the `issuer` field is included so the
// login page can render a human-friendly label (e.g. "Continue with
// Okta" vs. "Continue with SAML"). The issuer is NOT sensitive — it's
// the public entity ID / OIDC issuer URL.

import { NextResponse } from "next/server";
import { isSAMLConfigured, getSAMLConfig } from "@/lib/sso/saml";
import { isOIDCConfigured, getOIDCConfig } from "@/lib/sso/oidc";

export async function GET() {
  const samlConfigured = isSAMLConfigured();
  const oidcConfigured = isOIDCConfigured();

  // Only expose the issuer (public identifier) — never the cert,
  // client secret, or entryPoint URL.
  const saml = samlConfigured ? getSAMLConfig() : null;
  const oidc = oidcConfigured ? getOIDCConfig() : null;

  return NextResponse.json({
    ok: true,
    providers: {
      saml: {
        configured: samlConfigured,
        ...(samlConfigured && saml ? { issuer: saml.issuer } : {}),
      },
      oidc: {
        configured: oidcConfigured,
        ...(oidcConfigured && oidc ? { issuer: oidc.issuer } : {}),
      },
    },
  });
}
