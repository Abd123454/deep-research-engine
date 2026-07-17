"use client";
import * as Sentry from "@sentry/nextjs";

// DocumentCard — document upload + Q&A in a single card.
// Used in the unified interface when the user attaches a file and asks a question.

import * as React from "react";
import { motion } from "framer-motion";
import { FileText, Loader2, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/locale-provider";
import { ExportMenu } from "@/components/export/ExportMenu";
import { CompassLogo } from "@/components/CompassLogo";
import type { QAMode } from "@/lib/document-qa";

interface DocumentCardProps {
  file: File;
  initialQuestion?: string;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function DocumentCardImpl({ file, initialQuestion }: DocumentCardProps) {
  const t = useT();
  const [documentId, setDocumentId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(true);
  const [uploadError, setUploadError] = React.useState("");
  const [textLength, setTextLength] = React.useState(0);
  const [, setPreview] = React.useState("");

  // Q&A state
  const [question, setQuestion] = React.useState(initialQuestion || "");
  const [answer, setAnswer] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [tokens, setTokens] = React.useState(0);
  const [qaError, setQaError] = React.useState("");

  // Upload on mount.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setUploadError(data.error || `Upload failed (${res.status})`);
          return;
        }
        setDocumentId(data.documentId);
        setTextLength(data.textLength);
        setPreview(data.preview || "");
      } catch (err) {
        if (!cancelled) setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        if (!cancelled) setUploading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-ask if initial question provided.
  React.useEffect(() => {
    if (documentId && initialQuestion && !streaming && !answer) {
      sendQA(initialQuestion, "qa");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function sendQA(q: string, mode: QAMode) {
    if (!documentId || streaming) return;
    if (mode === "qa" && !q.trim()) return;
    setStreaming(true);
    setAnswer("");
    setTokens(0);
    setQaError("");
    try {
      const res = await fetch(`/api/documents/${documentId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: mode === "qa" ? q : "", mode }),
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
      setQaError(err instanceof Error ? err.message : "Q&A failed");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-[#d9d4c7] dark:border-[#3d3830] overflow-hidden bg-[#faf8f3] dark:bg-[#1c1a17]"
    >
      {/* Document header */}
      <div className="bg-[#faf8f3] dark:bg-[#1c1a17] px-5 py-3 border-b border-[#d9d4c7] dark:border-[#3d3830] flex items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-[#8b4513]" />
        <span className="text-sm font-medium truncate flex-1 text-[#2a2620] dark:text-[#e8e3d8]">{file.name}</span>
        <span className="text-[10px] text-[#6b6358] shrink-0">{fmtSize(file.size)}</span>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Upload status */}
        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-[#6b6358] dark:text-[#9a9080]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("uploading")}
          </div>
        ) : uploadError ? (
          <p className="text-sm text-[#a33a3a]">{uploadError}</p>
        ) : (
          <>
            <p className="text-[10px] text-[#6b6358]">
              {textLength.toLocaleString()} chars extracted
            </p>

            {/* Question input (if no initial question or for follow-up) */}
            {!answer && !streaming && (
              <div className="rounded-xl bg-[#d9d4c7] dark:bg-[#322e28]">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t("askPlaceholder")}
                  className="min-h-[50px] resize-none border-0 bg-transparent px-4 pt-3 pb-1 text-sm font-body text-[16px] focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[#6b6358]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendQA(question, "qa");
                  }}
                />
                <div className="flex items-center justify-between px-3 pb-2 pt-1">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendQA("", "summarize")}
                      className="h-7 text-xs"
                    >
                      {t("summarizeBtn")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendQA("", "questions")}
                      className="h-7 text-xs"
                    >
                      {t("suggestQuestionsBtn")}
                    </Button>
                  </div>
                  <Button
                    onClick={() => sendQA(question, "qa")}
                    disabled={!question.trim() || streaming}
                    size="icon"
                    className="h-7 w-7 rounded-full bg-[#8b4513] hover:bg-[#6b3410] dark:bg-[#b5673a] dark:hover:bg-[#8b4513] border-0 text-[#faf8f3] hover:text-[#faf8f3]"
                    aria-label={t("quickSend")}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Error */}
            {qaError && (
              <p className="text-sm text-[#a33a3a]">{qaError}</p>
            )}

            {/* Answer */}
            {(answer || streaming) && (
              <div className="rounded-xl border border-[#d9d4c7] dark:border-[#3d3830] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CompassLogo className="h-3.5 w-3.5 text-[#8b4513]" />
                  <span className="text-xs font-semibold text-[#6b6358] dark:text-[#9a9080]">
                    {streaming ? t("quickThinking") : t("answer")}
                  </span>
                  {streaming && (
                    <span className="inline-block h-3 w-1.5 bg-[#8b4513] animate-pulse ml-0.5" />
                  )}
                  {!streaming && answer && (
                    <div className="ml-auto">
                      <ExportMenu content={answer} filename={`${file.name.replace(/\.[^.]+$/, "")}-answer`} />
                    </div>
                  )}
                </div>
                {answer ? (
                  <article className="prose prose-quaesitor font-body leading-[1.7] max-w-none dark:prose-invert">
                    <ReactMarkdown>{answer}</ReactMarkdown>
                  </article>
                ) : (
                  !qaError && (
                    <div className="flex items-center gap-2 text-sm text-[#6b6358] dark:text-[#9a9080]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("quickThinking")}
                    </div>
                  )
                )}
                {!streaming && tokens > 0 && (
                  <p className="text-[10px] text-[#6b6358] mt-3 font-mono">~{tokens} tokens</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

export const DocumentCard = React.memo(DocumentCardImpl);
