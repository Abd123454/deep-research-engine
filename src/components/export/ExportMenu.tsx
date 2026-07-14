"use client";

// ExportMenu — dropdown for exporting content as PDF / DOCX / MD.
//
// Calls POST /api/export with the markdown content and format, then
// triggers a browser download of the returned file.

import * as React from "react";
import { Download, FileText, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/locale-provider";
import type { ExportFormat } from "@/lib/export";

interface ExportMenuProps {
  content: string; // markdown
  filename?: string;
  className?: string;
}

export function ExportMenu({ content, filename, className }: ExportMenuProps) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState<ExportFormat | null>(null);
  const [error, setError] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function doExport(format: ExportFormat) {
    setExporting(format);
    setError("");
    setOpen(false);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, format, filename }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Export failed (HTTP ${res.status})`);
        return;
      }
      // Trigger download.
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const nameMatch = disposition.match(/filename="(.+?)"/);
      const downloadName = nameMatch?.[1] || `${filename || "report"}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  const formats: { key: ExportFormat; labelKey: "exportPdf" | "exportDocx" | "exportMd" }[] = [
    { key: "pdf", labelKey: "exportPdf" },
    { key: "docx", labelKey: "exportDocx" },
    { key: "md", labelKey: "exportMd" },
  ];

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={exporting !== null}
        className="h-7 gap-1 text-xs"
        aria-label={t("exportAs")}
        aria-expanded={open}
      >
        {exporting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Download className="h-3 w-3" />
        )}
        <span className="hidden sm:inline">{exporting ? t("exporting") : t("export")}</span>
        <ChevronDown className="h-3 w-3" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border bg-background shadow-lg py-1 min-w-[160px]">
          {formats.map((f) => (
            <button
              key={f.key}
              onClick={() => doExport(f.key)}
              disabled={exporting !== null}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent disabled:opacity-50 text-left"
            >
              <FileText className="h-3 w-3 text-muted-foreground" />
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="absolute top-full right-0 mt-1 text-[10px] text-destructive whitespace-nowrap">
          {error}
        </p>
      )}
    </div>
  );
}
