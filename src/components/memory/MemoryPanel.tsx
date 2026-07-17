"use client";
import * as Sentry from "@sentry/nextjs";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Trash2, X, Loader2 } from "lucide-react";

interface Memory {
  id: string;
  type: string;
  content: string;
  confidence: number;
  createdAt: string;
  accessCount: number;
}

interface UserPrefs {
  preferredLanguage: string;
  preferredDepth: string;
  preferredFormat: string;
  preferredProvider: string;
}

export function MemoryPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [memories, setMemories] = React.useState<Memory[]>([]);
  const [prefs, setPrefs] = React.useState<UserPrefs | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"memories" | "preferences">("memories");

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const [memRes, prefRes] = await Promise.all([
          fetch("/api/memories"),
          fetch("/api/preferences"),
        ]);
        const memData = await memRes.json();
        const prefData = await prefRes.json();
        setMemories(memData.memories || []);
        setPrefs(prefData.preferences || null);
      } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* ignore */ 
} finally {
        setLoading(false);
      }
    })();
  }, [open]);

  async function deleteMemory(id: string) {
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  async function updatePrefs(newPrefs: UserPrefs) {
    setPrefs(newPrefs);
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPrefs),
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-[#faf9f5] dark:bg-[#1a1a18] border-l border-[#e8e6dc] dark:border-[#3d3a35] z-50 overflow-y-auto"
          >
            <div className="sticky top-0 bg-[#faf9f5] dark:bg-[#1a1a18] border-b border-[#e8e6dc] dark:border-[#3d3a35] px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-[#c96442]" />
                <h2 className="text-sm font-semibold">Memory</h2>
              </div>
              <button onClick={onClose} className="flex size-8 items-center justify-center rounded-md text-[#87867f] hover:text-[#141413] dark:text-[#a3a098] dark:hover:text-[#faf9f5] hover:bg-[#141413]/5 dark:hover:bg-[#faf9f5]/5 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-[#e8e6dc] dark:border-[#3d3a35]">
              <button
                onClick={() => setTab("memories")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${tab === "memories" ? "border-b-2 border-[#c96442] text-[#c96442]" : "text-[#87867f] dark:text-[#a3a098]"}`}
              >
                Memories ({memories.length})
              </button>
              <button
                onClick={() => setTab("preferences")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${tab === "preferences" ? "border-b-2 border-[#c96442] text-[#c96442]" : "text-[#87867f] dark:text-[#a3a098]"}`}
              >
                Preferences
              </button>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#87867f] dark:text-[#a3a098]" />
                </div>
              ) : tab === "memories" ? (
                <div className="space-y-3">
                  {memories.length === 0 ? (
                    <p className="text-sm text-[#87867f] dark:text-[#a3a098] text-center py-8">
                      No memories yet. The system will learn about you as you interact.
                    </p>
                  ) : (
                    memories.map((m) => (
                      <div key={m.id} className="rounded-xl border border-[#e8e6dc]/60 dark:border-[#3d3a35]/60 p-3 group">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            m.type === "fact" ? "bg-[#d4a574]/15 text-[#a37a3f]" :
                            m.type === "preference" ? "bg-[#c96442]/15 text-[#c96442]" :
                            "bg-[#f0eee6] text-[#5e5d59]"
                          }`}
                          >
                            {m.type}
                          </span>
                          <button
                            onClick={() => deleteMemory(m.id)}
                            className="opacity-0 group-hover:opacity-100 text-[#87867f] hover:text-[#c44848] transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-sm mt-2 text-[#141413] dark:text-[#faf9f5]">{m.content}</p>
                        <p className="text-[10px] text-[#87867f] mt-1">
                          confidence: {Math.round(m.confidence * 100)}% · accessed {m.accessCount}x
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {prefs && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-[#87867f] dark:text-[#a3a098]">Language</label>
                        <select
                          value={prefs.preferredLanguage}
                          onChange={(e) => updatePrefs({ ...prefs, preferredLanguage: e.target.value })}
                          className="w-full mt-1 rounded-lg border border-[#e8e6dc] dark:border-[#3d3a35] bg-[#faf9f5] dark:bg-[#1a1a18] px-3 py-2 text-sm text-[#141413] dark:text-[#faf9f5]"
                        >
                          <option value="auto">Auto-detect</option>
                          <option value="en">English</option>
                          <option value="ar">العربية</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#87867f] dark:text-[#a3a098]">Research Depth</label>
                        <select
                          value={prefs.preferredDepth}
                          onChange={(e) => updatePrefs({ ...prefs, preferredDepth: e.target.value })}
                          className="w-full mt-1 rounded-lg border border-[#e8e6dc] dark:border-[#3d3a35] bg-[#faf9f5] dark:bg-[#1a1a18] px-3 py-2 text-sm text-[#141413] dark:text-[#faf9f5]"
                        >
                          <option value="standard">Standard</option>
                          <option value="deep">Deep</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#87867f] dark:text-[#a3a098]">LLM Provider</label>
                        <select
                          value={prefs.preferredProvider}
                          onChange={(e) => updatePrefs({ ...prefs, preferredProvider: e.target.value })}
                          className="w-full mt-1 rounded-lg border border-[#e8e6dc] dark:border-[#3d3a35] bg-[#faf9f5] dark:bg-[#1a1a18] px-3 py-2 text-sm text-[#141413] dark:text-[#faf9f5]"
                        >
                          <option value="auto">Auto</option>
                          <option value="nvidia">NVIDIA (free)</option>
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic</option>
                          <option value="ollama">Ollama (local)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
