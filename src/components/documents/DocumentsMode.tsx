"use client";
import * as Sentry from "@sentry/nextjs";

// DocumentsMode — document upload + Q&A interface.
//
// Two-panel layout:
//   Left (1/3): upload zone + document list
//   Right (2/3): selected document + Q&A interface (ask/summarize/questions)

import * as React from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Trash2, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/locale-provider";
import { ExportMenu } from "@/components/export/ExportMenu";
import type { QAMode } from "@/lib/document-qa";

interface DocListItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  textLength: number;
  preview: string;
  uploadedAt: number;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function DocumentsMode() {
  const t = useT();
  const [docs, setDocs] = React.useState<DocListItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Q&A state
  const [qaMode, setQaMode] = React.useState<QAMode>("qa");
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [tokens, setTokens] = React.useState(0);
  const [qaError, setQaError] = React.useState("");
  const [previewExpanded, setPreviewExpanded] = React.useState(false);

  // Load document list on mount.
  const loadDocs = React.useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents || []);
      }
    } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* ignore — non-critical */
    
}
  }, []);

  React.useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const selectedDoc = docs.find((d) => d.id === selectedId);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || `Upload failed (HTTP ${res.status})`);
        return;
      }
      await loadDocs();
      setSelectedId(data.documentId);
      // Reset Q&A for the new document.
      setAnswer("");
      setQuestion("");
      setTokens(0);
      setQaError("");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (selectedId === id) {
        setSelectedId(null);
        setAnswer("");
      }
      await loadDocs();
    } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* ignore */
    
}
  }

  async function sendQA() {
    if (!selectedId || streaming) return;
    if (qaMode === "qa" && !question.trim()) return;

    setStreaming(true);
    setAnswer("");
    setTokens(0);
    setQaError("");

    try {
      const res = await fetch(`/api/documents/${selectedId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: qaMode === "qa" ? question : "",
          mode: qaMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setQaError(data.error || `HTTP ${res.status}`);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6)) as {
                token?: string;
                done?: boolean;
                tokensUsed?: number;
                error?: string;
              };
              if (data.token) setAnswer((a) => a + data.token);
              if (data.done && data.tokensUsed) setTokens(data.tokensUsed);
              if (data.error) setQaError(data.error);
            } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* skip */
            
}
          }
        }
      }
    } catch (err) {
      setQaError(err instanceof Error ? err.message : "Q&A request failed.");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
        {t("documentsPlaceholder")}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left panel: upload + list */}
        <div className="space-y-3">
          {/* Upload zone */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label={t("uploadDocument")}
            className="w-full rounded-2xl border-2 border-dashed border-border/60 p-6 text-center transition-colors hover:border-primary/40 hover:bg-accent/30 disabled:opacity-50"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">{t("uploading")}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium">{t("dragDrop")}</span>
                <span className="text-xs text-muted-foreground">{t("orBrowse")}</span>
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          {uploadError && (
            <p className="text-xs text-destructive px-1">{uploadError}</p>
          )}
          <p className="text-[10px] text-muted-foreground/60 px-1">{t("uploadHint")}</p>

          {/* Document list */}
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {docs.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-4">
                {t("noDocuments")}
              </p>
            ) : (
              docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setSelectedId(d.id);
                    setAnswer("");
                    setQuestion("");
                    setQaError("");
                  }}
                  className={cn(
                    "w-full text-left rounded-lg p-2.5 transition-colors group flex items-start gap-2",
                    selectedId === d.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-accent border border-transparent"
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{d.filename}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {fmtSize(d.size)} · {d.textLength.toLocaleString()} chars
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(d.id, e)}
                    aria-label={`Delete ${d.filename}`}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel: Q&A */}
        <div className="md:col-span-2">
          {!selectedDoc ? (
            <div className="rounded-2xl border border-border/40 p-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">{t("selectDocument")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("selectDocumentHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Document header + preview */}
              <div className="rounded-xl border border-border/40 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium truncate">{selectedDoc.filename}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                    {fmtSize(selectedDoc.size)}
                  </span>
                </div>
                <button
                  onClick={() => setPreviewExpanded((v) => !v)}
                  className="text-xs text-primary hover:underline"
                >
                  {t("documentPreview")} {previewExpanded ? "−" : "+"}
                </button>
                {previewExpanded && (
                  <p className="mt-2 text-xs text-muted-foreground max-h-40 overflow-y-auto whitespace-pre-wrap font-mono bg-muted/30 p-2 rounded">
                    {selectedDoc.preview}
                    {selectedDoc.textLength > 500 && "..."}
                  </p>
                )}
              </div>

              {/* Mode tabs */}
              <div className="flex gap-1.5">
                {(["qa", "summarize", "questions"] as QAMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setQaMode(m);
                      setAnswer("");
                      setQaError("");
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      qaMode === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m === "qa"
                      ? t("askMode")
                      : m === "summarize"
                        ? t("summarizeMode")
                        : t("questionsMode")}
                  </button>
                ))}
              </div>

              {/* Question input (only for qa mode) */}
              {qaMode === "qa" && (
                <div className="rounded-2xl bg-secondary shadow-sm focus-within:shadow-md transition-shadow">
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={t("askPlaceholder")}
                    className="min-h-[60px] resize-none border-0 bg-transparent px-5 pt-4 pb-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendQA();
                    }}
                  />
                  <div className="flex items-center justify-between px-3 pb-3 pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:block">
                      ⌘+Enter
                    </span>
                    <Button
                      onClick={sendQA}
                      disabled={!question.trim() || streaming}
                      size="icon"
                      className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 border-0"
                      aria-label={t("quickSend")}
                    >
                      {streaming ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Action button for summarize/questions modes */}
              {(qaMode === "summarize" || qaMode === "questions") && (
                <Button
                  onClick={sendQA}
                  disabled={streaming}
                  className="gap-2"
                  size="sm"
                >
                  {streaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {qaMode === "summarize" ? t("summarizeBtn") : t("suggestQuestionsBtn")}
                </Button>
              )}

              {/* Error */}
              {qaError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {qaError}
                </div>
              )}

              {/* Answer */}
              {(answer || streaming) && (
                <div className="rounded-2xl border border-border/60 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">
                      {streaming ? t("quickThinking") : t("answer")}
                    </span>
                    {streaming && (
                      <span className="inline-block h-3 w-1.5 bg-primary animate-pulse ml-0.5" />
                    )}
                    {!streaming && answer && (
                      <div className="ml-auto">
                        <ExportMenu
                          content={answer}
                          filename={`${selectedDoc.filename.replace(/\.[^.]+$/, "")}-answer`}
                        />
                      </div>
                    )}
                  </div>
                  {answer ? (
                    <article className="prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                      <ReactMarkdown>{answer}</ReactMarkdown>
                    </article>
                  ) : (
                    !qaError && (
                      <p className="text-muted-foreground text-sm italic">
                        {t("quickThinking")}
                      </p>
                    )
                  )}
                  {!streaming && tokens > 0 && (
                    <p className="text-[11px] text-muted-foreground/50 mt-4 font-mono">
                      ~{tokens} tokens
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
