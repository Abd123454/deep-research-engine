"use client";

// chat-markdown.tsx — shared ReactMarkdown component configuration for
// chat-bearing cards (ChatCard, and available for reuse by ResearchCard
// / DocumentCard if they later adopt the same rendering style).
//
// Extracted from ChatCard.tsx as part of the UI God-object split
// (FC-3, reach-10 audit). This file is PURE PRESENTATIONAL: it holds
// the Quaesitor markdown component map + the citation-rendering helper.
// No state, no effects, no fetches — just a function that takes
// `sources` and returns a `{ components, renderWithCitations }` pair
// that callers pass to <ReactMarkdown components={...}>.
//
// Split rationale: ChatCard.tsx was 796 lines and the markdown rendering
// block (renderWithCitations + quaesitorMarkdownComponents) was ~60
// lines of pure config unrelated to the chat state machine. Moving it
// here keeps ChatCard focused on conversation state + SSE streaming.

import * as React from "react";
import { parseCitations, type CitationSource } from "@/components/CitationHoverCard";

export interface ChatMarkdownHelpers {
  /** Walk markdown children, replacing [N] patterns with CitationHoverCard. */
  renderWithCitations: (children: React.ReactNode) => React.ReactNode;
  /** Component map for <ReactMarkdown components={...}>. */
  components: Record<string, React.ComponentType<any>>;
}

/**
 * Build the Quaesitor markdown component map for a given set of sources.
 *
 * `sources` may be null/empty (chat API doesn't currently send source
 * metadata). When absent, renderWithCitations returns children unchanged
 * — preserving the pre-existing rendering.
 */
export function useChatMarkdown(sources?: CitationSource[] | null): ChatMarkdownHelpers {
  const renderWithCitations = React.useCallback(
    (children: React.ReactNode): React.ReactNode => {
      if (!sources || sources.length === 0) return children;
      if (typeof children === "string") {
        return parseCitations(children, sources);
      }
      if (Array.isArray(children)) {
        return children.map((child, i) => {
          if (typeof child === "string") {
            return (
              <React.Fragment key={i}>
                {parseCitations(child, sources)}
              </React.Fragment>
            );
          }
          return child;
        });
      }
      return children;
    },
    [sources]
  );

  // Quaesitor markdown components — serif body, warm colors, persistent underlines.
  // Memoized so ChatCard's render doesn't re-create the object on every token.
  const components = React.useMemo<Record<string, React.ComponentType<any>>>(
    () => ({
      p: ({ children }: any) => <p className="mb-4">{renderWithCitations(children)}</p>,
      code: ({ inline, children }: any) =>
        inline
          ? <code className="font-mono text-[14px] bg-[#d9d4c7] dark:bg-[#322e28] px-1 py-0.5 rounded">{children}</code>
          : <pre className="font-mono text-[14px] bg-[#f4f1ea] dark:bg-[#1c1a17] p-4 rounded-lg overflow-x-auto my-4 border border-[#d9d4c7] dark:border-[#3d3830]"><code>{children}</code></pre>,
      a: ({ href, children }: any) => <a href={href} className="text-[#8b4513] underline underline-offset-2 hover:text-[#6b3410]">{children}</a>,
      h1: ({ children }: any) => <h1 className="font-body text-2xl font-semibold mt-6 mb-3 text-[#2a2620] dark:text-[#e8e3d8]">{renderWithCitations(children)}</h1>,
      h2: ({ children }: any) => <h2 className="font-body text-xl font-semibold mt-6 mb-3 text-[#2a2620] dark:text-[#e8e3d8]">{renderWithCitations(children)}</h2>,
      h3: ({ children }: any) => <h3 className="font-body text-lg font-semibold mt-4 mb-2 text-[#2a2620] dark:text-[#e8e3d8]">{renderWithCitations(children)}</h3>,
      ul: ({ children }: any) => <ul className="list-disc pl-6 my-4 space-y-1">{children}</ul>,
      ol: ({ children }: any) => <ol className="list-decimal pl-6 my-4 space-y-1">{children}</ol>,
      li: ({ children }: any) => <li className="font-body text-[16px] leading-[1.7]">{renderWithCitations(children)}</li>,
      blockquote: ({ children }: any) => <blockquote className="border-l-2 border-[#d9d4c7] dark:border-[#3d3830] pl-4 italic my-4 text-[#6b6358] dark:text-[#9a9080]">{children}</blockquote>,
      strong: ({ children }: any) => <strong className="font-semibold text-[#2a2620] dark:text-[#e8e3d8]">{children}</strong>,
    }),
    [renderWithCitations]
  );

  return { renderWithCitations, components };
}
