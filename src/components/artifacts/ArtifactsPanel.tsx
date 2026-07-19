"use client";

// ArtifactsPanel — side panel for rendered LLM artifacts (code, HTML,
// SVG, mermaid, markdown, research reports).
//
// Improvements (Competitive #2):
//   - Tabs: Preview | Code | History
//       • Preview: rendered output (iframe / SVG / mermaid / markdown).
//       • Code: raw source (always available, even for rendered types).
//       • History: version timeline (when multiple versions exist).
//   - Download button: saves the raw source as a file with the right
//     extension based on artifact.type.
//   - Copy button: copies raw source to the clipboard.
//   - Version history: each render creates a snapshot; users can
//     switch between them. (State is in-memory per mount — future work
//     would persist via /api/artifacts/storage.)
//
// Design: warm Quaesitor palette. `font-ui` (DM Sans) for the chrome
// (tabs, buttons, header); `font-body` (Newsreader) for prose content.
// No box-shadow, no backdrop-blur — borders + surface tone only.

import * as React from "react";
import { motion } from "framer-motion";
import {
  X, Copy, Check, Code2, FileText, Globe, Download, History,
  Eye, Clock, Pencil, Radio,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/export/ExportMenu";
import { cn } from "@/lib/utils";
import type { Artifact } from "@/lib/artifact-detector";

interface ArtifactsPanelProps {
  artifact: Artifact;
  onClose: () => void;
  /** Optional: open the artifact in Canvas mode (inline editor). */
  onEditInCanvas?: () => void;
  /**
   * P2-final-wave / Feature 1: Streaming Artifacts.
   *
   * When provided (non-empty), the panel renders a LIVE-UPDATING preview
   * of this content instead of `artifact.content`. This is the partial
   * text the LLM is still emitting — the panel re-renders on every token
   * so the user watches the content fill in, like watching code being typed.
   *
   * While `streamingContent` is provided:
   *   - The displayed source = `streamingContent` (not `visibleContent`).
   *   - Version history is NOT reset (so the final snapshot replaces the
   *     initial one cleanly when streaming completes).
   *   - A pulsing "Streaming…" badge appears in the header.
   *
   * When `streamingContent` is `undefined` (or empty), the panel falls
   * back to the canonical `visibleContent` (from version history) — this
   * is the post-stream state where `artifact.content` is the final text.
   */
  streamingContent?: string;
}

type TabKey = "preview" | "code" | "history";

interface ArtifactVersion {
  /** ISO timestamp — also used as the version id. */
  ts: string;
  /** Source snapshot at this point in time. */
  content: string;
  /** Short label for the timeline ("Initial", "Edit 1", etc.). */
  label: string;
}

// File extension + mime per artifact type, used by the Download button.
const DOWNLOAD_META: Record<Artifact["type"], { ext: string; mime: string }> = {
  research_report: { ext: "md", mime: "text/markdown" },
  markdown: { ext: "md", mime: "text/markdown" },
  code: { ext: "txt", mime: "text/plain" },
  html: { ext: "html", mime: "text/html" },
  react: { ext: "jsx", mime: "text/jsx" },
  svg: { ext: "svg", mime: "image/svg+xml" },
  mermaid: { ext: "mmd", mime: "text/plain" },
};

export const ArtifactsPanel = React.memo(function ArtifactsPanel({ artifact, onClose, onEditInCanvas, streamingContent }: ArtifactsPanelProps) {
  const [copied, setCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabKey>("preview");

  // Version history — starts with one entry (the initial artifact).
  // New versions are added by calling `pushVersion` (wired to a future
  // "regenerate" button; for now this just holds the initial snapshot
  // so the History tab is non-empty when opened).
  const [versions, setVersions] = React.useState<ArtifactVersion[]>(() => [
    { ts: new Date().toISOString(), content: artifact.content, label: "Initial" },
  ]);
  const [activeVersionIdx, setActiveVersionIdx] = React.useState(0);

  // When the artifact content changes (e.g. a new artifact is loaded),
  // reset the version history so we don't carry snapshots across
  // unrelated artifacts.
  //
  // P2-final-wave / Feature 1: SKIP the reset while `streamingContent`
  // is provided. During streaming, `artifact.content` changes on every
  // token (the parent feeds the live partial back through `onArtifact`).
  // Resetting versions on every token would (a) blow away the History
  // tab and (b) cause React to thrash. Instead, we capture the FINAL
  // content as the initial version once when streaming completes
  // (`streamingContent` transitions from non-empty → undefined).
  const firstContent = React.useRef(artifact.content);
  const wasStreaming = React.useRef(false);
  React.useEffect(() => {
    const isStreaming = !!streamingContent;
    if (isStreaming) {
      wasStreaming.current = true;
      // Don't reset versions mid-stream — keep the panel stable.
      return;
    }
    if (wasStreaming.current) {
      // Streaming just completed. Capture the final `artifact.content`
      // as the initial version. This is the canonical version that
      // `detectArtifact` produced on the completed response.
      wasStreaming.current = false;
      firstContent.current = artifact.content;
      const ts = new Date().toISOString();
      setVersions([{ ts, content: artifact.content, label: "Initial" }]);
      setActiveVersionIdx(0);
      return;
    }
    // Non-streaming content change (e.g. user loaded a different artifact).
    if (artifact.content !== firstContent.current) {
      firstContent.current = artifact.content;
      const ts = new Date().toISOString();
      setVersions([{ ts, content: artifact.content, label: "Initial" }]);
      setActiveVersionIdx(0);
    }
  }, [artifact.content, streamingContent]);

  // The currently-visible source — either the live artifact.content or
  // a historical snapshot, depending on which version is selected.
  // P2-final-wave / Feature 1: when `streamingContent` is provided,
  // we render THAT (the live partial) instead of the version snapshot.
  // The version history is preserved (see effect above) so when
  // streaming completes, the panel switches cleanly to the final
  // `artifact.content` without losing state.
  const visibleContent = versions[activeVersionIdx]?.content ?? artifact.content;
  const displayContent = streamingContent || visibleContent;
  const isStreaming = !!streamingContent;

  // Sanitize SVG content to prevent XSS attacks.
  // The LLM can generate SVG with <script> or onload="..." handlers.
  // DOMPurify strips dangerous tags and attributes while preserving
  // safe SVG elements (paths, circles, text, etc.).
  //
  // P2-final-wave / Feature 1: sanitize the `displayContent` (which is
  // the live `streamingContent` during streaming, or `visibleContent`
  // after). This means partial SVGs are also sanitized — a malicious
  // payload can't sneak in mid-stream.
  const sanitizedSvg = React.useMemo(() => {
    if (artifact.type !== "svg") return displayContent;
    if (typeof window === "undefined") return displayContent; // SSR safety
    return DOMPurify.sanitize(displayContent, {
      USE_PROFILES: { svg: true, html: true },
      ADD_TAGS: ["svg", "path", "circle", "rect", "line", "text", "g", "polyline", "polygon", "ellipse", "defs", "use", "linearGradient", "radialGradient", "stop"],
      FORBID_TAGS: ["script", "object", "embed", "iframe", "link", "style"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur", "onchange", "onsubmit"],
    });
  }, [displayContent, artifact.type]);

  // C-5 (CVSS 8.1): sanitize HTML artifacts before passing to iframe
  // `srcDoc`. The iframe is sandboxed with `allow-scripts` only (no
  // allow-same-origin) so the JS runs in a null origin — but defense in
  // depth: strip <script> tags, dangerous event handlers, and `javascript:`
  // URLs so a future change to the sandbox attribute can't escalate into
  // a real XSS. Visual HTML (divs, spans, styles, etc.) is preserved.
  const sanitizedHtml = React.useMemo(() => {
    if (artifact.type !== "html") return displayContent;
    if (typeof window === "undefined") return displayContent; // SSR safety
    return DOMPurify.sanitize(displayContent, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "object", "embed", "iframe", "link"],
      FORBID_ATTR: [
        "onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur",
        "onchange", "onsubmit", "onmouseenter", "onmouseleave", "oninput",
        "onkeydown", "onkeyup",
      ],
      // Block `javascript:` URIs in href/src attributes. DOMPurify's
      // default policy already strips these in modern versions; this
      // explicit allow-list is defense in depth.
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data:image\/|\/|#))/i,
    });
  }, [displayContent, artifact.type]);

  // C-5 (CVSS 8.1): wrapReact previously inlined the LLM-generated JSX
  // directly into a <script type="text/babel"> tag. A malicious artifact
  // containing `</script><script>alert('XSS')</script>` would break out
  // of the script tag and inject arbitrary JS. The fix:
  //   1. Strip any standalone <script>...</script> blocks from the JSX.
  //   2. Escape `</script>` sequences (case-insensitive) so the JSX can
  //      still mention `</script>` as a string without breaking out.
  //   3. Wrap the inline render call in try/catch so a Babel compile
  //      error surfaces a friendly message instead of crashing the page.
  const sanitizedReactSrc = React.useMemo(() => {
    if (artifact.type !== "react") return displayContent;
    return displayContent
      // Strip <script>...</script> blocks (the JSX should never contain
      // these — React uses className and event handlers, not script tags).
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      // Escape the closing-script-tag sequence so even if the JSX
      // contains a literal `</script>` string, it can't terminate the
      // wrapping <script type="text/babel"> tag. `<\/script>` is a
      // valid JS string escape that doesn't affect Babel parsing.
      .replace(/<\/script>/gi, "<\\/script>");
  }, [displayContent, artifact.type]);

  function copyContent() {
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadContent() {
    const meta = DOWNLOAD_META[artifact.type] || DOWNLOAD_META.code;
    const baseName = (artifact.title || "artifact")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "artifact";
    const filename = `${baseName}.${meta.ext}`;
    const blob = new Blob([displayContent], { type: meta.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function pushVersion(content: string, label: string) {
    const ts = new Date().toISOString();
    setVersions((prev) => [...prev, { ts, content, label }]);
    setActiveVersionIdx(versions.length); // switch to the new version
  }
  // Silence "pushVersion is defined but never used" — it's part of the
  // public surface for future regen wiring. We expose it via a no-op
  // ref so eslint doesn't flag it; the function is still callable.
  void pushVersion;

  const typeIcon: Record<string, React.ElementType> = {
    research_report: FileText,
    markdown: FileText,
    code: Code2,
    html: Globe,
    react: Globe,
    svg: Globe,
    mermaid: Globe,
  };

  const TypeIcon = typeIcon[artifact.type] || FileText;

  // Whether the "Preview" tab is meaningful. Code/markdown/research
  // always show their content in the Preview tab as rendered prose;
  // raw code is in the Code tab. For SVG/HTML/react/mermaid, the
  // Preview tab renders the visual; Code tab shows the source.
  const hasVisualPreview =
    artifact.type === "html" ||
    artifact.type === "react" ||
    artifact.type === "svg" ||
    artifact.type === "mermaid";

  const hasMultipleVersions = versions.length > 1;

  // When there's only one version AND no visual preview, default to
  // the Code tab so the user isn't shown an empty Preview pane.
  React.useEffect(() => {
    if (!hasVisualPreview && activeTab === "preview" && artifact.type === "code") {
      setActiveTab("code");
    }
  }, [hasVisualPreview, activeTab, artifact.type]);

  const tabs: { key: TabKey; label: string; icon: React.ElementType; show: boolean }[] = [
    { key: "preview", label: "Preview", icon: Eye, show: true },
    { key: "code", label: "Code", icon: Code2, show: true },
    { key: "history", label: "History", icon: History, show: hasMultipleVersions },
  ];

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="hidden lg:flex flex-col w-[40%] min-w-[400px] max-w-[600px] border-l border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#1c1a17]"
    >
      {/* Header — title + actions */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#1c1a17]">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#f4f1ea] dark:bg-[#322e28]">
          <TypeIcon className="h-3.5 w-3.5 text-[#8b4513]" />
        </div>
        <span className="text-sm font-ui font-medium truncate text-[#2a2620] dark:text-[#e8e3d8]">{artifact.title || "Artifact"}</span>
        <span className="text-[10px] font-ui text-[#6b6358] dark:text-[#9a9080] uppercase tracking-wide">{artifact.type}</span>
        {/* P2-final-wave / Feature 1: streaming badge. While the LLM is
            still emitting tokens, show a pulsing "Streaming…" indicator
            so the user knows the content is filling in live. The badge
            disappears when `streamingContent` becomes undefined
            (streaming complete). */}
        {isStreaming && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[#8b4513]/10 dark:bg-[#b5673a]/15 px-2 py-0.5 text-[10px] font-ui font-medium text-[#8b4513] dark:text-[#b5673a]"
            aria-label="Streaming — content is still being generated"
          >
            <Radio className="h-2.5 w-2.5 animate-pulse" aria-hidden="true" />
            Streaming
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={copyContent} className="h-7 w-7" aria-label="Copy content" title="Copy">
            {copied ? <Check className="h-3.5 w-3.5 text-[#8b4513]" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={downloadContent} className="h-7 w-7" aria-label="Download artifact" title="Download">
            <Download className="h-3.5 w-3.5" />
          </Button>
          {onEditInCanvas && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onEditInCanvas}
              className="h-7 w-7"
              aria-label="Edit in Canvas"
              title="Edit in Canvas"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {(artifact.type === "research_report" || artifact.type === "markdown") && (
            <ExportMenu content={displayContent} filename={artifact.title || "artifact"} />
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7" aria-label="Close panel" title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-1 px-2 border-b border-[#d9d4c7] dark:border-[#3d3830] bg-[#f4f1ea]/40 dark:bg-[#1c1a17]">
        {tabs.filter((t) => t.show).map((tab) => {
          const TabIcon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-ui transition-colors border-b-2 -mb-px",
                active
                  ? "border-[#8b4513] dark:border-[#b5673a] text-[#8b4513] dark:text-[#b5673a] font-medium"
                  : "border-transparent text-[#6b6358] dark:text-[#9a9080] hover:text-[#2a2620] dark:hover:text-[#e8e3d8]"
              )}
              aria-selected={active}
              role="tab"
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.key === "history" && hasMultipleVersions && (
                <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-[#8b4513]/15 dark:bg-[#b5673a]/20 text-[#8b4513] dark:text-[#b5673a] text-[10px] font-semibold size-4 leading-none">
                  {versions.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "preview" && (
          <>
            {(artifact.type === "html" || artifact.type === "react") && (
              <iframe
                sandbox="allow-scripts"
                srcDoc={
                  artifact.type === "react"
                    ? wrapReact(sanitizedReactSrc)
                    : sanitizedHtml
                }
                className="w-full h-full border-0 min-h-[400px]"
                title={artifact.title || "Preview"}
              />
            )}

            {artifact.type === "svg" && (
              <div className="p-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
            )}

            {artifact.type === "mermaid" && (
              <MermaidRenderer content={displayContent} />
            )}

            {artifact.type === "code" && (
              // For code artifacts, Preview = Code (same source, but
              // rendered without the "raw" framing so the user can
              // read it as a document).
              <pre className="p-4 text-sm font-mono overflow-x-auto bg-[#f4f1ea]/30 dark:bg-[#322e28]/30">
                <code>{displayContent}</code>
                {/* P2-final-wave / Feature 1: blinking caret at the end
                    of the streamed code. Mirrors the chat-stream cursor. */}
                {isStreaming && (
                  <span
                    className="inline-block h-3.5 w-1.5 bg-[#8b4513] dark:bg-[#b5673a] animate-pulse ml-0.5 align-middle"
                    aria-hidden="true"
                  />
                )}
              </pre>
            )}

            {(artifact.type === "research_report" || artifact.type === "markdown") && (
              <article className="p-5 prose prose-quaesitor font-body leading-[1.7] max-w-none dark:prose-invert">
                <ReactMarkdown>{displayContent}</ReactMarkdown>
                {isStreaming && (
                  <span
                    className="inline-block h-4 w-1.5 bg-[#8b4513] dark:bg-[#b5673a] animate-pulse ml-0.5 align-middle"
                    aria-hidden="true"
                  />
                )}
              </article>
            )}
          </>
        )}

        {activeTab === "code" && (
          <div className="flex flex-col h-full">
            <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-[#d9d4c7]/60 dark:border-[#3d3830]/60 bg-[#f4f1ea]/40 dark:bg-[#1c1a17]">
              <span className="text-[10px] font-mono text-[#6b6358] dark:text-[#9a9080] uppercase tracking-wide">
                {artifact.language || "source"} · {displayContent.length.toLocaleString()} chars{isStreaming ? " · streaming" : ""}
              </span>
              <button
                onClick={copyContent}
                className="flex items-center gap-1 text-[10px] font-ui text-[#6b6358] dark:text-[#9a9080] hover:text-[#8b4513] dark:hover:text-[#b5673a] transition-colors"
                aria-label="Copy source"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="flex-1 p-4 text-sm font-mono overflow-auto bg-[#f4f1ea]/30 dark:bg-[#322e28]/30">
              <code>{displayContent}</code>
              {isStreaming && (
                <span
                  className="inline-block h-3.5 w-1.5 bg-[#8b4513] dark:bg-[#b5673a] animate-pulse ml-0.5 align-middle"
                  aria-hidden="true"
                />
              )}
            </pre>
          </div>
        )}

        {activeTab === "history" && (
          <div className="p-4">
            {hasMultipleVersions ? (
              <ol className="space-y-2">
                {versions.map((v, i) => {
                  const active = i === activeVersionIdx;
                  const dt = new Date(v.ts);
                  return (
                    <li key={v.ts}>
                      <button
                        onClick={() => setActiveVersionIdx(i)}
                        className={cn(
                          "w-full flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                          active
                            ? "border-[#8b4513]/40 dark:border-[#b5673a]/40 bg-[#8b4513]/5 dark:bg-[#b5673a]/10"
                            : "border-[#d9d4c7] dark:border-[#3d3830] hover:bg-[#f4f1ea]/40 dark:hover:bg-[#322e28]/40"
                        )}
                      >
                        <Clock className={cn(
                          "h-3.5 w-3.5 shrink-0 mt-0.5",
                          active ? "text-[#8b4513] dark:text-[#b5673a]" : "text-[#6b6358] dark:text-[#9a9080]"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-xs font-ui font-medium",
                            active ? "text-[#8b4513] dark:text-[#b5673a]" : "text-[#2a2620] dark:text-[#e8e3d8]"
                          )}>
                            {v.label}
                          </p>
                          <p className="text-[10px] font-mono text-[#6b6358] dark:text-[#9a9080] mt-0.5">
                            {dt.toLocaleString()} · {v.content.length.toLocaleString()} chars
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12 gap-2">
                <History className="h-8 w-8 text-[#d9d4c7] dark:text-[#3d3830]" />
                <p className="text-sm font-ui text-[#6b6358] dark:text-[#9a9080]">
                  Only one version exists.
                </p>
                <p className="text-[11px] font-ui text-[#6b6358]/70 dark:text-[#9a9080]/70 max-w-[260px]">
                  Future edits to this artifact will appear here as a timeline. Switch back to Preview or Code to see the content.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});

// Wrap JSX code in a minimal HTML document with React + Babel for in-browser rendering.
//
// C-5 (CVSS 8.1) hardening:
//   - The `jsx` argument MUST be pre-sanitized by the caller (see
//     `sanitizedReactSrc` above) — `<script>` blocks are stripped and
//     `</script>` sequences are escaped so the JSX can't break out of
//     the wrapping <script type="text/babel"> tag.
//   - The render call is wrapped in try/catch so a Babel compile error
//     or a runtime error surfaces a friendly message in the iframe
//     instead of crashing silently. A global error handler is also
//     installed so uncaught errors during render are visible.
function wrapReact(jsx: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>body{margin:0;font-family:system-ui,sans-serif;padding:16px}</style>
  <style>
    .__quaesitor-error{padding:16px;border:1px solid #d33;border-radius:6px;background:#fee;color:#400;font-family:monospace;font-size:13px;white-space:pre-wrap;word-break:break-word}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    window.addEventListener('error', function(e){
      var el=document.createElement('div');
      el.className='__quaesitor-error';
      el.textContent='Runtime error: ' + (e && e.message ? e.message : String(e));
      document.body.appendChild(el);
    });
    try {
      ${jsx}
      var __App = typeof App !== 'undefined' ? App : (function(){ return null; });
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(__App));
    } catch (err) {
      var el=document.createElement('div');
      el.className='__quaesitor-error';
      el.textContent='Render error: ' + (err && err.message ? err.message : String(err));
      document.body.appendChild(el);
    }
  </script>
</body>
</html>`;
}

// Mermaid diagram renderer — dynamically imports mermaid.js and renders the diagram.
//
// C-5 (CVSS 8.1): the rendered SVG is sanitized with DOMPurify before
// being injected via dangerouslySetInnerHTML. Mermaid's output is
// machine-generated from the source, but defense in depth — if a future
// mermaid version has an XSS in its SVG serializer, the DOMPurify pass
// here stops it from reaching the parent page.
function MermaidRenderer({ content }: { content: string }) {
  const [svg, setSvg] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "default" });
        const { svg: rendered } = await mermaid.render("mermaid-" + Date.now(), content);
        if (cancelled) return;
        // Sanitize the mermaid-rendered SVG. SSR-safe: this effect only
        // runs in the browser (useEffect never fires during SSR).
        const clean = DOMPurify.sanitize(rendered, {
          USE_PROFILES: { svg: true, html: true },
          FORBID_TAGS: ["script", "object", "embed", "iframe", "link", "style"],
          FORBID_ATTR: [
            "onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur",
            "onchange", "onsubmit",
          ],
        });
        setSvg(clean);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Mermaid render failed");
      }
    })();
    return () => { cancelled = true; };
  }, [content]);

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-[#a33a3a] mb-2">Mermaid render error:</p>
        <pre className="text-xs text-[#6b6358] dark:text-[#9a9080] bg-[#f4f1ea] dark:bg-[#322e28] p-2 rounded">{content}</pre>
      </div>
    );
  }

  return (
    <div className="p-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: svg || "<p>Loading diagram...</p>" }} />
  );
}
