"use client";

// Sidebar — mode switcher for the AI workstation.
//
// Desktop (md+): vertical sidebar on the left.
// Mobile: horizontal bar at the top of the content area (scrollable).

import { Search, Zap, FileText, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/locale-provider";
import type { StringKey } from "@/lib/i18n/strings";

export type Mode = "research" | "quick" | "documents" | "history";

interface SidebarProps {
  mode: Mode;
  setMode: (m: Mode) => void;
}

interface ModeDef {
  key: Mode;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: StringKey;
}

const MODES: ModeDef[] = [
  { key: "research", icon: Search, labelKey: "modeResearch" },
  { key: "quick", icon: Zap, labelKey: "modeQuick" },
  { key: "documents", icon: FileText, labelKey: "modeDocuments" },
  { key: "history", icon: Clock, labelKey: "modeHistory" },
];

export function Sidebar({ mode, setMode }: SidebarProps) {
  const t = useT();
  return (
    <nav
      aria-label="Modes"
      className="shrink-0 border-b md:border-b-0 md:border-r border-border/40 md:w-48"
    >
      <div className="flex md:flex-col gap-1 p-2 md:p-3 overflow-x-auto md:overflow-visible">
        {MODES.map((m) => {
          const active = mode === m.key;
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm shrink-0 whitespace-nowrap transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(m.labelKey)}
              {(m.key === "documents" || m.key === "history") && (
                <span className="ml-auto hidden md:inline text-[9px] text-muted-foreground/60 uppercase tracking-wide">
                  {t("comingSoon")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
