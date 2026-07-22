"use client";

// AssistantMessage.tsx — a single rendered assistant message in the chat.
//
// Extracted from ChatCard.tsx (FC-3, UI God-object split). This is a
// PURE PRESENTATIONAL component: it receives the message content, the
// markdown component map, the provider attribution, and callbacks for
// copy + feedback, then renders the Quaesitor-styled assistant turn.
//
// No state of its own — all state lives in the parent ChatCard. This
// keeps the component cheap to render (React.memo-friendly) and lets
// ChatCard focus on the SSE streaming state machine.

import * as React from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { FeedbackButtons } from "@/components/FeedbackButtons";

export interface AssistantMessageProps {
  content: string;
  /** Provider attribution subtitle (e.g. "llama-3.1-70b via NVIDIA (us-east)"). */
  providerSubtitle: string | null;
  /** Markdown component map (from useChatMarkdown). */
  markdownComponents: Record<string, React.ComponentType<any>>;
  /** Whether this message is the most recent (controls attribution display). */
  isLatest: boolean;
  /** Whether the stream is still active (hides feedback buttons while streaming). */
  streaming: boolean;
  /** Conversation id for feedback correlation. */
  conversationId: string;
  /** Array index of this message — used as the feedback messageId suffix. */
  index: number;
  /** Whether the copy button currently shows the "copied" check. */
  copied: boolean;
  /** Callback when the user clicks the copy button. */
  onCopy: (index: number, content: string) => void;
}

export const AssistantMessage = React.memo(function AssistantMessage({
  content,
  providerSubtitle,
  markdownComponents,
  isLatest,
  streaming,
  conversationId,
  index,
  copied,
  onCopy,
}: AssistantMessageProps) {
  return (
    <div className="group/msg max-w-full mb-6">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="font-ui text-xs font-medium text-[#6b6358] dark:text-[#9a9080]">Quaesitor</span>
        {/* Provider transparency: only the most recent assistant message
            gets the attribution subtitle (older history isn't retroactively
            annotated). */}
        {isLatest && providerSubtitle && (
          <span
            className="font-ui text-[11px] text-[#8b6f47] dark:text-[#b8946a] truncate max-w-full"
            title={providerSubtitle}
          >
            · {providerSubtitle}
          </span>
        )}
      </div>
      <div className="prose prose-quaesitor font-body break-words text-[#2a2620] dark:text-[#e8e3d8] max-w-none">
        <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
      </div>
      {/* Action bar — appears on hover (Quaesitor pattern). On touch
          devices there's no hover, so the bar is always visible below sm;
          on sm+ it fades in on hover. */}
      <div className="flex items-center gap-1 mt-2 opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 transition-opacity">
        <button
          onClick={() => onCopy(index, content)}
          className="flex size-7 items-center justify-center rounded-md text-[#6b6358] hover:bg-[#2a2620]/5 dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5 transition-colors"
          aria-label="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#8b4513]" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>
      {/* Per-message feedback. Always visible (not part of the hover-only
          action bar) so the user can rate without first hovering. */}
      {!streaming && (
        <FeedbackButtons
          messageId={`${conversationId || "init"}-${index}`}
          conversationId={conversationId}
        />
      )}
    </div>
  );
});
