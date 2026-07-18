// Computer Use — STUB for future desktop-automation capability.
//
// Anthropic's "Computer Use" (the ability for the model to drive a
// desktop: take screenshots, click, type, scroll, send keystrokes) is
// a key competitive differentiator. Quaesitor does NOT ship this today
// because it requires a real display server (X11/Wayland) and a
// Playwright browser bound to that display — neither of which is
// available in the default container deployment.
//
// This module ships the *interface* now so:
//   1. The capability can be surfaced in the UI ("Computer Use: not
//      available in this deployment") rather than silently absent.
//   2. When a future operator sets COMPUTER_USE_ENABLED=true and
//      configures a display, the implementation can land here without
//      touching call sites.
//
// Security note: real Computer Use is dangerous — a model with click +
// type access can do anything the desktop user can. The future
// implementation MUST:
//   - Run in a disposable VM or container with no host filesystem access.
//   - Sandbox network egress (block LAN, allow only explicit allowlist).
//   - Cap session length and require explicit user approval per action
//     when running interactively.
//   - Audit-log every action (already covered by `logSensitiveAction`).

export type ComputerUseActionType =
  | "screenshot"
  | "click"
  | "type"
  | "scroll"
  | "key";

export interface ComputerUseAction {
  type: ComputerUseActionType;
  /** Required for click/scroll; ignored for screenshot/type/key. */
  coordinates?: { x: number; y: number };
  /** Required for type; the text to enter. */
  text?: string;
  /** Required for key; a single key or combo (e.g. "Return", "ctrl+c"). */
  key?: string;
}

export interface ComputerUseResult {
  success: boolean;
  /** Base64-encoded PNG screenshot of the screen *after* the action. */
  screenshot?: string;
  /** Human-readable error when success is false. */
  error?: string;
}

/**
 * Execute a single Computer Use action. STUB.
 *
 * Returns `{ success: false, error: "..." }` until COMPUTER_USE_ENABLED
 * is set and a Playwright + display pipeline is wired up.
 */
export async function executeComputerUse(
  _action: ComputerUseAction
): Promise<ComputerUseResult> {
  // STUB: Computer Use requires a desktop environment (Playwright + display).
  // This is a placeholder for future implementation.
  // When COMPUTER_USE_ENABLED=true and a display is available, this will
  // execute the action via Playwright and return a screenshot.
  void _action;
  return {
    success: false,
    error:
      "Computer Use is not available in this deployment. Set COMPUTER_USE_ENABLED=true and configure a display server.",
  };
}

/**
 * Returns true only when an operator has explicitly enabled Computer Use.
 * Even when true, `executeComputerUse` will still return an error until
 * the Playwright/display pipeline lands — this flag just gates whether
 * the UI advertises the feature.
 */
export function isComputerUseAvailable(): boolean {
  return process.env.COMPUTER_USE_ENABLED === "true";
}

/**
 * Human-readable status string for UI display.
 * - "enabled"     — flag set, but the Playwright pipeline is still a stub.
 * - "disabled"    — flag unset (default).
 */
export function computerUseStatus(): "enabled" | "disabled" {
  return isComputerUseAvailable() ? "enabled" : "disabled";
}
