"use client";
import * as Sentry from "@sentry/nextjs";

// SwarmCard — multi-agent swarm visualization.
//
// Shows:
//   1. The user's task
//   2. The plan (subtasks + assigned roles)
//   3. Live agent activity (tokens streaming, tool calls)
//   4. Synthesis phase
//   5. Final synthesized report
//
// The swarm runs 2-4 specialist agents in parallel, then a synthesizer
// combines their outputs.

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Code2,
  BarChart3,
  PenLine,
  Wrench,
  Layers,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ExportMenu } from "@/components/export/ExportMenu";
import { CompassLogo } from "@/components/CompassLogo";

// ---------- Types ----------

type AgentRole = "researcher" | "coder" | "analyst" | "writer" | "generalist";

interface Subtask {
  id: string;
  description: string;
  role: AgentRole;
}

interface AgentState {
  id: string;
  role: AgentRole;
  task: string;
  status: "pending" | "running" | "done" | "error";
  tokens: string;
  tools: Array<{ tool: string; params: unknown; result?: string }>;
  error?: string;
}

interface SwarmEvent {
  type:
    | "swarm_start"
    | "agent_start"
    | "agent_token"
    | "agent_tool"
    | "agent_result"
    | "agent_done"
    | "synth_start"
    | "synth_token"
    | "swarm_done"
    | "error";
  taskId?: string;
  plan?: { task: string; subtasks: Subtask[] };
  agentId?: string;
  role?: AgentRole;
  task?: string;
  token?: string;
  tool?: string;
  params?: unknown;
  result?: string;
  finalReport?: string;
  message?: string;
  error?: string;
}

// ---------- Role config ----------

const ROLE_ICON: Record<AgentRole, React.ElementType> = {
  researcher: Search,
  coder: Code2,
  analyst: BarChart3,
  writer: PenLine,
  generalist: CompassLogo,
};

const ROLE_COLOR: Record<AgentRole, string> = {
  researcher: "text-[#8b4513] bg-[#f4f1ea] dark:bg-[#322e28]",
  coder: "text-[#8b6f47] bg-[#f4f1ea] dark:bg-[#322e28]",
  analyst: "text-[#a37a3f] bg-[#f4f1ea] dark:bg-[#322e28]",
  writer: "text-[#9b6b5c] bg-[#f4f1ea] dark:bg-[#322e28]",
  generalist: "text-[#6b6358] bg-[#f4f1ea] dark:bg-[#322e28]",
};

const ROLE_LABEL: Record<AgentRole, string> = {
  researcher: "Researcher",
  coder: "Coder",
  analyst: "Analyst",
  writer: "Writer",
  generalist: "Generalist",
};

// ---------- Component ----------

interface SwarmCardProps {
  task: string;
}

export const SwarmCard = React.memo(function SwarmCard({ task }: SwarmCardProps) {
  const [plan, setPlan] = React.useState<{ task: string; subtasks: Subtask[] } | null>(null);
  const [agents, setAgents] = React.useState<Map<string, AgentState>>(new Map());
  const [synthText, setSynthText] = React.useState("");
  const [synthActive, setSynthActive] = React.useState(false);
  const [finalReport, setFinalReport] = React.useState("");
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/swarm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) {
            setError(data.error || `HTTP ${res.status}`);
          }
          return;
        }
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        if (reader) {
          for (;;) {
            const { done: rdone, value } = await reader.read();
            if (rdone) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const evt = JSON.parse(line.slice(6)) as SwarmEvent;
                if (cancelled) return;
                handleEvent(evt);
              } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* skip */
              
}
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        if (!cancelled) setDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEvent(evt: SwarmEvent) {
    switch (evt.type) {
      case "swarm_start":
        if (evt.plan) setPlan(evt.plan);
        break;
      case "agent_start":
        if (!evt.agentId) break;
        setAgents((prev) => {
          const next = new Map(prev);
          next.set(evt.agentId!, {
            id: evt.agentId!,
            role: evt.role || "generalist",
            task: evt.task || "",
            status: "running",
            tokens: "",
            tools: [],
          });
          return next;
        });
        break;
      case "agent_token":
        if (!evt.agentId || !evt.token) break;
        setAgents((prev) => {
          const next = new Map(prev);
          const a = next.get(evt.agentId!);
          if (a) a.tokens += evt.token;
          return next;
        });
        break;
      case "agent_tool":
        if (!evt.agentId) break;
        setAgents((prev) => {
          const next = new Map(prev);
          const a = next.get(evt.agentId!);
          if (a) a.tools.push({ tool: evt.tool || "", params: evt.params });
          return next;
        });
        break;
      case "agent_result":
        if (!evt.agentId) break;
        setAgents((prev) => {
          const next = new Map(prev);
          const a = next.get(evt.agentId!);
          if (a && a.tools.length > 0) {
            a.tools[a.tools.length - 1]!.result = evt.result;
          }
          return next;
        });
        break;
      case "agent_done":
        if (!evt.agentId) break;
        setAgents((prev) => {
          const next = new Map(prev);
          const a = next.get(evt.agentId!);
          if (a) {
            a.status = evt.error ? "error" : "done";
            if (evt.error) a.error = evt.error;
          }
          return next;
        });
        break;
      case "synth_start":
        setSynthActive(true);
        break;
      case "synth_token":
        if (evt.token) setSynthText((s) => s + evt.token);
        break;
      case "swarm_done":
        if (evt.finalReport) setFinalReport(evt.finalReport);
        setSynthActive(false);
        setDone(true);
        break;
      case "error":
        setError(evt.message || "Swarm failed");
        break;
    }
  }

  const agentList = Array.from(agents.values());
  const allAgentsDone = plan && agentList.length === plan.subtasks.length && agentList.every((a) => a.status === "done" || a.status === "error");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-[#d9d4c7] dark:border-[#3d3830] overflow-hidden bg-[#faf8f3] dark:bg-[#1c1a17]"
    >
      {/* Header */}
      <div className="bg-[#faf8f3] dark:bg-[#1c1a17] px-5 py-3 flex items-start gap-2 border-b border-[#d9d4c7] dark:border-[#3d3830]">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#f4f1ea] dark:bg-[#322e28]">
          <Network className="h-3.5 w-3.5 text-[#8b4513]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#8b4513] mb-0.5">Agent Swarm</p>
          <p className="text-sm font-medium text-[#2a2620] dark:text-[#e8e3d8]">{task}</p>
        </div>
        {!done && !error && (
          <Loader2 className="h-4 w-4 animate-spin text-[#6b6358] dark:text-[#9a9080] shrink-0" />
        )}
        {done && !error && (
          <CheckCircle2 className="h-4 w-4 text-[#8b4513] shrink-0" />
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-[#a33a3a]/30 bg-[#a33a3a]/5 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#a33a3a] mt-0.5" />
            <p className="text-sm text-[#a33a3a]">{error}</p>
          </div>
        ) : (
          <>
            {/* Plan */}
            {plan && (
              <div className="rounded-xl border border-[#d9d4c7]/60 dark:border-[#3d3830]/60 bg-[#f4f1ea]/30 dark:bg-[#322e28]/30 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers className="h-3.5 w-3.5 text-[#6b6358] dark:text-[#9a9080]" />
                  <span className="text-xs font-semibold text-[#6b6358] dark:text-[#9a9080]">
                    Plan — {plan.subtasks.length} agents
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {plan.subtasks.map((s, i) => {
                    const Icon = ROLE_ICON[s.role];
                    const a = agents.get(s.id);
                    const status = a?.status || "pending";
                    return (
                      <div
                        key={s.id}
                        className="flex items-start gap-2 rounded-lg bg-[#faf8f3]/60 dark:bg-[#1c1a17]/60 px-2.5 py-2"
                      >
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${ROLE_COLOR[s.role]}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-[#6b6358]">#{i + 1}</span>
                            <span className="text-xs font-medium text-[#2a2620] dark:text-[#e8e3d8]">{ROLE_LABEL[s.role]}</span>
                            {status === "running" && <Loader2 className="h-3 w-3 animate-spin text-[#8b4513]" />}
                            {status === "done" && <CheckCircle2 className="h-3 w-3 text-[#8b4513]" />}
                            {status === "error" && <AlertCircle className="h-3 w-3 text-[#a33a3a]" />}
                          </div>
                          <p className="text-xs text-[#6b6358] dark:text-[#9a9080] mt-0.5 line-clamp-2">{s.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Agent activity (live) */}
            {agentList.some((a) => a.tokens || a.tools.length > 0) && !finalReport && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#6b6358] dark:text-[#9a9080] flex items-center gap-1.5">
                  <CompassLogo className="h-3.5 w-3.5" />
                  Live agent activity
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {agentList.map((a) => {
                    const Icon = ROLE_ICON[a.role];
                    return (
                      <div
                        key={a.id}
                        className="rounded-xl border border-[#d9d4c7]/40 dark:border-[#3d3830]/40 bg-[#faf8f3]/60 dark:bg-[#1c1a17]/60 p-3 max-h-64 overflow-y-auto"
                      >
                        <div className="flex items-center gap-1.5 mb-2 sticky top-0 bg-[#faf8f3]/95 dark:bg-[#1c1a17]/95 -mx-3 -mt-3 px-3 pt-3 pb-2 border-b border-[#d9d4c7]/40 dark:border-[#3d3830]/40">
                          <div className={`flex h-5 w-5 items-center justify-center rounded ${ROLE_COLOR[a.role]}`}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <span className="text-xs font-medium text-[#2a2620] dark:text-[#e8e3d8]">{ROLE_LABEL[a.role]}</span>
                          {a.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-[#8b4513] ml-auto" />}
                          {a.status === "done" && <CheckCircle2 className="h-3 w-3 text-[#8b4513] ml-auto" />}
                        </div>
                        {/* Tool calls */}
                        {a.tools.map((tool, i) => (
                          <div key={i} className="mb-2 rounded-lg bg-[#f4f1ea] dark:bg-[#322e28] border border-[#d9d4c7] dark:border-[#3d3830] px-2 py-1.5">
                            <div className="flex items-center gap-1 text-[10px] font-mono text-[#a37a3f] dark:text-[#d4a574]">
                              <Wrench className="h-3 w-3" />
                              {tool.tool}
                            </div>
                            {tool.result && (
                              <p className="text-[10px] text-[#6b6358] mt-1 line-clamp-3 font-mono">{tool.result}</p>
                            )}
                          </div>
                        ))}
                        {/* Tokens */}
                        {a.tokens && (
                          <p className="text-xs text-[#6b6358] dark:text-[#9a9080] whitespace-pre-wrap font-mono leading-relaxed">
                            {a.tokens.slice(-600)}
                            {a.status === "running" && (
                              <span className="inline-block h-3 w-1 bg-[#8b4513] animate-pulse ml-0.5 align-middle" />
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Synthesis phase */}
            <AnimatePresence>
              {(synthActive || synthText) && !finalReport && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-[#8b4513]/30 bg-[#8b4513]/5 p-3"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Network className="h-3.5 w-3.5 text-[#8b4513]" />
                    <span className="text-xs font-semibold text-[#8b4513]">
                      Synthesizing {allAgentsDone ? "✓" : "..."}
                    </span>
                    {synthActive && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                  </div>
                  {synthText ? (
                    <article className="prose prose-quaesitor font-body leading-[1.7] max-w-none dark:prose-invert">
                      <ReactMarkdown>{synthText}</ReactMarkdown>
                    </article>
                  ) : (
                    <div className="space-y-1.5 animate-pulse">
                      <div className="h-3 bg-[#d9d4c7] dark:bg-[#322e28] rounded w-3/4" />
                      <div className="h-3 bg-[#d9d4c7] dark:bg-[#322e28] rounded w-full" />
                      <div className="h-3 bg-[#d9d4c7] dark:bg-[#322e28] rounded w-5/6" />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Final report */}
            {finalReport && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#8b4513]" />
                  <span className="text-xs font-semibold text-[#6b6358] dark:text-[#9a9080]">Final Report</span>
                  <div className="ml-auto">
                    <ExportMenu content={finalReport} filename="swarm-report" />
                  </div>
                </div>
                <article className="prose prose-quaesitor font-body leading-[1.7] max-w-none dark:prose-invert">
                  <ReactMarkdown>{finalReport}</ReactMarkdown>
                </article>
              </div>
            )}

            {/* Initial loading */}
            {!plan && !error && (
              <div className="space-y-2 animate-pulse">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#8b4513]" />
                  <span className="text-sm text-[#6b6358] dark:text-[#9a9080]">Orchestrator is planning the swarm...</span>
                </div>
                <div className="h-4 bg-[#d9d4c7] dark:bg-[#322e28] rounded w-1/2" />
                <div className="h-4 bg-[#d9d4c7] dark:bg-[#322e28] rounded w-2/3" />
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
});
