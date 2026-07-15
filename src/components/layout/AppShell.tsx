"use client";

import * as React from "react";
import { Menu, Brain } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ArtifactsPanel } from "../artifacts/ArtifactsPanel";
import { MemoryPanel } from "../memory/MemoryPanel";
import { InstallPrompt } from "../pwa/InstallPrompt";
import { OfflineIndicator } from "../pwa/OfflineIndicator";
import { Button } from "@/components/ui/button";
import type { Artifact } from "@/lib/artifact-detector";

interface SidebarConversation {
  id: string;
  title: string;
  type: "chat" | "research" | "quick" | "document";
  createdAt: string;
}

interface AppShellProps {
  children: React.ReactNode;
  conversations: SidebarConversation[];
  activeConversationId?: string;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  artifact: Artifact | null;
  onClearArtifact: () => void;
}

export function AppShell({
  children, conversations, activeConversationId,
  onNewChat, onSelectConversation, artifact, onClearArtifact,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [memoryOpen, setMemoryOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={onNewChat}
        onSelectConversation={onSelectConversation}
        conversations={conversations}
        activeId={activeConversationId}
      />

      {/* Center column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background/80 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 w-8"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMemoryOpen(true)}
            className="h-8 w-8"
            aria-label="Memory"
          >
            <Brain className="h-4 w-4 text-muted-foreground" />
          </Button>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>

      {/* Artifacts panel */}
      {artifact && (
        <ArtifactsPanel artifact={artifact} onClose={onClearArtifact} />
      )}

      {/* Memory panel (slide-in) */}
      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />

      {/* PWA components */}
      <InstallPrompt />
      <OfflineIndicator />
    </div>
  );
}
