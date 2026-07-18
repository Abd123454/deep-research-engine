// Computer Use — browser automation via Playwright in Docker.
//
// SECURITY: when real wiring lands, this MUST run in an isolated Docker
// container with `--network=none` (no host network access) and a tight
// allowlist of URLs the browser may navigate to. The container image is
// pinned to a specific Playwright version (see `COMPUTER_USE_CONFIG`)
// and started with `--no-new-privileges` + `--cap-drop=ALL` so a
// compromise of the browser process can't escalate to the host.
//
// What's real today:
//   - The `ComputerUseAction` / `ComputerUseResult` interfaces.
//   - `isComputerUseAvailable()` — true when `COMPUTER_USE_ENABLED=true`.
//   - `isUrlAllowed(url)` — allowlist check against
//     `COMPUTER_USE_ALLOWLIST` (comma-separated domain suffixes).
//   - `executeComputerUse(action)` — audit-logs the action, then returns
//     a "requires Playwright + Docker" error. The function never throws.
//   - `COMPUTER_USE_CONFIG` — the pinned container image, security
//     options, and per-session limits.
//
// What's NOT real yet:
//   - Actually launching Playwright in Docker.
//   - Executing the action (screenshot/click/type/scroll/key/navigate).
//   - Returning a real base64 PNG screenshot.
//
// When real wiring lands:
//   1. `executeComputerUse` spawns a Docker container with the config
//      below (image + security opts).
//   2. The container runs a small Playwright harness (e.g. `npx
//      playwright-core` with a `--remote-debugging-port` exposed back
//      to the host).
//   3. The host sends the action via the harness's HTTP API and
//      receives a base64 PNG screenshot in response.
//   4. The container is torn down after `maxActions` actions or
//      `timeoutMs` elapsed (whichever comes first).
//   5. Every action is audit-logged with the `computer_use.action` slug
//      (already wired below).
//
// This module is the enterprise-tier interface — the UI can call it
// unconditionally; when `isComputerUseAvailable()` is false it returns
// a clean "feature not available" error rather than throwing.

import { logSensitiveAction } from "./audit";
import type { NextRequest } from "next/server";

/**
 * The set of actions the model can ask the browser to perform. The
 * `navigate` action (added in P1 wave 3) lets the model open a URL in
 * the sandboxed browser — gated by `isUrlAllowed` for defense-in-depth.
 */
export type ComputerUseActionType =
  | "screenshot"
  | "click"
  | "type"
  | "scroll"
  | "key"
  | "navigate";

export interface ComputerUseAction {
  type: ComputerUseActionType;
  /** Required for click/scroll; ignored for screenshot/type/key/navigate. */
  coordinates?: { x: number; y: number };
  /** Required for type; the text to enter. */
  text?: string;
  /** Required for key; a single key or combo (e.g. "Return", "ctrl+c"). */
  key?: string;
  /** Required for navigate; the URL to open. Must pass `isUrlAllowed`. */
  url?: string;
}

export interface ComputerUseResult {
  success: boolean;
  /** Base64-encoded PNG screenshot of the screen *after* the action. */
  screenshot?: string;
  /** Human-readable error when success is false. */
  error?: string;
  /** Number of actions executed in the current session (for limit tracking). */
  actionCount: number;
}

/**
 * Execute a single Computer Use action. STUB — audit-logs the action
 * (always), then returns a "requires Playwright + Docker" error until
 * the real wiring lands. NEVER throws — callers can `await` this
 * without a try/catch.
 *
 * The `req` parameter is optional — when supplied, the audit log entry
 * includes the request's IP + user-agent (for forensic reconstruction
 * of an interactive Computer Use session). When omitted (e.g. called
 * from a worker), the audit log records the action without a request
 * context.
 */
export async function executeComputerUse(
  action: ComputerUseAction,
  req?: NextRequest | null,
  userId: string = "system"
): Promise<ComputerUseResult> {
  if (!isComputerUseAvailable()) {
    return {
      success: false,
      error:
        "Computer Use is not available. Set COMPUTER_USE_ENABLED=true and install Docker.",
      actionCount: 0,
    };
  }

  // URL allowlist check (defense-in-depth — even when the Docker
  // container has `--network=none`, an allowlist violation here is
  // cheaper to detect than after the browser has loaded the page).
  if (action.type === "navigate" && action.url && !isUrlAllowed(action.url)) {
    return {
      success: false,
      error: `URL not allowed by COMPUTER_USE_ALLOWLIST: ${action.url}`,
      actionCount: 0,
    };
  }

  // Audit log every action — the `computer_use.action` slug records
  // the action type + (for click/scroll) the target coordinates. The
  // base64 screenshot is NOT logged (size + privacy). Failures are
  // swallowed (the audit log is best-effort, never blocks the action).
  try {
    logSensitiveAction("computer_use.action", userId, req, {
      type: action.type,
      ...(action.coordinates ? { x: action.coordinates.x, y: action.coordinates.y } : {}),
      ...(action.url ? { url: action.url } : {}),
      // For type/key actions, log the LENGTH (not the content) so an
      // operator reviewing the audit trail can see "the model typed
      // 47 chars" without exposing what was typed (could be a password).
      ...(action.text ? { textLength: action.text.length } : {}),
      ...(action.key ? { key: action.key } : {}),
    });
  } catch {
    // Audit log failed — never block the action.
  }

  // Real implementation would:
  // 1. Launch Playwright in the Docker container described by
  //    `COMPUTER_USE_CONFIG` (or reuse the existing session container
  //    if one is warm for this user).
  // 2. Execute the action:
  //    - screenshot: page.screenshot({ encoding: "base64" })
  //    - click:       page.mouse.click(x, y)
  //    - type:        page.keyboard.type(text)
  //    - scroll:      page.mouse.wheel(dx, dy)
  //    - key:         page.keyboard.press(key)
  //    - navigate:    page.goto(url, { waitUntil: "domcontentloaded" })
  // 3. Take a post-action screenshot (base64 PNG).
  // 4. Increment the session's action counter; tear down the container
  //    when it hits `maxActions`.
  // 5. Return `{ success, screenshot, actionCount }`.
  //
  // For now, this is the enterprise-tier interface — the function
  // returns a "requires setup" error so callers can surface a clean
  // message rather than a generic 500.

  return {
    success: false,
    error:
      "Computer Use requires Playwright + Docker setup. This is the enterprise tier interface.",
    actionCount: 1,
  };
}

/**
 * Returns true only when an operator has explicitly enabled Computer Use
 * via the `COMPUTER_USE_ENABLED=true` env var. Even when true,
 * `executeComputerUse` will still return an error until the Playwright
 * + Docker pipeline lands — this flag just gates whether the UI
 * advertises the feature.
 */
export function isComputerUseAvailable(): boolean {
  return process.env.COMPUTER_USE_ENABLED === "true";
}

/**
 * Allowlist check for URLs the browser may navigate to. Reads
 * `COMPUTER_USE_ALLOWLIST` (comma-separated domain suffixes — e.g.
 * "wikipedia.org,arxiv.org,github.com"). When unset, ALL URLs are
 * allowed (dev mode — operators who don't set the allowlist accept the
 * risk). When set, the URL's hostname must end with one of the listed
 * domains (so "en.wikipedia.org" matches "wikipedia.org").
 *
 * Malformed URLs always return false (fail-closed).
 */
export function isUrlAllowed(url: string): boolean {
  const allowlist = process.env.COMPUTER_USE_ALLOWLIST;
  if (!allowlist) return true; // no allowlist = allow all (dev mode)
  const domains = allowlist
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (domains.length === 0) return true; // empty allowlist = allow all
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/**
 * Human-readable status string for UI display.
 * - "enabled"  — flag set, but the Playwright pipeline is still a stub.
 * - "disabled" — flag unset (default).
 */
export function computerUseStatus(): "enabled" | "disabled" {
  return isComputerUseAvailable() ? "enabled" : "disabled";
}

/**
 * Pinned configuration for the Docker container that runs Playwright
 * when the real wiring lands. Exposed as a `const` object so the
 * dashboard can render the current config (image version, security
 * profile) to operators.
 *
 * - `maxActions`:   hard cap on actions per session (defense against a
 *                   runaway agent that keeps clicking forever).
 * - `timeoutMs`:    hard cap on session wall-clock time.
 * - `containerImage`: pinned Playwright Docker image. Bumping this
 *                   requires updating the enterprise-tier deployment
 *                   docs (the image is pulled at session start).
 * - `securityOpts`: Docker security profile. `--network=none` blocks
 *                   all network egress from the container (the browser
 *                   can't phone home). `--cap-drop=ALL` strips all
 *                   Linux capabilities. `--no-new-privileges` prevents
 *                   setuid escalation.
 */
export const COMPUTER_USE_CONFIG = {
  maxActions: 20,
  timeoutMs: 60_000,
  containerImage: "mcr.microsoft.com/playwright:v1.40.0-jammy",
  securityOpts: ["--no-new-privileges", "--cap-drop=ALL", "--network=none"],
} as const;
