// safeFetch — SSRF protection wrapper around fetch().
//
// Rejects requests to private/loopback/link-local/metadata IP ranges
// to prevent Server-Side Request Forgery attacks:
//   - 127.0.0.0/8 (loopback)
//   - 10.0.0.0/8 (private)
//   - 172.16.0.0/12 (private)
//   - 192.168.0.0/16 (private)
//   - 169.254.0.0/16 (link-local, includes AWS metadata 169.254.169.254)
//   - 100.64.0.0/10 (CGNAT — RFC 6598, used by some carriers/clouds)
//   - 0.0.0.0/8 ("this host")
//   - ::1 (IPv6 loopback)
//   - fc00::/7 (IPv6 private / unique-local — covers both fc00: and fd00:)
//   - fe80::/10 (IPv6 link-local)
//   - ::ffff:a.b.c.d (IPv4-mapped IPv6 — must be checked after stripping
//     the ::ffff: prefix so the embedded IPv4 is inspected)
//   - 64:ff9b::/96 (NAT64 IPv6 → IPv4 translation prefix, RFC 6052)
//
// Also blocks requests to common metadata service endpoints:
//   - 169.254.169.254 (AWS/GCP/Azure metadata)
//   - metadata.google.internal (GCP metadata)
//
// Redirect handling: ALL redirect hops are followed MANUALLY (not just
// the first one), and each Location target is re-resolved and re-checked
// before being fetched. This prevents an attacker from redirecting to a
// private IP after the initial check passes.
//
// KNOWN LIMITATION (DNS rebinding / TOCTOU): there is an inherent race
// between `dns.lookup()` (which we call to validate the IP) and the
// actual `fetch()` (which performs its own DNS resolution). A malicious
// DNS server can return a public IP for our check, then a private IP
// for the fetch. Fully closing this requires low-level socket access
// (e.g. `http.Agent` + `lookup` hook that pins the resolved IP, or a
// custom `connect` listener that rejects private IPs on the underlying
// socket). That is out of scope for this wrapper; consumers that need
// airtight SSRF protection should use a dedicated egress proxy.
//
// Usage:
//   import { safeFetch } from "@/lib/safe-fetch";
//   const res = await safeFetch(url, { method: "GET" });

import { lookup } from "dns/promises";
import { isIP } from "net";

const BLOCKED_HOSTNAMES = [
  "169.254.169.254",
  "metadata.google.internal",
  "metadata",
  "0.0.0.0",
  "localhost",
];

const PRIVATE_IP_PATTERNS = [
  /^127\./, // loopback
  /^10\./, // private
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // private
  /^192\.168\./, // private
  /^169\.254\./, // link-local (AWS metadata)
  // H-1: CGNAT 100.64.0.0/10 (RFC 6598) — carrier-grade NAT used by
  // some clouds (e.g. Tailscale, DigitalOcean internal). Reachable from
  // inside the network but not routable on the public Internet.
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1$/, // IPv6 loopback
  /^fc/, // IPv6 private (fc00::/7)
  /^fe80/, // IPv6 link-local
  /^fd/, // IPv6 private (fd00::/8 — subset of fc00::/7, kept explicit)
  /^0\./, // 0.0.0.0/8 "this host"
  // H-1: IPv4-mapped IPv6 addresses (::ffff:a.b.c.d). These are
  // syntactically IPv6 but resolve to IPv4 — a common SSRF bypass.
  // The check strips the ::ffff: prefix and re-tests the embedded IPv4.
  // The pattern itself matches so `isPrivateIP` short-circuits; the
  // embedded-IP extraction happens in `isPrivateIP`.
  /^::ffff:/i,
  // H-1: NAT64 IPv6 → IPv4 translation prefix (64:ff9b::/96, RFC 6052).
  // A request to `http://[64:ff9b::7f00:1]/` reaches 127.0.0.1 on a
  // NAT64 gateway — must be blocked.
  /^64:ff9b::/i,
];

function isPrivateIP(ip: string): boolean {
  if (!ip) return false;

  // H-1: IPv4-mapped IPv6 (::ffff:a.b.c.d) — strip the prefix and
  // inspect the embedded IPv4. Without this, an attacker could reach
  // private IPv4s via their IPv4-mapped IPv6 representation.
  const v4MappedMatch = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (v4MappedMatch) {
    const embedded = v4MappedMatch[1]!;
    return PRIVATE_IP_PATTERNS.some((p) => p.test(embedded));
  }

  // H-1: NAT64 64:ff9b::/96 — the trailing 32 bits encode an IPv4.
  // Format: 64:ff9b::a.b.c.d (or 64:ff9b::xxxx where xxxx = hex IPv4).
  // Only the dotted-quad form is checked here; the hex form is rarer
  // and would also match the prefix-only check below for defense in
  // depth (we block the entire prefix).
  const nat64Match = ip.match(/^64:ff9b::(?:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}))?$/i);
  if (nat64Match) {
    if (nat64Match[1]) {
      const embedded = `${nat64Match[1]}.${nat64Match[2]}.${nat64Match[3]}.${nat64Match[4]}`;
      return PRIVATE_IP_PATTERNS.some((p) => p.test(embedded));
    }
    // 64:ff9b:: with no embedded IPv4 (raw prefix) — block by default.
    return true;
  }

  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

async function resolveAndCheck(hostname: string): Promise<void> {
  // Check if hostname itself is a blocked literal
  if (BLOCKED_HOSTNAMES.includes(hostname.toLowerCase())) {
    throw new Error(`SSRF blocked: hostname "${hostname}" is a known metadata service`);
  }

  // If hostname is already an IP, check it directly
  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new Error(`SSRF blocked: IP "${hostname}" is in a private/loopback range`);
    }
    return;
  }

  // Resolve hostname to IP and check the IP.
  // Skip DNS resolution in test environments (vitest) where fetch is mocked —
  // the mock won't have real DNS, and we don't want to block test execution.
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    return;
  }

  try {
    const addresses = await lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIP(addr.address)) {
        throw new Error(
          `SSRF blocked: hostname "${hostname}" resolves to private IP "${addr.address}"`
        );
      }
    }
  } catch (err) {
    // If DNS resolution fails, let the original fetch handle the error
    // (we don't block — the fetch will fail naturally)
    if (err instanceof Error && err.message.startsWith("SSRF blocked:")) {
      throw err;
    }
  }
}

// Maximum number of redirect hops to follow manually. Matches fetch's
// default cap of 20; once exceeded we return the redirect response
// verbatim (the caller can decide what to do with it).
const MAX_REDIRECT_HOPS = 20;

export async function safeFetch(
  url: string | URL,
  init?: RequestInit
): Promise<Response> {
  let currentUrl = typeof url === "string" ? new URL(url) : url;

  // Only allow http and https
  if (currentUrl.protocol !== "http:" && currentUrl.protocol !== "https:") {
    throw new Error(`SSRF blocked: protocol "${currentUrl.protocol}" not allowed`);
  }

  // H-1: Check the initial hostname before any fetch.
  await resolveAndCheck(currentUrl.hostname);

  // H-1: Follow ALL redirects manually — re-check EVERY hop. The
  // previous implementation only inspected the first redirect's
  // Location header before issuing `redirect: "follow"`, which meant a
  // 2nd-or-later hop pointing at a private IP would slip through.
  let hopCount = 0;
  let response = await fetch(currentUrl, {
    ...init,
    redirect: "manual",
  });

  while ([301, 302, 303, 307, 308].includes(response.status)) {
    hopCount++;
    if (hopCount > MAX_REDIRECT_HOPS) {
      // Too many redirects — return the last response so the caller
      // can see the redirect chain rather than throwing.
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      // Malformed redirect (no Location header) — return as-is.
      return response;
    }

    const nextUrl = new URL(location, currentUrl);

    // Protocol re-check (a redirect can change http↔https, but never to
    // a non-http protocol like file://).
    if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
      throw new Error(
        `SSRF blocked: redirect to protocol "${nextUrl.protocol}" not allowed`
      );
    }

    // H-1: Re-resolve and re-check EVERY redirect target.
    await resolveAndCheck(nextUrl.hostname);

    // Fetch the next hop with manual redirect so we can intercept again.
    response = await fetch(nextUrl, {
      ...init,
      redirect: "manual",
    });
    currentUrl = nextUrl;
  }

  return response;
}
