"use client";

// AppShell — top-level layout for the AI workstation.
//
// Provides: header (branding + toggles), sidebar (mode switcher),
// main content area (renders the active mode), and footer.
// Each mode component renders only its content — the shell handles
// the page chrome.

import * as React from "react";
import { Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { useT } from "@/components/i18n/locale-provider";
import { Sidebar, type Mode } from "./Sidebar";
import { DeepResearch } from "@/components/deep-research";
import { QuickMode } from "@/components/modes/QuickMode";
import { HistoryMode } from "@/components/modes/HistoryMode";
import { DocumentsMode } from "@/components/documents/DocumentsMode";

export function AppShell() {
  const t = useT();
  const [mode, setMode] = React.useState<Mode>("research");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-sm font-medium">{t("appName")}</h1>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Sidebar + Main content */}
      <div className="flex flex-1 min-h-0">
        <Sidebar mode={mode} setMode={setMode} />
        <main
          id="main-content"
          className="relative flex-1 min-w-0"
        >
          <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
            {mode === "research" && <DeepResearch />}
            {mode === "quick" && <QuickMode />}
            {mode === "documents" && <DocumentsMode />}
            {mode === "history" && <HistoryMode />}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 text-[11px] text-muted-foreground text-center">
          {t("appTagline")}
        </div>
      </footer>
    </div>
  );
}
