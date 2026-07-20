"use client";

// CanvasPanel — ChatGPT Canvas parity.
//
// A lightweight inline editor for artifacts. Slides in from the right and
// lets the user edit the artifact's raw source in a textarea (no heavy
// TipTap/contentEditable machinery — keeps the bundle small and the UX
// identical to ChatGPT's "Edit in Canvas" mode).
//
// Wired into UnifiedInterface: when the user clicks "Edit in Canvas" in
// ArtifactsPanel, the parent sets `canvasArtifact` state and this panel
// mounts on top of the artifacts column. onSave propagates the edited
// content back up so the parent can update the artifact.
//
// Design: warm Quaesitor palette. `font-ui` (DM Sans) for the chrome,
// `font-mono` (JetBrains Mono) for the editor surface. Visual
// elevation uses borders + surface tone only (per DESIGN.md).
import * as React from "react";
import { motion } from "framer-motion";
import { X, Save, RotateCcw } from "lucide-react";

interface CanvasPanelProps {
  content: string;
  language: string;
  onClose: () => void;
  onSave?: (content: string) => void;
}

export function CanvasPanel({ content, language, onClose, onSave }: CanvasPanelProps) {
  const [editedContent, setEditedContent] = React.useState(content);
  const [isDirty, setIsDirty] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // When the upstream content changes (e.g. the user picks a different
  // artifact to edit), reset the local state so we don't carry edits
  // across unrelated documents.
  React.useEffect(() => {
    setEditedContent(content);
    setIsDirty(false);
  }, [content]);

  // Auto-focus the editor on mount so the user can start typing
  // immediately — matches the ChatGPT Canvas behavior where the cursor
  // lands in the document on open.
  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSave() {
    onSave?.(editedContent);
    setIsDirty(false);
  }

  function handleReset() {
    setEditedContent(content);
    setIsDirty(false);
  }

  // Ctrl/Cmd+S saves without leaving the editor. The browser's default
  // "Save Page" is suppressed so the keystroke is captured cleanly.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (isDirty) handleSave();
    }
  }

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 z-40 h-full w-full max-w-2xl border-l border-[#d9d4c7] bg-[#faf8f3] dark:border-[#3d3830] dark:bg-[#252220] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[#d9d4c7] dark:border-[#3d3830] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-ui text-sm font-medium text-[#2a2620] dark:text-[#e8e3d8]">
            Canvas
          </span>
          <span className="font-mono text-xs text-[#6b6358] dark:text-[#9a9080] truncate">
            {language}
          </span>
          {isDirty && (
            <span className="text-xs text-[#a37a3f]">• unsaved</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleReset}
            disabled={!isDirty}
            className="flex size-8 items-center justify-center rounded-md text-[#6b6358] hover:bg-[#2a2620]/5 disabled:opacity-30 transition-colors dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5"
            aria-label="Reset"
            title="Reset to original"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="flex size-8 items-center justify-center rounded-md text-[#6b6358] hover:bg-[#2a2620]/5 disabled:opacity-30 transition-colors dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5"
            aria-label="Save"
            title="Save (Ctrl+S)"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-[#6b6358] hover:bg-[#2a2620]/5 transition-colors dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5"
            aria-label="Close"
            title="Close canvas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor — a plain textarea keeps the bundle light. */}
      <textarea
        ref={textareaRef}
        value={editedContent}
        onChange={(e) => {
          setEditedContent(e.target.value);
          setIsDirty(true);
        }}
        onKeyDown={handleKeyDown}
        className="flex-1 resize-none bg-transparent p-4 font-mono text-sm text-[#2a2620] dark:text-[#e8e3d8] focus:outline-none"
        spellCheck={false}
        aria-label="Canvas editor"
      />

      {/* Footer — live char/line counter */}
      <div className="px-4 py-2 border-t border-[#d9d4c7] dark:border-[#3d3830] shrink-0">
        <p className="font-ui text-xs text-[#6b6358] dark:text-[#9a9080]">
          {editedContent.length} chars • {editedContent.split("\n").length} lines
        </p>
      </div>
    </motion.div>
  );
}
