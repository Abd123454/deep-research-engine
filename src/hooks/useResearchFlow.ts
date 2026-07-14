"use client";

// useResearchFlow — encapsulates the full research pipeline (plan → start →
// poll/stream → report). Extracted from DeepResearch so it can be reused
// by the ResearchCard in the unified interface.
//
// Usage:
//   const { phase, job, streamingReport, stop } = useResearchFlow(query, { autoStart: true });

import * as React from "react";
import { toast } from "sonner";
import type { ResearchJob, ResearchPlan } from "@/lib/types";

export type ResearchPhase = "planning" | "researching" | "done" | "failed";

interface UseResearchFlowOptions {
  autoStart?: boolean;
}

export function useResearchFlow(
  query: string,
  options: UseResearchFlowOptions = {}
) {
  const { autoStart = true } = options;
  const [phase, setPhase] = React.useState<ResearchPhase>("planning");
  const [job, setJob] = React.useState<ResearchJob | null>(null);
  const [streamingReport, setStreamingReport] = React.useState("");
  const [error, setError] = React.useState("");

  const stopPollingRef = React.useRef(false);
  const jobIdRef = React.useRef<string | null>(null);
  const startedRef = React.useRef(false);

  // ---------- SSE streaming (with polling fallback) ----------
  function streamJob(id: string) {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      pollJob(id);
      return;
    }
    let es: EventSource | null = null;
    let fallbackStarted = false;

    const startFallback = (reason: string) => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      if (es) es.close();
      pollJob(id);
    };

    const watchdog = setTimeout(() => {
      if (!stopPollingRef.current) startFallback("no events in 30s");
    }, 30_000);

    try {
      es = new EventSource(`/api/research/stream/${id}`);

      es.addEventListener("update", (e: MessageEvent) => {
        clearTimeout(watchdog);
        try {
          const data = JSON.parse(e.data) as { ok: boolean; job?: ResearchJob };
          if (data.ok && data.job) setJob(data.job);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("report_token", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { tokens: string };
          if (data.tokens) setStreamingReport((prev) => prev + data.tokens);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("done", (e: MessageEvent) => {
        clearTimeout(watchdog);
        es?.close();
        try {
          const data = JSON.parse(e.data) as { status: string; error?: string };
          if (data.status === "completed") {
            setPhase("done");
            toast.success("Research completed");
          } else if (data.error === "Cancelled by user") {
            setPhase("failed");
            setError("Cancelled by user");
          } else {
            setPhase("failed");
            setError(data.error || "Research failed");
          }
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("error", () => {
        clearTimeout(watchdog);
        if (stopPollingRef.current) return;
        startFallback("connection error");
      });

      es.addEventListener("open", () => clearTimeout(watchdog));
    } catch {
      clearTimeout(watchdog);
      startFallback("EventSource construction failed");
    }
  }

  // ---------- Polling fallback ----------
  async function pollJob(id: string) {
    let interval = 1500;
    let consecutive404 = 0;
    const pollStart = Date.now();
    while (!stopPollingRef.current) {
      if (Date.now() - pollStart > 30 * 60 * 1000) {
        setPhase("failed");
        setError("Timed out (30 min limit)");
        return;
      }
      try {
        const res = await fetch(`/api/research/status/${id}`, { cache: "no-store" });
        if (res.status === 404) {
          consecutive404++;
          if (consecutive404 >= 3) {
            setPhase("failed");
            setError("Job evicted from memory");
            return;
          }
        } else if (!res.ok) {
          throw new Error(`Status fetch failed (${res.status})`);
        } else {
          consecutive404 = 0;
          const data = (await res.json()) as { ok: boolean; job?: ResearchJob };
          if (data.ok && data.job) {
            setJob(data.job);
            if (data.job.status === "completed") {
              setPhase("done");
              return;
            }
            if (data.job.status === "failed") {
              setPhase("failed");
              setError(data.job.error || "Research failed");
              return;
            }
          }
        }
      } catch {
        /* ignore transient poll errors */
      }
      await new Promise((r) => setTimeout(r, interval));
      interval = 1500;
    }
  }

  // ---------- Start research ----------
  async function start() {
    if (!query.trim() || startedRef.current) return;
    startedRef.current = true;
    setPhase("planning");
    setJob(null);
    setError("");
    setStreamingReport("");
    stopPollingRef.current = false;

    try {
      // Step 1: generate plan.
      const planRes = await fetch("/api/research/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const planData = (await planRes.json()) as {
        ok: boolean;
        plan?: ResearchPlan;
        error?: string;
      };
      if (!planRes.ok || !planData.ok || !planData.plan) {
        throw new Error(planData.error || "Failed to generate plan.");
      }

      // Step 2: start research.
      setPhase("researching");
      const startRes = await fetch("/api/research/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), plan: planData.plan }),
      });
      const startData = (await startRes.json()) as {
        ok: boolean;
        id?: string;
        error?: string;
      };
      if (!startRes.ok || !startData.ok || !startData.id) {
        throw new Error(startData.error || "Failed to start research.");
      }
      jobIdRef.current = startData.id;

      // Set initial job with plan so UI shows immediately.
      setJob({
        id: startData.id,
        query: query.trim(),
        status: "planning",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        config: {
          query: query.trim(),
          depth: "advanced",
          numSubQueries: 7,
          maxLinksPerQuery: 15,
          pageReadConcurrency: 4,
          reportMaxTokens: 6000,
          retriever: "duckduckgo",
          llmProvider: "nvidia",
          enableMultiRound: true,
          numGapQueries: 3,
        },
        plan: planData.plan,
        gapAnalysis: null,
        round2FollowUps: [],
        subQueries: [],
        sources: [],
        report: null,
        logs: [],
        error: null,
        cancelled: false,
        reportStream: [],
        reportStreaming: false,
        thoughts: [],
        followUpQuestions: [],
        clarifyingQuestions: [],
        stats: {
          totalPagesFound: 0,
          totalPagesRead: 0,
          totalPagesSucceeded: 0,
          totalTokensUsed: 0,
          elapsedMs: 0,
          subQueriesCompleted: 0,
          roundsCompleted: 0,
      llmCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
        },
      });

      streamJob(startData.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("failed");
      toast.error("Research failed", { description: msg });
    }
  }

  // ---------- Stop ----------
  async function stop() {
    const id = jobIdRef.current;
    if (!id) return;
    stopPollingRef.current = true;
    try {
      await fetch(`/api/research/stop/${id}`, { method: "POST" });
    } catch {
      /* ignore */
    }
    setPhase("failed");
    setError("Cancelled by user");
    toast.info("Research cancelled");
  }

  // Auto-start on mount.
  React.useEffect(() => {
    if (autoStart && query.trim()) {
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { phase, job, streamingReport, error, stop };
}
