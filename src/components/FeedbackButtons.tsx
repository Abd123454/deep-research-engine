"use client";

// FeedbackButtons — P0-104: per-message thumbs up/down feedback.
//
// Distinct from the floating FeedbackWidget (which is page-level
// feedback). FeedbackButtons renders inline below each ASSISTANT
// message in ChatCard, so the user can rate individual responses.
//
// Behavior:
//   - Click 👍 → submit "up" rating immediately, show "Thanks!".
//   - Click 👎 → submit "down" rating immediately, then expand an
//     inline textarea asking "What could be better?" (optional).
//     The comment is submitted as a SECOND request (same rating +
//     the comment text). The user can Skip the comment.
//   - Both buttons show their pressed state (aria-pressed + color
//     tint) after a rating is submitted.
//
// API: POSTs to /api/feedback with `{ rating, comment?, context: {
// messageId, conversationId } }`. The endpoint is auth-gated and
// stores rows in the `feedback` SQLite table. Failure is silent
// (no error toast — the user already saw "Thanks!" and we don't
// want to nag them with a retry UI for an optional signal).
//
// Design: Quaesitor sepia palette. Thumbs-up selected → saddle
// brown (#8b4513); thumbs-down selected → destructive red
// (#a33a3a). Both use 10% bg tint of their accent. Idle state
// is muted (#6b6358) with a subtle 5% hover bg. Visual elevation
// uses borders + surface tone only (per DESIGN.md).

import * as React from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface FeedbackButtonsProps {
  /** Stable ID for the message being rated. Passed to the API as
   *  `context.messageId` so feedback can be correlated to a specific
   *  assistant response in the admin stats view. */
  messageId: string;
  /** Optional conversation ID. Passed as `context.conversationId`. */
  conversationId?: string;
}

export function FeedbackButtons({ messageId, conversationId }: FeedbackButtonsProps) {
  const [rating, setRating] = React.useState<"up" | "down" | null>(null);
  // P0-104: when the user clicks thumbs-down, expand an inline
  // textarea for an optional comment. The comment is submitted as
  // a separate request (so the rating itself isn't blocked on the
  // user typing). `showModal` is the expand flag; the naming mirrors
  // the task spec (a future iteration could swap the inline form
  // for an actual <Dialog> without renaming the state).
  const [showModal, setShowModal] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [commentSubmitted, setCommentSubmitted] = React.useState(false);

  async function submit(r: "up" | "down") {
    setRating(r);
    if (r === "down") setShowModal(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: r,
          context: { messageId, conversationId },
        }),
      });
     
    } catch {
      // Silent failure — feedback is an optional signal, not a
      // user-blocking action. The "Thanks!" indicator still shows
      // so the user gets immediate acknowledgment.
    }
  }

  async function submitComment() {
    if (!feedback.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: feedback.trim(),
          context: { messageId, conversationId },
        }),
      });
      setCommentSubmitted(true);
      setShowModal(false);
     
    } catch {
      // Same silent-failure policy as `submit`.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => submit("up")}
          className={`flex size-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513]/40 dark:focus-visible:ring-[#b5673a]/40 ${
            rating === "up"
              ? "text-[#8b4513] bg-[#8b4513]/10 dark:text-[#b5673a] dark:bg-[#b5673a]/15"
              : "text-[#6b6358] hover:bg-[#2a2620]/5 dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5"
          }`}
          aria-label="Good response"
          aria-pressed={rating === "up"}
        >
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => submit("down")}
          className={`flex size-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513]/40 dark:focus-visible:ring-[#b5673a]/40 ${
            rating === "down"
              ? "text-[#a33a3a] bg-[#a33a3a]/10 dark:text-[#d47a7a] dark:bg-[#a33a3a]/15"
              : "text-[#6b6358] hover:bg-[#2a2620]/5 dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5"
          }`}
          aria-label="Bad response"
          aria-pressed={rating === "down"}
        >
          <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {rating && !showModal && (
          <span className="text-xs text-[#6b6358] dark:text-[#9a9080] ml-1 font-ui">
            {commentSubmitted ? "Thanks for the feedback!" : "Thanks!"}
          </span>
        )}
      </div>

      {/* Optional comment box — expanded after thumbs-down. */}
      {showModal && (
        <div className="flex flex-col gap-1.5 mt-1 max-w-md">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What could be better? (optional)"
            rows={2}
            maxLength={5000}
            className="rounded-md border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#1c1a17] px-2 py-1.5 font-ui text-xs text-[#2a2620] dark:text-[#e8e3d8] placeholder:text-[#6b6358] dark:placeholder:text-[#9a9080] outline-none focus:ring-2 focus:ring-[#8b4513]/30 dark:focus:ring-[#b5673a]/30 resize-none"
            aria-label="Optional feedback comment"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={submitComment}
              disabled={submitting || !feedback.trim()}
              className="rounded-md bg-[#8b4513] dark:bg-[#b5673a] text-[#faf8f3] px-2.5 py-1 font-ui text-xs font-medium hover:bg-[#6b3410] dark:hover:bg-[#8b4513] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513]/40 dark:focus-visible:ring-[#b5673a]/40"
            >
              {submitting ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="rounded-md border border-[#d9d4c7] dark:border-[#3d3830] px-2.5 py-1 font-ui text-xs text-[#6b6358] dark:text-[#9a9080] hover:bg-[#2a2620]/5 dark:hover:bg-[#e8e3d8]/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513]/40 dark:focus-visible:ring-[#b5673a]/40"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
