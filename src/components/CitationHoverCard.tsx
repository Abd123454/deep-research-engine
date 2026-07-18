"use client";

// CitationHoverCard — P0-8: interactive [N] citation popovers.
//
// Replaces plain-text `[1]` citations in chat/research messages with a
// clickable, hoverable span that opens a popover showing:
//   - Source title
//   - URL (clickable, opens in a new tab)
//   - Domain (host)
//   - Tier badge (★★★ Academic / ★★☆ Industry / ★☆☆ General) — derived
//     from `scoreSource()` from source-quality.ts
//   - Verified badge (if the citation-verifier confirmed this citation)
//
// Design: Quaesitor "Investigator's Journal" palette — warm card
// (#faf8f3 light / #252220 dark), deckle-edge border (#d9d4c7 /
// #3d3830), font-ui (DM Sans) for metadata. The popover appears above
// the citation number, never below (so a citation at the bottom of a
// long message doesn't get clipped by the message container).
//
// Accessibility:
//   - The trigger is a <button> with aria-haspopup="dialog" +
//     aria-expanded reflecting open state.
//   - The popover has role="dialog" + aria-label.
//   - Hover (desktop) AND click (mobile) both work — hover opens after
//     a 250ms delay (so accidental mouse-overs don't flicker), click
//     toggles immediately.
//   - Esc closes; clicking outside closes (via a document listener).
//   - The trigger is keyboard-focusable; Enter/Space toggles.
//
// Backward compatibility: when no `source` is provided (e.g. ChatCard's
// assistant messages, which don't currently carry source metadata), the
// component renders the plain `[N]` text — visually identical to the
// pre-existing behavior. This means existing chat transcripts render
// unchanged; only ResearchCard's reports (which have sources) get the
// interactive cards.

import * as React from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Star, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { scoreSource, type SourceTier } from "@/lib/source-quality";

// ---------- Source shape ----------
//
// A minimal subset of the `Source` type from `src/lib/types.ts`. We
// accept this looser shape so callers can pass either the engine's
// `Source` (with `host`/`excerpt`) or the citation-verifier's
// `CitationCheck` (which has `sourceTitle`/`sourceExcerpt` instead).
export interface CitationSource {
  url: string;
  title?: string;
  /** Domain/host — falls back to extracting from `url` if absent. */
  host?: string;
  excerpt?: string;
  publishedTime?: string;
}

export interface CitationHoverCardProps {
  /** The citation number as it appears in the report (1-indexed). */
  number: number;
  /** The source data. When omitted, renders plain `[N]` text. */
  source?: CitationSource | null;
  /**
   * Verification status from the citation-verifier.
   * - "verified"     → green check badge (popover) + ✓ inline (P0-59)
   * - "unverified"   → amber alert badge (popover) + ⚠ inline (P0-59)
   * - "contradicts"  → red X badge (popover) + ✕ inline (P0-59)
   * - undefined      → no badge (verification wasn't run)
   */
  verification?: "verified" | "unverified" | "contradicts" | null;
}

// ---------- Tier badge helpers ----------

const TIER_META: Record<SourceTier, { stars: string; label: string; cls: string }> = {
  tier1: {
    stars: "★★★",
    label: "Academic",
    cls: "text-[#8b4513] dark:text-[#b5673a] bg-[#8b4513]/10 dark:bg-[#b5673a]/15",
  },
  tier2: {
    stars: "★★☆",
    label: "Industry",
    cls: "text-[#6b6f47] dark:text-[#a3b87a] bg-[#6b6f47]/10 dark:bg-[#a3b87a]/15",
  },
  tier3: {
    stars: "★☆☆",
    label: "General",
    cls: "text-[#6b6358] dark:text-[#9a9080] bg-[#6b6358]/10 dark:bg-[#9a9080]/15",
  },
};

const VERIFICATION_META = {
  verified: {
    label: "Verified",
    Icon: CheckCircle2,
    cls: "text-[#4a7a3a] dark:text-[#7ab566] bg-[#4a7a3a]/10 dark:bg-[#7ab566]/15",
  },
  unverified: {
    label: "Unverified",
    Icon: AlertCircle,
    cls: "text-[#a37a3f] dark:text-[#d4a574] bg-[#a37a3f]/10 dark:bg-[#d4a574]/15",
  },
  contradicts: {
    label: "Contradicted",
    Icon: XCircle,
    cls: "text-[#a33a3a] dark:text-[#d47a7a] bg-[#a33a3a]/10 dark:bg-[#d47a7a]/15",
  },
} as const;

// ---------- P0-59: Inline status badges ----------
//
// Small symbol badges shown DIRECTLY in the text (no hover/click
// required) next to a `[N]` citation number, OR replacing a
// `[verified]` / `[unverified]` / `[contradicted]` /
// `[single-sourced]` / `[well-sourced]` text marker that the
// assistant emits inline. The popover (rendered by
// CitationHoverCardInner) shows full details; the inline badge is
// the at-a-glance indicator.
//
// Five symbols, all drawn from the Quaesitor sepia palette:
//   ✓ verified          — text-[#4a6b3a] (green-ish, like sage)
//   ⚠ unverified        — text-[#a37a3f] (amber)
//   ✕ contradicted      — text-[#a33a3a] (red, same as --destructive)
//   ◊ single-sourced    — text-[#6b6358] (muted, faded ink)
//   ★ well-sourced      — text-[#a37a3f] (gold — same amber as unverified
//                          but a star glyph distinguishes it at a glance)
//
// The symbols are Unicode glyphs (not SVG icons) so they scale with
// the surrounding text and inherit the font weight. `aria-label`
// gives screen readers the word; sighted users see the symbol.
//
// `InlineStatus` is the union used by both the inline badge (this
// component) and the text-marker parser (parseStatusMarkers below).
// Note `contradicted` (the inline-marker form) vs. `contradicts`
// (the verification enum form) — the conversion happens at the
// call site in CitationHoverCardInner.

export type InlineStatus =
  | "verified"
  | "unverified"
  | "contradicted"
  | "single-sourced"
  | "well-sourced";

const INLINE_STATUS_META: Record<InlineStatus, { symbol: string; label: string; cls: string }> = {
  verified:         { symbol: "✓", label: "Verified",        cls: "text-[#4a6b3a] dark:text-[#7ab566]" },
  unverified:       { symbol: "⚠", label: "Unverified",      cls: "text-[#a37a3f] dark:text-[#d4a574]" },
  contradicted:     { symbol: "✕", label: "Contradicted",    cls: "text-[#a33a3a] dark:text-[#d47a7a]" },
  "single-sourced": { symbol: "◊", label: "Single-sourced",  cls: "text-[#6b6358] dark:text-[#9a9080]" },
  "well-sourced":   { symbol: "★", label: "Well-sourced",    cls: "text-[#a37a3f] dark:text-[#d4a574]" },
};

export function InlineStatusBadge({ status }: { status: InlineStatus }) {
  const meta = INLINE_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-baseline font-mono text-[0.7em] font-semibold leading-none ${meta.cls} ml-0.5 align-baseline`}
      aria-label={meta.label}
      role="img"
      title={meta.label}
    >
      <span aria-hidden="true">{meta.symbol}</span>
    </span>
  );
}

// Extract a hostname from a URL (used when `source.host` is absent).
function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ---------- Component ----------
//
// We split this into a public `CitationHoverCard` (which handles the
// no-source fallback) and a private `CitationHoverCardInner` (which
// renders the interactive popover). The split is necessary to satisfy
// the React hooks-order rule: the inner component always has a source,
// so its hooks run in a consistent order. The outer component decides
// whether to render the fallback or the inner component — and since
// the outer component has NO hooks of its own, there's no
// conditional-hook violation.

export function CitationHoverCard({ number, source, verification }: CitationHoverCardProps) {
  // Backward-compatible fallback: no source → plain `[N]` text. This
  // matches the pre-existing rendering in chat transcripts (where the
  // chat API doesn't currently send source metadata). When a source IS
  // available, delegate to the inner component which owns the popover
  // state + listeners.
  if (!source) {
    return (
      <span className="font-mono text-[0.85em] text-[#8b4513] dark:text-[#c4824a]">
        [{number}]
      </span>
    );
  }
  return (
    <CitationHoverCardInner
      number={number}
      source={source}
      verification={verification}
    />
  );
}

// ---------- Inner component (renders the interactive popover) ----------

interface CitationHoverCardInnerProps {
  number: number;
  source: CitationSource; // non-null — outer component handles the null case
  verification?: CitationHoverCardProps["verification"];
}

function CitationHoverCardInner({ number, source, verification }: CitationHoverCardInnerProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Portal target — render the popover to document.body so it isn't
  // clipped by parent containers with `overflow: hidden` (which the
  // chat scroll container has).
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null);
  // Popover position (computed on each open).
  const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>({});
  React.useEffect(() => {
    if (typeof document !== "undefined") setPortalTarget(document.body);
  }, []);

  const tier = scoreSource(source.url, source.excerpt).tier;
  const tierMeta = TIER_META[tier];
  const host = source.host || hostFromUrl(source.url);
  const verif = verification ? VERIFICATION_META[verification] : null;

  // ---------- Hover + click handlers ----------
  //
  // Desktop: hover opens after 250ms (so accidental mouse-overs don't
  // flicker the popover). Mouse-leave closes (with a 150ms grace period
  // so moving the cursor from the trigger to the popover doesn't close
  // it — the popover itself also binds onMouseEnter to cancel the close).
  //
  // Mobile: click toggles immediately. There's no hover on touch, so
  // the click handler is the only entry point. Touch users also see
  // the popover on tap; tapping outside (handled by the document
  // listener below) closes it.

  function openAfterDelay() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(true), 250);
  }
  function closeAfterDelay() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(false), 150);
  }
  function clearHoverTimer() {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }

  // Esc + click-outside dismissal.
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(e: MouseEvent) {
      // Close if the click is outside both the trigger and the popover.
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  // Cleanup hover timer on unmount.
  React.useEffect(() => clearHoverTimer, []);

  // ---------- Popover position ----------
  //
  // Computed on each open: the popover is positioned above the trigger
  // (bottom edge of popover = top edge of trigger + 6px gap). On small
  // screens, if there isn't room above, we flip to below. Width is
  // clamped to 320px and the popover is left-aligned to the trigger
  // (with viewport clamping so it doesn't overflow the right edge).
  React.useEffect(() => {
    if (!open) return;
    if (!triggerRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const POPOVER_W = 320;
    const GAP = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Default: above the trigger, left-aligned.
    let top = trigger.top - 8 - POPOVER_W * 0; // updated below using measured height
    let left = trigger.left;
    // Measure after first paint via rAF.
    const id = requestAnimationFrame(() => {
      const popEl = popoverRef.current;
      const popH = popEl?.offsetHeight || 160;
      // If there's not enough room above, flip below.
      const roomAbove = trigger.top - popH - GAP;
      const roomBelow = vh - trigger.bottom - popH - GAP;
      if (roomAbove < 12 && roomBelow > 12) {
        top = trigger.bottom + GAP;
      } else {
        top = Math.max(8, trigger.top - popH - GAP);
      }
      // Clamp left so the popover doesn't overflow the right edge.
      left = Math.min(trigger.left, vw - POPOVER_W - 8);
      left = Math.max(8, left);
      setPopoverStyle({
        position: "fixed",
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${POPOVER_W}px`,
        maxWidth: `calc(100vw - 16px)`,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-baseline font-mono text-[0.85em] text-[#8b4513] hover:text-[#6b3410] dark:text-[#c4824a] dark:hover:text-[#e8a574] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513]/40 dark:focus-visible:ring-[#b5673a]/40 rounded-sm px-0.5 transition-colors"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Citation ${number}: ${source.title || host}. ${verification ? `Verification: ${verification}.` : ""} Activate to see source details.`}
        onMouseEnter={openAfterDelay}
        onMouseLeave={closeAfterDelay}
        onFocus={() => setOpen(true)}
        onBlur={closeAfterDelay}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        [{number}]
      </button>
      {/* P0-59: inline status badge after the `[N]` number. The
          popover (above) shows full details on hover/click; this
          inline glyph is the at-a-glance indicator visible without
          interaction. Only rendered when `verification` is provided
          (i.e. the citation-verifier actually ran for this citation).
          The enum value `contradicts` maps to the inline glyph `✕`
          (labelled "Contradicted" — the past-participle form is more
          readable in the inline context than the verb form). */}
      {verification && (
        <InlineStatusBadge
          status={verification === "contradicts" ? "contradicted" : verification}
        />
      )}

      {open && portalTarget && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Source ${number}: ${source.title || host}`}
          style={popoverStyle}
          className="z-[90] rounded-xl border border-[#d9d4c7] bg-[#faf8f3] p-3.5 dark:border-[#3d3830] dark:bg-[#252220]"
          onMouseEnter={() => {
            // Cancel the close timer so the user can move into the popover.
            if (hoverTimer.current) {
              clearTimeout(hoverTimer.current);
              hoverTimer.current = null;
            }
          }}
          onMouseLeave={closeAfterDelay}
        >
          {/* Header: tier badge + (optional) verification badge */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-ui text-[10px] font-semibold ${tierMeta.cls}`}
              title={`${tierMeta.label} source (tier ${tier.replace("tier", "")})`}
            >
              <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
              {tierMeta.stars}
              <span className="sr-only">{tierMeta.label}</span>
            </span>
            {verif && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-ui text-[10px] font-semibold ${verif.cls}`}
                title={`Citation ${verification}: the cited source ${verification === "verified" ? "directly supports the claim" : verification === "contradicts" ? "contradicts the claim" : "is cited but doesn't clearly support the claim"}.`}
              >
                <verif.Icon className="h-2.5 w-2.5" aria-hidden="true" />
                {verif.label}
              </span>
            )}
            <span className="ml-auto font-ui text-[10px] text-[#6b6358] dark:text-[#9a9080]">
              #{number}
            </span>
          </div>

          {/* Title — Newsreader (font-body) for editorial weight */}
          <p className="mb-1 font-body text-[13px] font-medium leading-snug text-[#2a2620] dark:text-[#e8e3d8]">
            {source.title || host}
          </p>

          {/* Domain + date — DM Sans (font-ui) for chrome text */}
          <p className="mb-2 font-ui text-[11px] text-[#6b6358] dark:text-[#9a9080]">
            {host}
            {source.publishedTime && (
              <>
                {" · "}
                {source.publishedTime.slice(0, 10)}
              </>
            )}
          </p>

          {/* Excerpt — short, italic, muted */}
          {source.excerpt && (
            <p className="mb-2 line-clamp-3 font-body text-[12px] italic leading-relaxed text-[#6b6358] dark:text-[#9a9080]">
              “{source.excerpt.slice(0, 240)}{source.excerpt.length > 240 ? "…" : ""}”
            </p>
          )}

          {/* URL — clickable, opens in new tab with rel=noopener */}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-ui text-[11px] font-medium text-[#8b4513] hover:text-[#6b3410] dark:text-[#b5673a] dark:hover:text-[#c4824a] underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate max-w-[260px]">{source.url}</span>
          </a>
        </div>,
        portalTarget
      )}
    </>
  );
}

// ---------- Text-with-citations parser ----------
//
// Splits a text node (a string from react-markdown's `p` renderer) into
// an array of strings + CitationHoverCard elements + InlineStatusBadge
// elements. Patterns detected:
//   [1]      → CitationHoverCard (with source from `sources[0]`)
//   [12]     → CitationHoverCard (with source from `sources[11]`)
//   [1, 2]   → two CitationHoverCards (comma-separated, optional space)
//   [1-3]    → three CitationHoverCards (range)
//
// P0-59 — inline status markers (also split, replaced with badges):
//   [verified]        → ✓ InlineStatusBadge
//   [unverified]      → ⚠ InlineStatusBadge
//   [contradicted]    → ✕ InlineStatusBadge
//   [single-sourced]  → ◊ InlineStatusBadge
//   [well-sourced]    → ★ InlineStatusBadge
//
// Patterns NOT touched (left as plain text):
//   - [text], [text](url) — handled by react-markdown's link renderer
//     (any bracketed string that doesn't match the citation regex AND
//     isn't one of the five status markers above falls through here)
//
// The `verificationMap` is an optional map from citation number (1-indexed)
// to the citation-verifier's status. When provided, the corresponding
// CitationHoverCard renders BOTH the inline status badge (P0-59) and
// the popover verification badge (P0-8).

const STATUS_MARKER_PATTERN =
  /\[(verified|unverified|contradicted|single-sourced|well-sourced)\]/g;

/**
 * P0-59: split a text chunk (between citations) on inline status
 * markers like `[verified]` / `[unverified]` / `[contradicted]` /
 * `[single-sourced]` / `[well-sourced]`. Each marker becomes an
 * `<InlineStatusBadge>`; the text between markers stays as plain
 * strings. The `baseKey` is used to namespace the React `key`s so
 * they don't collide with sibling CitationHoverCard elements in the
 * parent array.
 */
function parseStatusMarkers(text: string, baseKey: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  STATUS_MARKER_PATTERN.lastIndex = 0;
  while ((match = STATUS_MARKER_PATTERN.exec(text)) !== null) {
    if (match.index > lastIdx) {
      out.push(text.slice(lastIdx, match.index));
    }
    const status = match[1] as InlineStatus;
    out.push(<InlineStatusBadge key={`${baseKey}-st${k++}`} status={status} />);
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    out.push(text.slice(lastIdx));
  }
  // If no markers were found, `out` is `[text]` — a single-element
  // array. The parent spreads this into its own array, so the result
  // is identical to the previous `out.push(text.slice(...))` behavior.
  return out;
}

export function parseCitations(
  text: string,
  sources?: CitationSource[] | null,
  verificationMap?: Map<number, "verified" | "unverified" | "contradicts"> | null
): React.ReactNode[] {
  // Match [N], [N, M], [N-M], but NOT [text], [verified], etc.
  // The regex captures:
  //   group 1: the inner content (digits, commas, dashes, spaces)
  // We post-filter to ensure the inner content is numeric-ish.
  const pattern = /\[(\d+(?:\s*,\s*\d+)*(?:\s*-\s*\d+)?)\]/g;
  const out: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    // Push the text before the citation, split on status markers
    // (P0-59: `[verified]` / `[unverified]` / `[contradicted]` /
    // `[single-sourced]` / `[well-sourced]` become inline badges).
    if (match.index > lastIdx) {
      const chunk = text.slice(lastIdx, match.index);
      const parsed = parseStatusMarkers(chunk, `txt-${key++}`);
      for (const node of parsed) out.push(node);
    }
    const inner = match[1]!;
    // Parse the inner content into a list of citation numbers.
    const nums: number[] = [];
    for (const part of inner.split(",")) {
      const trimmed = part.trim();
      const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]!, 10);
        const end = parseInt(rangeMatch[2]!, 10);
        const lo = Math.min(start, end);
        const hi = Math.max(start, end);
        // Cap at 20 to avoid pathological inputs.
        for (let n = lo; n <= hi && n <= lo + 20; n++) nums.push(n);
      } else {
        const n = parseInt(trimmed, 10);
        if (!Number.isNaN(n)) nums.push(n);
      }
    }
    // Render each citation. If `sources` is provided, attach the source.
    // If the citation number is out of range, render plain `[N]` (via
    // the CitationHoverCard's no-source fallback).
    for (const n of nums) {
      const src = sources && n >= 1 && n <= sources.length ? sources[n - 1] : null;
      const verif = verificationMap?.get(n) ?? null;
      out.push(
        <CitationHoverCard
          key={`cite-${key++}`}
          number={n}
          source={src}
          verification={verif}
        />
      );
      // Add a thin space between consecutive citations so they don't
      // visually merge into "[1][2]". A regular space would create odd
      // wrapping; a thin space (U+2009) is the typographically correct
      // separator for inline citations.
      out.push("\u2009");
    }
    lastIdx = match.index + match[0].length;
  }
  // Push the trailing text, split on status markers.
  if (lastIdx < text.length) {
    const chunk = text.slice(lastIdx);
    const parsed = parseStatusMarkers(chunk, `txt-${key++}`);
    for (const node of parsed) out.push(node);
  }
  return out;
}
