"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { UnifiedInterface } from "@/components/UnifiedInterface";
import type { Artifact } from "@/lib/artifact-detector";

interface SidebarConversation {
  id: string;
  title: string;
  type: "chat" | "research" | "quick" | "document";
  createdAt: string;
}

export default function Home() {
  const [artifact, setArtifact] = React.useState<Artifact | null>(null);
  const [conversations, setConversations] = React.useState<SidebarConversation[]>([]);
  const [activeConvId, setActiveConvId] = React.useState<string | undefined>();

  // Load conversations for sidebar.
  React.useEffect(() => {
    (async () => {
      try {
        const [chatRes, sessionRes] = await Promise.all([
          fetch("/api/chat/conversations"),
          fetch("/api/sessions"),
        ]);
        const chatData = await chatRes.json();
        const sessionData = await sessionRes.json();

        const chatConvs: SidebarConversation[] = (chatData.conversations || []).map((c: any) => ({
          id: c.id,
          title: c.title || "Untitled",
          type: "chat" as const,
          createdAt: c.createdAt || c.created_at || new Date().toISOString(),
        }));
        const sessionConvs: SidebarConversation[] = (sessionData.sessions || []).map((s: any) => ({
          id: s.id,
          title: s.title || "Untitled",
          type: (s.type === "research" ? "research" : s.type === "document_qa" ? "document" : "quick") as any,
          createdAt: s.createdAt || s.created_at || new Date().toISOString(),
        }));

        setConversations([...chatConvs, ...sessionConvs].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      } catch { /* ignore */ }
    })();
  }, []);

  function handleNewChat() {
    setActiveConvId(undefined);
    // UnifiedInterface will clear its cards when this changes.
    window.location.reload();
  }

  function handleSelectConversation(id: string) {
    setActiveConvId(id);
    // TODO: load conversation messages into UnifiedInterface.
    // For now, just set active.
  }

  return (
    <AppShell
      conversations={conversations}
      activeConversationId={activeConvId}
      onNewChat={handleNewChat}
      onSelectConversation={handleSelectConversation}
      artifact={artifact}
      onClearArtifact={() => setArtifact(null)}
    >
      <UnifiedInterface onArtifact={setArtifact} />
    </AppShell>
  );
}
