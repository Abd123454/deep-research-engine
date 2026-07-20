"use client";

// FeedbackWidget — floating feedback button at the bottom-left of every page.
//
// Strategic #9 — opens a small panel with 👍 / 👎 buttons + a free-text
// comment field. Submits to /api/feedback (which stores in the `feedback`
// table, admin-only GET for stats). Designed to be unobtrusive:
//   - Defaults to a small icon-only button.
//   - Expands on click to a warm Quaesitor card.
//   - Dismissable (collapses back to the icon) without submitting.
//   - After submission, shows a brief "Thank you" then auto-collapses.
//
// Design: warm Quaesitor palette — `bg-[#faf8f3]` card, `border-[#d9d4c7]`,
// `text-[#8b4513]` accent. Visual elevation uses borders + surface tone
// only (per DESIGN.md). Framer Motion for the expand animation.
//
// SSR-safe: the button is hidden on the server (no window/navigator) and
// mounts only on the client to avoid hydration mismatches.

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ThumbsUp, ThumbsDown, X, Check } from "lucide-react";

interface FeedbackPayload {
  rating: "up" | "down";
  comment?: string;
  context?: {
    route?: string;
  };
}

export function FeedbackWidget() {
  const [open, setOpen] = React.useState(false);
  const [rating, setRating] = React.useState<"up" | "down" | null>(null);
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  // SSR-safety: only render after mount.
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Capture the current route for context (helps triage where the feedback
  // came from). Uses window.location.pathname — no router dependency.
  // Re-evaluated when the panel opens so the route is fresh.
  const currentRoute = React.useMemo(() => {
    if (typeof window === "undefined") return "/";
    return window.location.pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    if (!rating) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: FeedbackPayload = {
        rating,
        comment: comment.trim() || undefined,
        context: { route: currentRoute },
      };
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSubmitted(true);
      // Auto-collapse after 2.5s.
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setRating(null);
        setComment("");
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setRating(null);
    setComment("");
    setError(null);
  }

  if (!mounted) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-40"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {!open ? (
          // Collapsed: floating button.
          <motion.button
            key="collapsed"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-center gap-2 rounded-full border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#252220] pl-3 pr-4 py-2.5 font-ui text-sm text-[#2a2620] dark:text-[#e8e3d8] hover:bg-[#f4f1ea] dark:hover:bg-[#322e28] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f1ea] dark:focus-visible:ring-offset-[#1c1a17]"
            aria-label="Open feedback form"
            aria-expanded={false}
            aria-controls="feedback-panel"
          >
            <MessageSquare className="h-4 w-4 text-[#8b4513] dark:text-[#b5673a]" aria-hidden="true" />
            <span className="hidden sm:inline">Feedback</span>
          </motion.button>
        ) : (
          // Expanded: card with rating buttons + comment field.
          <motion.div
            key="expanded"
            id="feedback-panel"
            role="dialog"
            aria-label="Feedback form"
            aria-modal="false"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-[20rem] max-w-[calc(100vw-2rem)] rounded-[20px] border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#252220] p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-ui text-sm font-semibold text-[#2a2620] dark:text-[#e8e3d8]">
                  How was this?
                </h3>
                <p className="font-ui text-xs text-[#6b6358] dark:text-[#9a9080] mt-0.5">
                  Your feedback helps us improve Quaesitor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  handleReset();
                }}
                aria-label="Close feedback form"
                className="rounded-md p-1 text-[#6b6358] dark:text-[#9a9080] hover:bg-[#e8e0d0] dark:hover:bg-[#322e28] hover:text-[#2a2620] dark:hover:text-[#e8e3d8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8b4513]/10 dark:bg-[#b5673a]/10 text-[#8b4513] dark:text-[#b5673a] mb-2">
                  <Check className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="font-ui text-sm font-medium text-[#2a2620] dark:text-[#e8e3d8]">
                  Thank you!
                </p>
                <p className="font-ui text-xs text-[#6b6358] dark:text-[#9a9080] mt-1">
                  Your feedback was recorded.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setRating("up")}
                    aria-pressed={rating === "up"}
                    className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 font-ui text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3] dark:focus-visible:ring-offset-[#252220] ${
                      rating === "up"
                        ? "border-[#8b4513] dark:border-[#b5673a] bg-[#8b4513]/10 dark:bg-[#b5673a]/10 text-[#8b4513] dark:text-[#b5673a]"
                        : "border-[#d9d4c7] dark:border-[#3d3830] text-[#2a2620] dark:text-[#e8e3d8] hover:bg-[#f4f1ea] dark:hover:bg-[#322e28]"
                    }`}
                  >
                    <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                    Good
                  </button>
                  <button
                    type="button"
                    onClick={() => setRating("down")}
                    aria-pressed={rating === "down"}
                    className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 font-ui text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3] dark:focus-visible:ring-offset-[#252220] ${
                      rating === "down"
                        ? "border-[#a33a3a] bg-[#a33a3a]/10 text-[#a33a3a]"
                        : "border-[#d9d4c7] dark:border-[#3d3830] text-[#2a2620] dark:text-[#e8e3d8] hover:bg-[#f4f1ea] dark:hover:bg-[#322e28]"
                    }`}
                  >
                    <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                    Needs work
                  </button>
                </div>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={5000}
                  placeholder={
                    rating === "down"
                      ? "What could be better? (optional)"
                      : "Anything else you'd like to share? (optional)"
                  }
                  className="w-full rounded-lg border border-[#d9d4c7] dark:border-[#3d3830] bg-[#f4f1ea] dark:bg-[#1c1a17] px-3 py-2 font-ui text-sm text-[#2a2620] dark:text-[#e8e3d8] placeholder:text-[#6b6358] dark:placeholder:text-[#9a9080] outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513] resize-none"
                  aria-label="Optional feedback comment"
                />

                {error && (
                  <p className="font-ui text-xs text-[#a33a3a] mt-2" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!rating && !comment}
                    className="rounded-lg border border-[#d9d4c7] dark:border-[#3d3830] px-3 py-1.5 font-ui text-sm text-[#2a2620] dark:text-[#e8e3d8] hover:bg-[#e0d9c8] dark:hover:bg-[#322e28] transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!rating || submitting}
                    className="rounded-lg bg-[#8b4513] dark:bg-[#b5673a] text-[#faf8f3] px-4 py-1.5 font-ui text-sm font-medium hover:bg-[#6b3410] dark:hover:bg-[#8b4513] transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3] dark:focus-visible:ring-offset-[#252220]"
                  >
                    {submitting ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
