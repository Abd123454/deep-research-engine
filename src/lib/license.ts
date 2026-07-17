// License detection utility.
//
// Quaesitor is dual-licensed:
// - AGPL-3.0 for open-source / self-hosted use
// - Commercial license for enterprise / proprietary use
//
// This module helps API routes display the correct license notice and
// enforce commercial-only features (if any) based on the LICENSE_MODE
// env var. It is intentionally side-effect-free: nothing is logged, no
// network calls are made, no global state is mutated. Every function
// reads `process.env.LICENSE_MODE` at call time so a hot reload of the
// environment (or a server-side override) is respected.
//
// Default mode is "agpl" — when in doubt, the more restrictive license
// applies. Operators who have purchased a commercial license must
// explicitly set `LICENSE_MODE=commercial` in their environment. See
// COMMERCIAL_LICENSE.md for terms and contact@quaesitor.local (placeholder)
// for pricing.

export type LicenseMode = "agpl" | "commercial";

/**
 * Resolve the active license mode from the environment.
 *
 * - `LICENSE_MODE=commercial` → "commercial"
 * - anything else (including unset) → "agpl"
 */
export function getLicenseMode(): LicenseMode {
  const mode = process.env.LICENSE_MODE;
  if (mode === "commercial") return "commercial";
  return "agpl"; // default
}

/**
 * True when the deployment is running under the Quaesitor Commercial
 * License. Use this to gate enterprise-only features (if any) or to
 * suppress the AGPL source-disclosure obligation in API responses.
 */
export function isCommercial(): boolean {
  return getLicenseMode() === "commercial";
}

/**
 * Short, human-readable license notice. Suitable for inclusion in API
 * responses (e.g. `X-License` header) or in the footer of generated
 * reports.
 */
export function getLicenseNotice(): string {
  if (isCommercial()) {
    return "Licensed under Quaesitor Commercial License. All rights reserved.";
  }
  return "Licensed under AGPL-3.0. Source code must be made available to users. See LICENSE for details.";
}

/**
 * Compact footer string. Suitable for UI chrome where horizontal space
 * is limited (e.g. status bar, page footer).
 */
export function getLicenseFooter(): string {
  if (isCommercial()) {
    return "© Quaesitor Commercial License";
  }
  return "AGPL-3.0 · Self-hosted";
}

/**
 * The SPDX identifier of the active license. Useful for machine-readable
 * metadata (e.g. `package.json`-style fields, OpenAPI `info.license`).
 */
export function getLicenseSpdxId(): string {
  return isCommercial() ? "Quaesitor-Commercial-1.0" : "AGPL-3.0-only";
}
