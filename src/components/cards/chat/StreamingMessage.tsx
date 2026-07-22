"use client";

// StreamingMessage.tsx — the in-flight assistant message being streamed.
//
// Extracted from ChatCard.tsx (FC-3, UI God-object split). Renders two
// states:
//   1. streamingResponse non-empty → live markdown render with a fade-in
//      motion span + a blinking cursor + an optional "Artifact detected"
//      button when detectArtifactStream has fired.
//   2. streamingResponse empty → skeleton placeholder (3 pulsing bars)
//      shown before the first token arrives.
//
// Pure presentational — no state of its own.

import * as React from "react";
import { motion } from "framer-motion";
import { PanelRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Artifact } from "@/lib/artifact-detector";

export interface StreamingMessageProps {
  /** Partial assistant text accumulated so far (may be empty before first token). */
  streamingResponse: string;
  /** Provider attribution subtitle (shown as soon as the meta event arrives). */
  providerSubtitle: string | null;
  /** Markdown component map (from useChatMarkdown). */
  markdownComponents: Record<string, React.ComponentType<any>>;
  /** Partial artifact detected in the stream (opening marker found). */
  streamArtifact: Artifact | null;
  /** Callback to open the artifact side panel with the partial content. */
  onArtifact?: (artifact: Artifact, isPartial: boolean) => void;
}

export const StreamingMessage = React.memo(function StreamingMessage({
  streamingResponse,
  providerSubtitle,
  markdownComponents,
  streamArtifact,
  onArtifact,
}: StreamingMessageProps) {
  // State 2: no tokens yet — show skeleton.
  if (!streamingResponse) {
    return (
      <div className="mb-6">
        {/* Even before the first token, show the provider attribution if the meta event has arrived. */}
        {providerSubtitle && (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-ui text-xs font-medium text-[#6b6358] dark:text-[#9a9080]">Quaesitor</span>
            <span
              className="font-ui text-[11px] text-[#8b6f47] dark:text-[#b8946a] truncate max-w-full"
              title={providerSubtitle}
            >
              · {providerSubtitle}
            </span>
          </div>
        )}
        <div className={`space-y-2 animate-pulse ${providerSubtitle ? "" : "mt-0"}`}>
          <div className="h-4 bg-[#d9d4c7] dark:bg-[#322e28] rounded w-3/4" />
          <div className="h-4 bg-[#d9d4c7] dark:bg-[#322e28] rounded w-full" />
          <div className="h-4 bg-[#d9d4c7] dark:bg-[#322e28] rounded w-5/6" />
        </div>
      </div>
    );
  }

  // State 1: tokens are arriving — live markdown render.
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="font-ui text-xs font-medium text-[#6b6358] dark:text-[#9a9080]">Quaesitor</span>
        {providerSubtitle && (
          <span
            className="font-ui text-[11px] text-[#8b6f47] dark:text-[#b8946a] truncate max-w-full"
            title={providerSubtitle}
          >
            · {providerSubtitle}
          </span>
        )}
      </div>
      <div className="prose prose-quaesitor font-body break-words text-[#2a2620] dark:text-[#e8e3d8] max-w-none">
        {/* P0-24: Streaming token animation. Wraps the streaming block in
            a motion.span that fades opacity from 0.6 → 1 on mount. The
            duration is short (80ms) and the prop stays opacity:1 so
            there's no visible flicker — just a gentle "settling" feel. */}
        <motion.span
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.08, ease: "easeOut" }}
        >
          <ReactMarkdown components={markdownComponents}>{streamingResponse}</ReactMarkdown>
        </motion.span>
        <span className="inline-block h-4 w-1.5 bg-[#8b4513] animate-pulse ml-0.5" />
      </div>
      {/* Streaming artifact affordance: while detectArtifactStream has
          fired (an opening marker is in the buffer), show a small button.
          Clicking calls onArtifact with the PARTIAL artifact so the
          parent can open the ArtifactsPanel and render a live preview. */}
      {streamArtifact && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => onArtifact?.(streamArtifact, true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#8b4513]/30 dark:border-[#b5673a]/30 bg-[#8b4513]/5 dark:bg-[#b5673a]/10 px-2 py-1 font-ui text-[11px] font-medium text-[#8b4513] dark:text-[#b5673a] hover:border-[#8b4513]/50 dark:hover:border-[#b5673a]/50 hover:bg-[#8b4513]/10 dark:hover:bg-[#b5673a]/15 transition-colors"
            aria-label={`Open ${streamArtifact.type} artifact in side panel`}
            title={`Open ${streamArtifact.type} artifact in side panel (partial — full content will arrive when streaming completes)`}
          >
            <PanelRight className="h-3.5 w-3.5" aria-hidden="true" />
            Artifact detected
            <span className="text-[#6b6358] dark:text-[#9a9080] font-normal">→</span>
          </button>
        </div>
      )}
    </div>
  );
});
