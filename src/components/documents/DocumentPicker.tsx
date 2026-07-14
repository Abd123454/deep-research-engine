"use client";

// DocumentPicker — modal for selecting a document to attach to research.
//
// Fetches the document list from /api/documents. When a document is
// selected, calls onAttach with the document's text prepended as context.
// This is a lightweight integration — the document text is appended to the
// research query so the LLM has it as context during planning/analysis.

import * as React from "react";
import { X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocItem {
  id: string;
  filename: string;
  size: number;
  textLength: number;
  preview: string;
}

interface DocumentPickerProps {
  open: boolean;
  onClose: () => void;
  onAttach: (doc: DocItem) => void;
}

export function DocumentPicker({ open, onClose, onAttach }: DocumentPickerProps) {
  const [docs, setDocs] = React.useState<DocItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingDoc, setLoadingDoc] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => setDocs(data.documents || []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  async function attach(doc: DocItem) {
    setLoadingDoc(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}`);
      if (res.ok) {
        const data = await res.json();
        onAttach({ ...doc, preview: data.document?.text || doc.preview });
      }
    } finally {
      setLoadingDoc(null);
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-2xl border border-border shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Select document"
      >
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          <h3 className="text-sm font-semibold">Attach document</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">
              No documents uploaded yet. Switch to the Documents tab to upload one.
            </p>
          ) : (
            docs.map((d) => (
              <button
                key={d.id}
                onClick={() => attach(d)}
                disabled={loadingDoc !== null}
                className="w-full text-left rounded-lg p-3 hover:bg-accent flex items-start gap-2 disabled:opacity-50"
              >
                {loadingDoc === d.id ? (
                  <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-primary" />
                ) : (
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.filename}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(d.size / 1024).toFixed(0)}KB · {d.textLength.toLocaleString()} chars
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
