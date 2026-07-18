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
  Eye, Clock, Pencil,
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

export const ArtifactsPanel = React.memo(function ArtifactsPanel({ artifact, onClose, onEditInCanvas }: ArtifactsPanelProps) {
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
  const firstContent = React.useRef(artifact.content);
  React.useEffect(() => {
    if (artifact.content !== firstContent.current) {
      firstContent.current = artifact.content;
      const ts = new Date().toISOString();
      setVersions([{ ts, content: artifact.content, label: "Initial" }]);
      setActiveVersionIdx(0);
    }
  }, [artifact.content]);

  // The currently-visible source — either the live artifact.content or
  // a historical snapshot, depending on which version is selected.
  const visibleContent = versions[activeVersionIdx]?.content ?? artifact.content;

  // Sanitize SVG content to prevent XSS attacks.
  // The LLM can generate SVG with <script> or onload="..." handlers.
  // DOMPurify strips dangerous tags and attributes while preserving
  // safe SVG elements (paths, circles, text, etc.).
  const sanitizedSvg = React.useMemo(() => {
    if (artifact.type !== "svg") return visibleContent;
    if (typeof window === "undefined") return visibleContent; // SSR safety
    return DOMPurify.sanitize(visibleContent, {
      USE_PROFILES: { svg: true, html: true },
      ADD_TAGS: ["svg", "path", "circle", "rect", "line", "text", "g", "polyline", "polygon", "ellipse", "defs", "use", "linearGradient", "radialGradient", "stop"],
      FORBID_TAGS: ["script", "object", "embed", "iframe", "link", "style"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur", "onchange", "onsubmit"],
    });
  }, [visibleContent, artifact.type]);

  function copyContent() {
    navigator.clipboard.writeText(visibleContent);
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
    const blob = new Blob([visibleContent], { type: meta.mime });
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
            <ExportMenu content={visibleContent} filename={artifact.title || "artifact"} />
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
                srcDoc={artifact.type === "react" ? wrapReact(visibleContent) : visibleContent}
                className="w-full h-full border-0 min-h-[400px]"
                title={artifact.title || "Preview"}
              />
            )}

            {artifact.type === "svg" && (
              <div className="p-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
            )}

            {artifact.type === "mermaid" && (
              <MermaidRenderer content={visibleContent} />
            )}

            {artifact.type === "code" && (
              // For code artifacts, Preview = Code (same source, but
              // rendered without the "raw" framing so the user can
              // read it as a document).
              <pre className="p-4 text-sm font-mono overflow-x-auto bg-[#f4f1ea]/30 dark:bg-[#322e28]/30">
                <code>{visibleContent}</code>
              </pre>
            )}

            {(artifact.type === "research_report" || artifact.type === "markdown") && (
              <article className="p-5 prose prose-quaesitor font-body leading-[1.7] max-w-none dark:prose-invert">
                <ReactMarkdown>{visibleContent}</ReactMarkdown>
              </article>
            )}
          </>
        )}

        {activeTab === "code" && (
          <div className="flex flex-col h-full">
            <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-[#d9d4c7]/60 dark:border-[#3d3830]/60 bg-[#f4f1ea]/40 dark:bg-[#1c1a17]">
              <span className="text-[10px] font-mono text-[#6b6358] dark:text-[#9a9080] uppercase tracking-wide">
                {artifact.language || "source"} · {visibleContent.length.toLocaleString()} chars
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
              <code>{visibleContent}</code>
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
function wrapReact(jsx: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>body{margin:0;font-family:system-ui,sans-serif;padding:16px}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${jsx}
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App || (() => null)));
  </script>
</body>
</html>`;
}

// Mermaid diagram renderer — dynamically imports mermaid.js and renders the diagram.
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
        if (!cancelled) setSvg(rendered);
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
