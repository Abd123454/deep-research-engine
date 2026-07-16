"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { X, Copy, Check, Code2, FileText, Globe } from "lucide-react";
import ReactMarkdown from "react-markdown";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/export/ExportMenu";
import type { Artifact } from "@/lib/artifact-detector";

interface ArtifactsPanelProps {
  artifact: Artifact;
  onClose: () => void;
}

export const ArtifactsPanel = React.memo(function ArtifactsPanel({ artifact, onClose }: ArtifactsPanelProps) {
  const [copied, setCopied] = React.useState(false);

  // Sanitize SVG content to prevent XSS attacks.
  // The LLM can generate SVG with <script> or onload="..." handlers.
  // DOMPurify strips dangerous tags and attributes while preserving
  // safe SVG elements (paths, circles, text, etc.).
  const sanitizedSvg = React.useMemo(() => {
    if (artifact.type !== "svg") return artifact.content;
    if (typeof window === "undefined") return artifact.content; // SSR safety
    return DOMPurify.sanitize(artifact.content, {
      USE_PROFILES: { svg: true, html: true },
      ADD_TAGS: ["svg", "path", "circle", "rect", "line", "text", "g", "polyline", "polygon", "ellipse", "defs", "use", "linearGradient", "radialGradient", "stop"],
      FORBID_TAGS: ["script", "object", "embed", "iframe", "link", "style"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur", "onchange", "onsubmit"],
    });
  }, [artifact.content, artifact.type]);

  function copyContent() {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="hidden lg:flex flex-col w-[40%] min-w-[400px] max-w-[600px] border-l border-border bg-background"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-secondary to-background">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
          <TypeIcon className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium truncate">{artifact.title || "Artifact"}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{artifact.type}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={copyContent} className="h-7 w-7" aria-label="Copy">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          {(artifact.type === "research_report" || artifact.type === "markdown") && (
            <ExportMenu content={artifact.content} filename={artifact.title || "artifact"} />
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7" aria-label="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {(artifact.type === "html" || artifact.type === "react") && (
          <iframe
            sandbox="allow-scripts"
            srcDoc={artifact.type === "react" ? wrapReact(artifact.content) : artifact.content}
            className="w-full h-full border-0 min-h-[400px]"
            title={artifact.title || "Preview"}
          />
        )}

        {artifact.type === "svg" && (
          <div className="p-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
        )}

        {artifact.type === "mermaid" && (
          <MermaidRenderer content={artifact.content} />
        )}

        {artifact.type === "code" && (
          <pre className="p-4 text-sm font-mono overflow-x-auto bg-muted/30">
            <code>{artifact.content}</code>
          </pre>
        )}

        {(artifact.type === "research_report" || artifact.type === "markdown") && (
          <article className="p-5 prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown>{artifact.content}</ReactMarkdown>
          </article>
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
        <p className="text-sm text-destructive mb-2">Mermaid render error:</p>
        <pre className="text-xs text-muted-foreground bg-muted p-2 rounded">{content}</pre>
      </div>
    );
  }

  return (
    <div className="p-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: svg || "<p>Loading diagram...</p>" }} />
  );
}
