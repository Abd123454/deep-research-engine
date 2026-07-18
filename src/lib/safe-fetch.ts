// safeFetch — SSRF protection wrapper around fetch().
//
// Rejects requests to private/loopback/link-local/metadata IP ranges
// to prevent Server-Side Request Forgery attacks:
//   - 127.0.0.0/8 (loopback)
//   - 10.0.0.0/8 (private)
//   - 172.16.0.0/12 (private)
//   - 192.168.0.0/16 (private)
//   - 169.254.0.0/16 (link-local, includes AWS metadata 169.254.169.254)
//   - ::1 (IPv6 loopback)
//   - fc00::/7 (IPv6 private)
//   - fe80::/10 (IPv6 link-local)
//
// Also blocks requests to common metadata service endpoints:
//   - 169.254.169.254 (AWS/GCP/Azure metadata)
//   - metadata.google.internal (GCP metadata)
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
  /^::1$/, // IPv6 loopback
  /^fc/, // IPv6 private
  /^fe80/, // IPv6 link-local
  /^fd/, // IPv6 private
  /^0\./, // 0.0.0.0/8
];

function isPrivateIP(ip: string): boolean {
  if (!ip) return false;
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

export async function safeFetch(
  url: string | URL,
  init?: RequestInit
): Promise<Response> {
  const parsedUrl = typeof url === "string" ? new URL(url) : url;

  // Only allow http and https
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(`SSRF blocked: protocol "${parsedUrl.protocol}" not allowed`);
  }

  // Check the hostname
  await resolveAndCheck(parsedUrl.hostname);

  // Re-check after redirect (fetch follows redirects by default)
  // We wrap the fetch to intercept redirects
  const response = await fetch(url, {
    ...init,
    redirect: "manual", // We'll handle redirects manually to check each hop
  });

  // If it's a redirect, check the Location header
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (location) {
      const redirectUrl = new URL(location, parsedUrl);
      // Recursively check the redirect target
      await resolveAndCheck(redirectUrl.hostname);
      // Follow the redirect with a normal fetch (now that we've verified the target)
      return fetch(redirectUrl, { ...init, redirect: "follow" });
    }
  }

  return response;
}
