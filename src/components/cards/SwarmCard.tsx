"use client";

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
  Sparkles,
  Wrench,
  Layers,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ExportMenu } from "@/components/export/ExportMenu";

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
  generalist: Sparkles,
};

const ROLE_COLOR: Record<AgentRole, string> = {
  researcher: "text-sky-500 bg-sky-500/10",
  coder: "text-emerald-500 bg-emerald-500/10",
  analyst: "text-amber-500 bg-amber-500/10",
  writer: "text-rose-500 bg-rose-500/10",
  generalist: "text-violet-500 bg-violet-500/10",
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
              } catch {
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
      className="rounded-3xl border border-border/60 shadow-md overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500/10 via-primary/10 to-secondary px-5 py-3 flex items-start gap-2 border-b border-border/40">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/20">
          <Network className="h-3.5 w-3.5 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-violet-500 mb-0.5">Agent Swarm</p>
          <p className="text-sm font-medium text-foreground">{task}</p>
        </div>
        {!done && !error && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
        )}
        {done && !error && (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <>
            {/* Plan */}
            {plan && (
              <div className="rounded-xl border border-border/50 bg-secondary/30 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">
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
                        className="flex items-start gap-2 rounded-lg bg-background/60 px-2.5 py-2"
                      >
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${ROLE_COLOR[s.role]}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                            <span className="text-xs font-medium">{ROLE_LABEL[s.role]}</span>
                            {status === "running" && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                            {status === "done" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                            {status === "error" && <AlertCircle className="h-3 w-3 text-destructive" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
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
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Live agent activity
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {agentList.map((a) => {
                    const Icon = ROLE_ICON[a.role];
                    return (
                      <div
                        key={a.id}
                        className="rounded-xl border border-border/40 bg-background/60 p-3 max-h-64 overflow-y-auto"
                      >
                        <div className="flex items-center gap-1.5 mb-2 sticky top-0 bg-background/80 backdrop-blur-sm -mx-3 -mt-3 px-3 pt-3 pb-2 border-b border-border/30">
                          <div className={`flex h-5 w-5 items-center justify-center rounded ${ROLE_COLOR[a.role]}`}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <span className="text-xs font-medium">{ROLE_LABEL[a.role]}</span>
                          {a.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />}
                          {a.status === "done" && <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-auto" />}
                        </div>
                        {/* Tool calls */}
                        {a.tools.map((tool, i) => (
                          <div key={i} className="mb-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-2 py-1.5">
                            <div className="flex items-center gap-1 text-[10px] font-mono text-amber-600 dark:text-amber-400">
                              <Wrench className="h-3 w-3" />
                              {tool.tool}
                            </div>
                            {tool.result && (
                              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-3 font-mono">{tool.result}</p>
                            )}
                          </div>
                        ))}
                        {/* Tokens */}
                        {a.tokens && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                            {a.tokens.slice(-600)}
                            {a.status === "running" && (
                              <span className="inline-block h-3 w-1 bg-primary animate-pulse ml-0.5 align-middle" />
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
                  className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Network className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-semibold text-violet-500">
                      Synthesizing {allAgentsDone ? "✓" : "..."}
                    </span>
                    {synthActive && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                  </div>
                  {synthText ? (
                    <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                      <ReactMarkdown>{synthText}</ReactMarkdown>
                    </article>
                  ) : (
                    <div className="space-y-1.5 animate-pulse">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-5/6" />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Final report */}
            {finalReport && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold text-muted-foreground">Final Report</span>
                  <div className="ml-auto">
                    <ExportMenu content={finalReport} filename="swarm-report" />
                  </div>
                </div>
                <article className="prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                  <ReactMarkdown>{finalReport}</ReactMarkdown>
                </article>
              </div>
            )}

            {/* Initial loading */}
            {!plan && !error && (
              <div className="space-y-2 animate-pulse">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Orchestrator is planning the swarm...</span>
                </div>
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
});
