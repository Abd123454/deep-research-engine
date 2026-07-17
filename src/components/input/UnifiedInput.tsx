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
import {
  Paperclip, X, ArrowRight, Loader2, ChevronDown,
  Globe, Microscope, Terminal, Image as ImageIcon,
  Volume2, FileText, Users, Wrench,
} from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type InputMode = "auto" | "research" | "quick" | "chat" | "swarm";

export type ToolKey =
  | "web-search"
  | "deep-research"
  | "code-execution"
  | "image-gen"
  | "voice-output"
  | "doc-analysis"
  | "swarm";

export interface ToolDef {
  key: ToolKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const TOOLS: ToolDef[] = [
  { key: "web-search", label: "Web Search", icon: Globe, description: "Search the web for current info" },
  { key: "deep-research", label: "Deep Research", icon: Microscope, description: "Multi-step research with citations" },
  { key: "code-execution", label: "Code Execution", icon: Terminal, description: "Run code in a sandbox" },
  { key: "image-gen", label: "Image Generation", icon: ImageIcon, description: "Generate images from text" },
  { key: "voice-output", label: "Voice Output", icon: Volume2, description: "Read response aloud (TTS)" },
  { key: "doc-analysis", label: "Document Analysis", icon: FileText, description: "Analyze attached documents" },
  { key: "swarm", label: "Agent Swarm", icon: Users, description: "Multi-agent collaborative task" },
];

export interface AttachedFile {
  id: string;
  file: File;
}

interface UnifiedInputProps {
  onSend: (text: string, files: AttachedFile[], mode: InputMode, tools?: ToolKey[]) => void;
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
  const [tools, setTools] = React.useState<ToolKey[]>([]);
  const [toolsOpen, setToolsOpen] = React.useState(false);
  const [error, setError] = React.useState("");
  const internalTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || internalTextareaRef;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const modeRef = React.useRef<HTMLDivElement>(null);
  const toolsRef = React.useRef<HTMLDivElement>(null);

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

  // Close tools dropdown on outside click.
  React.useEffect(() => {
    if (!toolsOpen) return;
    function handler(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [toolsOpen]);

  function toggleTool(key: ToolKey) {
    setTools((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  }

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
    onSend(text.trim(), files, mode, tools);
    setText("");
    setFiles([]);
    setTools([]);
    setError("");
  }

  const modeLabel = mode === "auto" ? "Auto" : mode === "research" ? t("modeResearch") : mode === "chat" ? "Chat" : mode === "swarm" ? "Swarm" : t("modeQuick");

  return (
    <div className="shrink-0 z-30 px-4 pb-4 bg-[#f4f1ea] dark:bg-[#1c1a17]">
      <div className="mx-auto max-w-2xl">
        {/* Attached files */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {files.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 rounded-full bg-[#d9d4c7] dark:bg-[#322e28] text-[#2a2620] dark:text-[#e8e3d8] text-xs px-2.5 py-1"
              >
                <Paperclip className="h-3 w-3" />
                {f.file.name}
                <button
                  onClick={() => removeFile(f.id)}
                  aria-label={`Remove ${f.file.name}`}
                  className="hover:text-[#a33a3a]"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-[#a33a3a] mb-2">{error}</p>}

        {/* Composer — Quaesitor structure: textarea on top, bottom toolbar (attach+mode left, send right) */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex w-full flex-col rounded-3xl border border-[#d9d4c7] bg-[#faf8f3] dark:border-[#3d3830] dark:bg-[#1c1a17] px-3.5 pt-3 pb-2.5 focus-within:border-[#b5673a]/50 transition-colors"
        >
          {/* Active tool chips — shown above textarea when tools are selected */}
          {tools.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tools.map((tk) => {
                const tool = TOOLS.find((t) => t.key === tk);
                if (!tool) return null;
                const Icon = tool.icon;
                return (
                  <span
                    key={tk}
                    className="inline-flex items-center gap-1 rounded-full bg-[#8b4513]/10 dark:bg-[#b5673a]/15 text-[#8b4513] dark:text-[#b5673a] text-xs px-2.5 py-1 font-ui font-medium"
                  >
                    <Icon className="h-3 w-3" />
                    {tool.label}
                    <button
                      type="button"
                      onClick={() => toggleTool(tk)}
                      aria-label={`Remove ${tool.label}`}
                      className="hover:text-[#6b3410] dark:hover:text-[#8b4513] ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Textarea — transparent, serif body, 16px. Enter sends, Shift+Enter newline. */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("quickPlaceholder")}
            rows={1}
            className="w-full resize-none bg-transparent border-0 ring-0 focus:ring-0 focus:outline-none font-body text-[16px] leading-[1.5] text-[#2a2620] dark:text-[#e8e3d8] placeholder:text-[#6b6358] min-h-[24px] max-h-[200px]"
            style={{ boxShadow: "none" }}
            onKeyDown={(e) => {
              // Claude.ai behavior: Enter sends, Shift+Enter inserts newline.
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
            onChange={handleFileSelect}
          />

          {/* Bottom toolbar — attach + tools + mode on left, send on right */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 flex-wrap">
              {/* Attach button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex size-8 items-center justify-center rounded-md text-[#6b6358] hover:bg-[#2a2620]/5 dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5 transition-colors"
                aria-label={t("uploadDocument")}
              >
                <Paperclip className="h-4 w-4" />
              </button>

              {/* Tools dropdown */}
              <div ref={toolsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setToolsOpen((v) => !v)}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-md px-2 text-xs transition-colors",
                    tools.length > 0
                      ? "text-[#8b4513] font-medium bg-[#8b4513]/10"
                      : "text-[#6b6358] hover:bg-[#2a2620]/5 dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5"
                  )}
                  aria-label="Tools"
                  aria-expanded={toolsOpen}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Tools
                  {tools.length > 0 && (
                    <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-[#8b4513] text-[#faf8f3] text-[10px] font-semibold size-4 leading-none">
                      {tools.length}
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {toolsOpen && (
                  <div className="absolute bottom-full left-0 mb-1 z-20 rounded-lg border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#1c1a17] py-1 min-w-[220px]">
                    {TOOLS.map((tool) => {
                      const Icon = tool.icon;
                      const active = tools.includes(tool.key);
                      return (
                        <button
                          key={tool.key}
                          onClick={() => toggleTool(tool.key)}
                          className={cn(
                            "flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-[#f4f1ea] dark:hover:bg-[#322e28] transition-colors",
                            active && "bg-[#8b4513]/5"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", active ? "text-[#8b4513]" : "text-[#6b6358] dark:text-[#9a9080]")} />
                          <div className="flex-1 min-w-0">
                            <div className={cn("text-xs font-medium font-ui", active ? "text-[#8b4513]" : "text-[#2a2620] dark:text-[#e8e3d8]")}>
                              {tool.label}
                            </div>
                            <div className="text-[11px] text-[#6b6358] dark:text-[#9a9080] font-ui leading-tight">
                              {tool.description}
                            </div>
                          </div>
                          {active && (
                            <div className="size-4 rounded-full bg-[#8b4513] flex items-center justify-center shrink-0 mt-0.5">
                              <svg className="h-2.5 w-2.5 text-[#faf8f3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mode dropdown */}
              <div ref={modeRef} className="relative">
                <button
                  type="button"
                  onClick={() => setModeOpen((v) => !v)}
                  className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-[#6b6358] hover:bg-[#2a2620]/5 dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5 transition-colors"
                  aria-label="Mode"
                  aria-expanded={modeOpen}
                >
                  {modeLabel}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {modeOpen && (
                  <div className="absolute bottom-full left-0 mb-1 z-20 rounded-lg border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#1c1a17] py-1 min-w-[120px]">
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
                          "flex w-full items-center px-3 py-2 text-xs hover:bg-[#f4f1ea] dark:hover:bg-[#322e28] text-left font-ui text-[#2a2620] dark:text-[#e8e3d8]",
                          mode === m.key && "text-[#8b4513] font-medium"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Send button — circular, saddle brown (light) / leather (dark) */}
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || (!text.trim() && files.length === 0)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#8b4513] dark:bg-[#b5673a] text-[#faf8f3] hover:bg-[#6b3410] dark:hover:bg-[#8b4513] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label={t("quickSend")}
            >
              {disabled ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>

        {/* Disclaimer — Quaesitor signature */}
        <p className="text-center text-xs text-[#6b6358] dark:text-[#9a9080] mt-2 font-ui">
          {t("disclaimer")}
        </p>
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
