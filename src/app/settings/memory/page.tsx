"use client";

import * as React from "react";
import { Brain, Trash2, Plus, Download, Shield } from "lucide-react";

interface Memory {
  id: string;
  type: string;
  content: string;
  confidence: number;
  createdAt: string;
  lastAccessed: string | null;
  accessCount: number;
}

export default function MemoryPage() {
  const [memories, setMemories] = React.useState<Memory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAdd, setShowAdd] = React.useState(false);
  const [newType, setNewType] = React.useState("fact");
  const [newContent, setNewContent] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editContent, setEditContent] = React.useState("");

  // ---------- Memory extraction consent (Ethical #4) ----------
  // Opt-in toggle. Default state is OFF — Quaesitor will NOT auto-extract
  // memories from conversations until the user explicitly turns this on.
  // Toggling calls POST /api/preferences/memory, which writes to the
  // user_preferences.memory_consent column AND logs to the audit trail
  // (GDPR Art. 7 — demonstrable consent).
  const [memoryEnabled, setMemoryEnabled] = React.useState(false);
  const [memoryLoading, setMemoryLoading] = React.useState(true);
  const [memorySaving, setMemorySaving] = React.useState(false);
  const [memoryError, setMemoryError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/preferences/memory")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.enabled === "boolean") {
          setMemoryEnabled(data.enabled);
        }
      })
      .catch(() => {
        // Non-fatal — default to OFF (opt-in).
      })
      .finally(() => setMemoryLoading(false));
  }, []);

  async function toggleMemory(next: boolean) {
    setMemorySaving(true);
    setMemoryError(null);
    try {
      const res = await fetch("/api/preferences/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMemoryError(data?.error || "Failed to update memory consent.");
        return;
      }
      setMemoryEnabled(next);
    } catch {
      setMemoryError("Failed to update memory consent. Please try again.");
    } finally {
      setMemorySaving(false);
    }
  }

  React.useEffect(() => {
    fetch("/api/memories")
      .then((r) => r.json())
      .then((data) => setMemories(data.memories || []))
      .finally(() => setLoading(false));
  }, []);

  async function addMemory() {
    if (!newContent.trim()) return;
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newType, content: newContent }),
    });
    const data = await res.json();
    if (data.memory) {
      setMemories((prev) => [data.memory, ...prev]);
      setNewContent("");
      setShowAdd(false);
    }
  }

  async function deleteMemory(id: string) {
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  async function saveEdit(id: string) {
    await fetch(`/api/memories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    });
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, content: editContent } : m)));
    setEditingId(null);
  }

  function exportMemories() {
    const blob = new Blob([JSON.stringify(memories, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quaesitor-memories.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen font-body text-lg text-[#6b6358]">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] dark:bg-[#2b2a27]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-body text-3xl font-normal text-[#2a2620] dark:text-[#e8e3d8] mb-1">Memory</h1>
            <p className="font-ui text-sm text-[#6b6358]">What Quaesitor remembers across conversations</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportMemories} className="flex items-center gap-1.5 border border-[#6b6358] text-[#2a2620] dark:text-[#e8e3d8] rounded-lg px-3 py-2 font-ui text-sm hover:bg-[#e0d9c8] dark:hover:bg-[#322e28] transition-colors">
              <Download className="h-4 w-4" /> Export
            </button>
            <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 bg-[#b5673a] text-[#faf8f3] rounded-lg px-3 py-2 font-ui text-sm font-medium hover:bg-[#8b4513] transition-colors">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        {/* ---------- Memory extraction consent toggle (Ethical #4) ----------
            Opt-in. Default OFF. Calls POST /api/preferences/memory to flip
            the user_preferences.memory_consent flag, which the chat /
            agent / extract routes consult via isMemoryExtractionEnabled. */}
        <section
          aria-labelledby="memory-extraction-label"
          className="mb-8 bg-[#faf8f3] dark:bg-[#252220] border border-[#d9d4c7] dark:border-[#3d3830] rounded-3xl p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="shrink-0 mt-0.5 h-9 w-9 rounded-xl bg-[#e0d9c8] dark:bg-[#322e28] flex items-center justify-center">
                <Shield className="h-4 w-4 text-[#8b4513] dark:text-[#d9d4c7]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id="memory-extraction-label" className="font-ui text-base font-medium text-[#2a2620] dark:text-[#e8e3d8]">
                  Memory extraction
                </h2>
                <p className="font-body text-sm text-[#6b6358] mt-1 leading-relaxed">
                  When enabled, Quaesitor will automatically extract and store key facts from your conversations to provide personalized responses. You can delete all memories at any time. See{" "}
                  <a href="/privacy" className="text-[#8b4513] hover:underline" target="_blank" rel="noreferrer">Privacy Policy</a>.
                </p>
                {memoryError && (
                  <p role="alert" className="font-ui text-xs text-[#a33a3a] mt-2">{memoryError}</p>
                )}
                {memorySaving && (
                  <p className="font-ui text-xs text-[#6b6358] mt-2" aria-live="polite">Saving…</p>
                )}
              </div>
            </div>

            {/* Toggle switch — #8b4513 when ON, #d9d4c7 when OFF.
                The whole switch is a button for keyboard accessibility. */}
            <button
              type="button"
              role="switch"
              aria-checked={memoryEnabled}
              aria-labelledby="memory-extraction-label"
              disabled={memoryLoading || memorySaving}
              onClick={() => toggleMemory(!memoryEnabled)}
              className="relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3] dark:focus-visible:ring-offset-[#252220] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: memoryEnabled ? "#8b4513" : "#d9d4c7" }}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-[#faf8f3] border border-[#d9d4c7] transition-transform duration-200 ${memoryEnabled ? "translate-x-6" : "translate-x-1"}`}
              />
              <span className="sr-only">{memoryEnabled ? "Memory extraction is ON" : "Memory extraction is OFF"}</span>
            </button>
          </div>
        </section>

        {showAdd && (
          <div className="mb-6 bg-[#faf8f3] dark:bg-[#252220] border border-[#d9d4c7] dark:border-[#3d3830] rounded-3xl p-6">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="mb-3 bg-[#f4f1ea] dark:bg-[#2b2a27] border border-[#d9d4c7] dark:border-[#3d3830] rounded-lg px-3 py-2 font-ui text-sm text-[#2a2620] dark:text-[#e8e3d8] outline-none"
              style={{ boxShadow: "none", minHeight: "auto" }}
            >
              <option value="fact">Fact</option>
              <option value="preference">Preference</option>
              <option value="context">Context</option>
            </select>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              placeholder="What should Quaesitor remember?"
              className="w-full bg-transparent border-0 font-body text-base text-[#2a2620] dark:text-[#e8e3d8] placeholder:text-[#6b6358] outline-none resize-none"
              style={{ boxShadow: "none", minHeight: "auto", padding: "0" }}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={addMemory} className="bg-[#b5673a] text-[#faf8f3] rounded-lg px-4 py-2 font-ui text-sm font-medium hover:bg-[#8b4513] transition-colors">Save</button>
              <button onClick={() => setShowAdd(false)} className="border border-[#6b6358] text-[#2a2620] dark:text-[#e8e3d8] rounded-lg px-4 py-2 font-ui text-sm hover:bg-[#e0d9c8] dark:hover:bg-[#322e28] transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {memories.length === 0 ? (
          <div className="text-center py-16">
            <Brain className="h-12 w-12 text-[#d9d4c7] mx-auto mb-4" />
            <p className="font-body text-lg text-[#6b6358] mb-2">No memories yet</p>
            <p className="font-ui text-sm text-[#6b6358]">Memories are extracted from conversations. Start chatting to build your memory.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {memories.map((memory) => (
              <div key={memory.id} className="bg-[#faf8f3] dark:bg-[#252220] border border-[#d9d4c7] dark:border-[#3d3830] rounded-2xl p-4 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block text-xs font-ui text-[#6b6358] bg-[#e0d9c8] dark:bg-[#322e28] rounded-full px-2 py-0.5 mb-2">{memory.type}</span>
                    {editingId === memory.id ? (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                        className="w-full bg-transparent border-0 font-body text-base text-[#2a2620] dark:text-[#e8e3d8] outline-none resize-none"
                        style={{ boxShadow: "none", minHeight: "auto", padding: "0" }}
                      />
                    ) : (
                      <p className="font-body text-base text-[#2a2620] dark:text-[#e8e3d8]">{memory.content}</p>
                    )}
                    <p className="font-ui text-xs text-[#6b6358] mt-2">Accessed {memory.accessCount} times</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingId === memory.id ? (
                      <button onClick={() => saveEdit(memory.id)} className="p-1.5 text-[#6b6358] hover:text-[#b5673a]">
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => { setEditingId(memory.id); setEditContent(memory.content); }}
                        className="p-1.5 text-[#6b6358] hover:text-[#2a2620] dark:hover:text-[#e8e3d8]"
                      >
                        <Brain className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => deleteMemory(memory.id)} className="p-1.5 text-[#6b6358] hover:text-[#a33a3a]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
