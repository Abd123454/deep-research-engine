"use client";

// CollabIndicator — small participant-presence indicator for real-time
// collaboration sessions.
//
// P2-final-wave / Feature 2: renders a row of colored dots (one per
// active participant) with initials. Used in the ArtifactsPanel header
// (or wherever collaboration is active) to show "who else is here".
//
// Design: Quaesitor "Amber & Ink" palette. Each participant gets a
// deterministic color derived from their userId (a stable hash → one
// of 5 warm palette colors). The dots overlap slightly (-ml-1) like
// Slack's avatar stack. A "+N" pill appears when there are more than
// `max` participants.
//
// Data source: the parent passes `participants` (an array of userIds).
// The component itself does NOT fetch — the parent owns the polling /
// WebSocket subscription. This keeps CollabIndicator a pure view
// component (easy to test, easy to drop into any context).
//
// Accessibility: the whole stack has `aria-label` describing the
// participant count; each dot has a `title` with the userId.

import * as React from "react";
import { cn } from "@/lib/utils";

interface CollabIndicatorProps {
  /** Active participant userIds. The first entry is the session owner. */
  participants: string[];
  /** Max dots to render before collapsing into "+N". Default: 4. */
  max?: number;
  /** Optional className for the container. */
  className?: string;
}

// Five warm palette colors for participant dots. Deterministic per-userId
// assignment (hash → index) so the same user always gets the same color
// across sessions — helps users recognize "the brown dot is me".
const PARTICIPANT_COLORS = [
  "bg-[#8b4513] text-[#faf8f3]",       // saddle brown (primary)
  "bg-[#b5673a] text-[#faf8f3]",       // lighter leather
  "bg-[#5a3a1a] text-[#faf8f3]",       // burnt sienna
  "bg-[#6b6358] text-[#faf8f3]",       // faded ink
  "bg-[#a67c52] text-[#faf8f3]",       // camel
] as const;

/**
 * Deterministic color index for a userId. Uses a simple DJB2 hash —
 * not cryptographically secure, but stable and fast. The same userId
 * always maps to the same color, so users can recognize "their" dot.
 */
function colorForUserId(userId: string): number {
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PARTICIPANT_COLORS.length;
}

/**
 * Extract up to 2 initials from a userId for the dot label.
 * Handles email-like ids ("alice@ex.com" → "A"), handle-style ids
 * ("alice_smith" → "AS"), and plain ids ("alice" → "A").
 */
function initialsForUserId(userId: string): string {
  const cleaned = userId
    .replace(/^[^a-zA-Z]+/, "") // strip leading non-alpha
    .split(/[@._\-\s]+/)        // split on common separators
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return cleaned || "?";
}

export function CollabIndicator({ participants, max = 4, className }: CollabIndicatorProps) {
  if (!participants || participants.length === 0) return null;

  const visible = participants.slice(0, max);
  const overflow = participants.length - visible.length;

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      aria-label={`${participants.length} ${participants.length === 1 ? "collaborator" : "collaborators"} active`}
      role="group"
    >
      {visible.map((userId, i) => (
        <span
          key={`${userId}-${i}`}
          title={userId}
          className={cn(
            "inline-flex items-center justify-center rounded-full h-5 w-5 text-[9px] font-ui font-semibold ring-2 ring-[#faf8f3] dark:ring-[#1c1a17]",
            PARTICIPANT_COLORS[colorForUserId(userId)],
            // Overlap dots after the first (Slack-style stack).
            i > 0 && "-ml-1.5"
          )}
        >
          {initialsForUserId(userId)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center justify-center rounded-full h-5 w-5 text-[9px] font-ui font-medium bg-[#f4f1ea] dark:bg-[#322e28] text-[#6b6358] dark:text-[#9a9080] ring-2 ring-[#faf8f3] dark:ring-[#1c1a17] -ml-1.5">
          +{overflow}
        </span>
      )}
    </div>
  );
}
