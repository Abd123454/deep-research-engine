"use client";

// CookieConsent — minimal bottom-of-page banner.
//
// Quaesitor uses ONLY essential cookies (session, theme, language,
// last-project). No analytics, no advertising, no third-party tracking
// (see /legal/COOKIE_POLICY.md). Under the EU ePrivacy Directive,
// essential cookies do NOT require prior consent — so this banner is
// informational, not a consent gate.
//
// The banner appears on first visit (when localStorage has no
// `quaesitor:cookie-consent:v1` entry) and dismisses on click of
// "Got it". The dismissal is sticky: the banner will not reappear
// until the user clears localStorage or we bump the version suffix
// (e.g. if we ever introduce non-essential cookies that DO require
// opt-in consent).
//
// Design: warm Quaesitor palette — `bg-card` / `border` / `text-foreground`
// / `text-primary`. Subtle framer-motion slide-up on mount. No box-shadow
// (per DESIGN.md anti-patterns), no backdrop-blur.

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "quaesitor:cookie-consent:v1";

/**
 * Inline summary of the Cookie Policy. The full policy lives at
 * `/legal/COOKIE_POLICY.md` (in the source repo); this summary is
 * shown in an expandable section so the user doesn't have to leave
 * the page.
 */
const POLICY_SUMMARY = [
  "Quaesitor uses only essential cookies required for the Service to function.",
  "We do not use analytics, advertising, or third-party tracking cookies.",
  "Cookies set: session token, theme preference, language preference, last project.",
  "You can manage cookies in your browser settings at any time.",
  "Full policy: see /legal/COOKIE_POLICY.md in the source repository.",
];

export function CookieConsent() {
  const [visible, setVisible] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  // SSR-safety: the banner is hidden on the server (no localStorage)
  // and shown only after the client mounts and confirms no prior
  // dismissal. This avoids hydration mismatches.
  React.useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        setVisible(true);
      }
    } catch {
      // localStorage may be unavailable (private mode, sandboxed
      // iframe) — fail open (don't show the banner) so the user is
      // not blocked.
      setVisible(false);
    }
  }, []);

  const dismiss = React.useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    // eslint-disable-next-line no-empty
    } catch {
      // Same as above — best-effort persistence.
    }
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-label="Cookie notice"
          aria-live="polite"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6"
        >
          <div className="mx-auto max-w-3xl rounded-2xl border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#252220] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8e0d0] dark:bg-[#322e28] text-[#8b4513] dark:text-[#b5673a]">
                <Cookie className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-ui text-sm leading-relaxed text-[#2a2620] dark:text-[#e8e3d8]">
                  Quaesitor uses essential cookies only (session, theme,
                  language). No tracking.{" "}
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => !e)}
                    className="font-ui text-sm font-medium text-[#8b4513] dark:text-[#b5673a] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3] dark:focus-visible:ring-offset-[#252220] rounded"
                    aria-expanded={expanded}
                    aria-controls="cookie-policy-summary"
                  >
                    {expanded ? "Hide Cookie Policy" : "See Cookie Policy"}
                  </button>
                  .
                </p>

                {expanded && (
                  <motion.ul
                    id="cookie-policy-summary"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 space-y-1.5 font-ui text-xs text-[#6b6358] dark:text-[#9a9080] overflow-hidden"
                  >
                    {POLICY_SUMMARY.map((line, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden="true" className="text-[#8b4513] dark:text-[#b5673a]">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={dismiss}
                  className="font-ui"
                >
                  Got it
                </Button>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Dismiss cookie notice"
                  className="rounded-md p-1 text-[#6b6358] dark:text-[#9a9080] hover:bg-[#e8e0d0] dark:hover:bg-[#322e28] hover:text-[#2a2620] dark:hover:text-[#e8e3d8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
