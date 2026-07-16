"use client";

// UnifiedInput — the single input bar at the bottom of the unified interface.
//
// Features:
// - Auto-resizing textarea
// - 📎 attach button (file picker)
// - Mode dropdown (Auto / Research / Quick)
// - Send button
// - Attached files shown as chips
// - Cmd+Enter to send
//
// Auto-detect logic (when mode = Auto):
// - Files attached → Document Q&A (handled by parent)
// - Text starts with "research:" or "ابحث" → Research
// - Text length > 200 chars → Research (likely a brief)
// - Otherwise → Quick

import * as React from "react";
import { Paperclip, X, ArrowRight, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type InputMode = "auto" | "research" | "quick" | "chat" | "swarm";

export interface AttachedFile {
  id: string;
  file: File;
}

interface UnifiedInputProps {
  onSend: (text: string, files: AttachedFile[], mode: InputMode) => void;
  disabled?: boolean;
  value?: string;
  onValueChange?: (v: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function UnifiedInput({ onSend, disabled, value, onValueChange, textareaRef: externalRef }: UnifiedInputProps) {
  const t = useT();
  const [internalText, setInternalText] = React.useState("");
  const text = value !== undefined ? value : internalText;
  const setText = (v: string) => {
    if (onValueChange) onValueChange(v);
    else setInternalText(v);
  };  const [files, setFiles] = React.useState<AttachedFile[]>([]);
  const [mode, setMode] = React.useState<InputMode>("auto");
  const [modeOpen, setModeOpen] = React.useState(false);
  const [error, setError] = React.useState("");
  const internalTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || internalTextareaRef;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const modeRef = React.useRef<HTMLDivElement>(null);

  // Auto-resize textarea.
  React.useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [text, textareaRef]);

  // Close mode dropdown on outside click.
  React.useEffect(() => {
    if (!modeOpen) return;
    function handler(e: MouseEvent) {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modeOpen]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const selected = Array.from(e.target.files || []);
    for (const f of selected) {
      if (f.size > MAX_FILE_SIZE) {
        setError(`File too large: ${f.name} (max 50MB)`);
        continue;
      }
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError(`Unsupported type: ${f.name}`);
        continue;
      }
      setFiles((prev) => [
        ...prev,
        { id: crypto.randomUUID(), file: f },
      ]);
    }
    e.target.value = "";
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleSend() {
    if (!text.trim() && files.length === 0) return;
    if (disabled) return;
    onSend(text.trim(), files, mode);
    setText("");
    setFiles([]);
    setError("");
  }

  const modeLabel = mode === "auto" ? "Auto" : mode === "research" ? t("modeResearch") : mode === "chat" ? "Chat" : mode === "swarm" ? "Swarm" : t("modeQuick");

  return (
    <div className="shrink-0 z-30 border-t border-border/40 bg-background/80 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3">
        {/* Attached files */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {files.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1"
              >
                <Paperclip className="h-3 w-3" />
                {f.file.name}
                <button
                  onClick={() => removeFile(f.id)}
                  aria-label={`Remove ${f.file.name}`}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-destructive mb-2">{error}</p>}

        {/* Input row — premium visible container */}
        <div className="flex items-center gap-1.5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-primary/50 transition-all p-1.5">
          {/* Attach button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t("uploadDocument")}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
            onChange={handleFileSelect}
          />

          {/* Textarea — transparent inside the visible container */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("quickPlaceholder")}
            rows={1}
            className="flex-1 resize-none bg-transparent border-0 ring-0 focus:ring-0 focus:outline-none text-sm leading-relaxed placeholder:text-muted-foreground/60 py-3 min-h-[48px] max-h-[200px] px-2"
            style={{ boxShadow: "none", minHeight: "48px" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          {/* Mode dropdown */}
          <div ref={modeRef} className="relative shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModeOpen((v) => !v)}
              className="h-9 gap-1 text-xs text-muted-foreground hover:text-foreground"
              aria-label="Mode"
              aria-expanded={modeOpen}
            >
              {modeLabel}
              <ChevronDown className="h-3 w-3" />
            </Button>
            {modeOpen && (
              <div className="absolute bottom-full right-0 mb-1 z-20 rounded-lg border border-border bg-background shadow-lg py-1 min-w-[120px]">
                {([
                  { key: "auto", label: "Auto" },
                  { key: "research", label: t("modeResearch") },
                  { key: "chat", label: "Chat" },
                  { key: "swarm", label: "Swarm" },
                  { key: "quick", label: t("modeQuick") },
                ] as { key: InputMode; label: string }[]).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => {
                      setMode(m.key);
                      setModeOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center px-3 py-2 text-xs hover:bg-accent text-left",
                      mode === m.key && "text-primary font-medium"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={disabled || (!text.trim() && files.length === 0)}
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full bg-primary hover:bg-primary/90 border-0"
            aria-label={t("quickSend")}
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Auto-detect the card type from the user's input.
export function detectCardType(
  text: string,
  hasFiles: boolean,
  mode: InputMode
): "research" | "quick" | "document" | "chat" | "swarm" {
  if (hasFiles) return "document";
  if (mode === "research") return "research";
  if (mode === "quick") return "quick";
  if (mode === "chat") return "chat";
  if (mode === "swarm") return "swarm";
  // Auto mode: default to chat (multi-turn conversation).
  const lower = text.toLowerCase().trim();
  if (lower.startsWith("research:") || lower.startsWith("ابحث")) return "research";
  if (lower.startsWith("swarm:") || lower.startsWith("سوارم:")) return "swarm";
  if (text.length > 200) return "research";
  return "chat";
}
