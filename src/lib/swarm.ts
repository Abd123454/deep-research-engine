// Agent Swarm — multi-agent collaboration system (orchestration entry point).
//
// A swarm is a team of specialized AI agents that work together on a
// complex task. Architecture:
//
//   User Task
//       │
//       ▼
//   ┌─────────────┐
//   │ Orchestrator │  breaks task into subtasks, assigns to workers
//   └──────┬──────┘
//          │
//     ┌────┼────┬──────────┐
//     ▼    ▼    ▼          ▼
//   Worker Worker Worker  Worker   (parallel)
//   │     │     │        │
//   └─────┴─────┴────────┘
//          │
//          ▼
//   ┌──────────────┐
//   │  Synthesizer  │  combines worker outputs into final answer
//   └──────────────┘
//
// SSE events streamed to client:
//   { type: "swarm_start",  taskId, plan: Subtask[] }
//   { type: "agent_start",  agentId, role, task }
//   { type: "agent_token",  agentId, token }
//   { type: "agent_tool",   agentId, tool, params }
//   { type: "agent_result", agentId, output }
//   { type: "agent_done",   agentId }
//   { type: "synth_start" }
//   { type: "synth_token",  token }
//   { type: "swarm_done",   finalReport }
//   { type: "error",        message }
//
// Cancellation: the caller passes an AbortSignal. When aborted, all
// in-flight LLM calls are cancelled and the swarm stops.
//
// ─── Module layout (final-10 refactor) ─────────────────────────────
// This file is the PUBLIC ENTRY POINT. The implementation is split
// across the `swarm/` directory:
//   - `swarm/types.ts`        — type definitions (Subtask, SwarmPlan, etc.)
//   - `swarm/roles.ts`        — role prompts + role→tools mapping
//   - `swarm/worker.ts`       — runWorker (ReAct loop + loop-degeneration)
//   - `swarm/orchestrator.ts` — planSwarm, synthesizeSwarm, withTimeout
//   - `swarm/index.ts`        — barrel re-export (the directory import)
//
// This file (`swarm.ts`) owns:
//   - `runSwarm` — the entry point that wires plan → workers → synth.
//   - `serializeSSE` — SSE event serialization helper.
//   - The dynamic subagent API (createSubagent / assignTask /
//     getSubagent / listSubagents / clearSubagents) and its
//     process-local registry.
//   - Re-exports of the public surface from the swarm/ modules so
//     `import { runSwarm, planSwarm, runWorker, ... } from "@/lib/swarm"`
//     keeps working without changes.
//
// Original file was 742 lines; the worker + orchestrator extraction
// brings this file to ~280 lines (a 62% reduction).

import crypto from "crypto";
import { logger } from "./logger";
import { MAX_TOOL_ITERATIONS } from "./swarm-constants";
import { runWithConcurrency } from "./concurrency";

// Types + role constants (re-exported from `./swarm/`).
// The types are imported as values-and-types here because `runSwarm`
// + the subagent API below use them in type annotations. The role
// constants (`ROLE_PROMPTS`, etc.) are NOT used directly in this file
// — they are re-exported via `export { ... } from "./swarm/roles"`
// below, so we don't import them as values (avoids unused-import
// warnings).
import type {
  AgentRole,
  Subtask,
  SwarmPlan,
  SwarmEvent,
  SwarmEventEmitter,
  Subagent,
  RunSwarmOptions,
} from "./swarm/types";

// Worker + orchestrator implementations (re-exported below).
import { runWorker } from "./swarm/worker";
import {
  planSwarm,
  synthesizeSwarm,
  withTimeout,
  WORKER_TIMEOUT_MS,
  SYNTH_TIMEOUT_MS,
} from "./swarm/orchestrator";

// Re-export the types + role constants so existing `import { ... }
// from "@/lib/swarm"` call sites keep working without changes.
export type {
  AgentRole,
  Subtask,
  SwarmPlan,
  SwarmEvent,
  SwarmEventEmitter,
  Subagent,
  RunSwarmOptions,
} from "./swarm/types";
export {
  ROLE_PROMPTS,
  ROLE_TOOLS,
  PLAN_SYSTEM_PROMPT,
  SYNTH_SYSTEM_PROMPT,
} from "./swarm/roles";

// Re-export the worker + orchestrator public surface.
export { runWorker } from "./swarm/worker";
export {
  planSwarm,
  synthesizeSwarm,
  withTimeout,
  WORKER_TIMEOUT_MS,
  SYNTH_TIMEOUT_MS,
} from "./swarm/orchestrator";

// Re-export the loop-degeneration helpers from the worker module —
// they were historically exported from `swarm.ts` and external code
// (or future tests) may still reach for them.
export {
  detectToolCalls,
  stableStringify,
  hashToolCall,
  LOOP_DETECTION_THRESHOLD,
  MAX_PARALLEL_TOOL_CALLS,
} from "./swarm/worker";

// Kimi K2.5/K2.6 production trajectories do 50–300 sequential tool calls
// per subagent (K2 Thinking blog). The old cap of 4 was wildly conservative
// and caused c5-style timeouts where the swarm ran out of iteration budget
// before completing even a single research loop.
//
// 15 is a middle ground: high enough to let a researcher do 3–5 search →
// read → extract cycles, low enough to stay within the 90s worker timeout.
// (Kimi-Researcher averages 23 reasoning steps + 70 search queries; we are
// not in that league, but 4 was clearly too low.)
//
// P0-2 (intensive audit): the value is now centralized in
// `src/lib/swarm-constants.ts` so the chat agent route and the swarm
// share the same budget — they had drifted (swarm=15, agent=5) which
// caused inconsistent tool-call ceilings depending on the entrypoint.
//
// The constant is imported at the top of this file. We re-export it here
// for callers that already import it from `@/lib/swarm` — the swarm is
// the historical home of this value and external code may still reach
// for `swarm.MAX_TOOL_ITERATIONS`.
export { MAX_TOOL_ITERATIONS };

// ---------- Swarm runner: orchestrate the whole thing ----------

/**
 * Run a full swarm: plan → fan-out workers → synthesize.
 *
 * This is the public entry point. Callers pass a task + an SSE emitter
 * and receive the final plan + synthesized report.
 *
 * Phases:
 *   1. Plan — `planSwarm(task)` asks the LLM to break the task into
 *      2-4 subtasks. Emits `swarm_start` with the plan.
 *   2. Workers — fan out the subtasks to `runWorker` calls with
 *      bounded concurrency (3 — respects NVIDIA free-tier limits).
 *      Each worker runs the ReAct loop (see `swarm/worker.ts`).
 *      Emits `agent_start` / `agent_token` / `agent_tool` /
 *      `agent_result` / `agent_done` per worker.
 *   3. Synthesize — `synthesizeSwarm(task, outputs, emit)` combines
 *      the parallel worker outputs into a single coherent answer.
 *      Emits `synth_start` + `synth_token` events.
 *
 * Cancellation: the caller's AbortSignal (in `opts.signal`) is
 * checked between phases. If aborted, the swarm short-circuits with
 * a synthetic "cancelled" error.
 *
 * Per-phase timeouts: workers cap at 90s each, synthesis at 120s.
 * A timeout is non-fatal — the affected phase returns an error
 * note in its output and the swarm continues with what it has.
 *
 * @param task  the user's task description.
 * @param emit  the SSE event emitter (called from inside the swarm).
 * @param opts  optional userId (audit attribution) + AbortSignal.
 * @returns the final plan + synthesized report.
 */
export async function runSwarm(
  task: string,
  emit: SwarmEventEmitter,
  opts?: RunSwarmOptions
): Promise<{ plan: SwarmPlan; finalReport: string }> {
  // P0-3 (per-user isolation): capture opts up-front so workers/synth
  // can read userId/signal from the closure without threading them
  // through every internal call.
  const userId = opts?.userId;
  const signal = opts?.signal;

  // Cooperative-cancellation helper: if the caller's AbortSignal has
  // fired, throw a synthetic "swarm cancelled" error so the current
  // phase bails out cleanly. Called between phases (plan → workers,
  // workers → synth) and once before each phase starts.
  const assertNotCancelled = (phase: string) => {
    if (signal?.aborted) {
      throw new Error(`Swarm cancelled before ${phase} (caller aborted).`);
    }
  };

  // Phase 1: Plan.
  assertNotCancelled("plan");
  const subtasks = await planSwarm(task);
  const plan: SwarmPlan = { taskId: crypto.randomUUID(), task, subtasks };
  emit({ type: "swarm_start", taskId: plan.taskId, plan });

  // P0-3: log the userId (when present) so swarm invocations are
  // attributable in the audit trail. Falling back to "anonymous" for
  // legacy callers (eval runner, tests) keeps the log line shape
  // stable.
  logger.debug(
    { module: "swarm", taskId: plan.taskId, userId: userId ?? "anonymous", subtaskCount: subtasks.length },
    "Swarm started"
  );

  // Phase 2: Run workers with BOUNDED concurrency (was unbounded
  // Promise.allSettled — 7b v5 audit fix). A plan that fans out to 6+
  // workers would fire 6 simultaneous LLM calls, blowing the NVIDIA
  // free-tier rate limit (3 concurrent). Cap at 3 to respect provider
  // limits; workers run sequentially in groups of 3.
  //
  // We use `runWithConcurrency` (Promise.all semantics under the hood)
  // instead of `Promise.allSettled` because the mapper already wraps
  // its body in try/catch — it never rejects, so allSettled's
  // rejection-tolerance is unnecessary. The returned shape matches
  // the previous `r.value` for fulfilled results.
  assertNotCancelled("workers");
  const workerResults = await runWithConcurrency(
    subtasks,
    async (subtask) => {
      // P0-3: per-worker cancellation check. If the caller aborted
      // mid-flight (e.g. user closed the SSE tab), skip workers that
      // haven't started yet.
      if (signal?.aborted) {
        emit({ type: "agent_done", agentId: subtask.id, error: "cancelled" });
        return {
          role: subtask.role,
          subtask: subtask.description,
          output: "(agent skipped: swarm cancelled)",
        };
      }
      emit({ type: "agent_start", agentId: subtask.id, role: subtask.role, task: subtask.description });
      try {
        const output = await withTimeout(
          runWorker(subtask, task, emit),
          WORKER_TIMEOUT_MS,
          `Worker ${subtask.id} (${subtask.role})`
        );
        emit({ type: "agent_done", agentId: subtask.id });
        return { role: subtask.role, subtask: subtask.description, output };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit({ type: "agent_done", agentId: subtask.id, error: msg });
        return {
          role: subtask.role,
          subtask: subtask.description,
          output: `(agent failed: ${msg})`,
        };
      }
    },
    3,
  );

  // Collect results (including failures, which become error notes).
  // workerResults already holds the fulfilled values (the mapper
  // never rejects — see try/catch above).
  const outputs = workerResults;

  // Phase 3: Synthesize (with timeout).
  assertNotCancelled("synthesis");
  const finalReport = await withTimeout(
    synthesizeSwarm(task, outputs, emit),
    SYNTH_TIMEOUT_MS,
    "Synthesizer"
  );
  emit({ type: "swarm_done", finalReport });

  return { plan, finalReport };
}

// ---------- SSE serialization ----------

export function serializeSSE(event: SwarmEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// ---------- Dynamic subagent API (Kimi two-tool swarm pattern) ----------
//
// Mirrors Kimi K2.5's `create_subagent` + `assign_task` tool API described
// in Appendix E.8 of the K2.5 paper (arXiv:2602.02276v1). The orchestrator
// can dynamically create specialized subagents at runtime and assign them
// tasks, rather than relying solely on the static `planSwarm()` output.
//
// This is the minimal viable swarm API: two functions that together let a
// caller spawn N subagents and dispatch work to them, possibly in parallel.
//
// Backward compatibility: `runSwarm()` continues to use `planSwarm()` +
// `runWorker()` under the hood. The dynamic API is opt-in for callers that
// want mid-execution subagent spawning (e.g., when an orchestrator-level
// reasoning step discovers a new sub-problem that wasn't in the original
// plan).


// Process-local registry. Subagents are scoped to the current Node.js
// process — they do not persist across restarts. This matches the existing
// swarm's in-memory design (jobs are in `research-store.ts` memory too).
const subagentRegistry = new Map<string, Subagent>();

/** Create a new subagent with a name, role, and specialization prompt.
 *
 * Mirrors Kimi's `create_subagent(name, system_prompt)` tool — the model
 * invents a name and a system prompt that defines the agent's role and
 * capabilities, then later assigns tasks to it via `assignTask`.
 *
 * Returns the created Subagent (including its generated id) so the caller
 * can immediately dispatch work.
 */
export function createSubagent(
  name: string,
  systemPrompt: string,
  role: AgentRole = "generalist"
): Subagent {
  if (!name || !name.trim()) {
    throw new Error("createSubagent: name is required");
  }
  if (!systemPrompt || !systemPrompt.trim()) {
    throw new Error("createSubagent: systemPrompt is required");
  }
  const id = `agent_${crypto.randomUUID().slice(0, 8)}`;
  const agent: Subagent = {
    id,
    name: name.trim(),
    role,
    systemPrompt: systemPrompt.trim(),
    createdAt: Date.now(),
  };
  subagentRegistry.set(id, agent);
  return agent;
}

/** Assign a task to a previously-created subagent and run it to completion.
 *
 * Mirrors Kimi's `assign_task(agent, prompt)` tool. The subagent executes
 * the task in its own bounded context (proactive context sharding — only
 * the final output returns to the caller, not the full ReAct trace).
 *
 * Multiple `assignTask` calls can be `Promise.all`'d in parallel by the
 * caller — that's exactly how the orchestrator fans out work in Kimi's
 * production swarm (§2.3 of the kimi-research findings).
 */
export async function assignTask(
  agentId: string,
  task: string,
  emit?: SwarmEventEmitter
): Promise<string> {
  const agent = subagentRegistry.get(agentId);
  if (!agent) {
    throw new Error(
      `assignTask: unknown subagent id "${agentId}". Call createSubagent() first.`
    );
  }
  if (!task || !task.trim()) {
    throw new Error("assignTask: task is required");
  }

  // Reuse the existing worker infrastructure. The subtask id is the agent
  // id (so agent_tool / agent_token / agent_done events route correctly).
  // The "context" passed to runWorker is the subagent's system prompt,
  // which gives it its specialization.
  const subtask: Subtask = {
    id: agent.id,
    description: task,
    role: agent.role,
  };

  const noopEmit: SwarmEventEmitter = () => {};
  return runWorker(subtask, agent.systemPrompt, emit ?? noopEmit);
}

/** Look up a previously-created subagent by id. */
export function getSubagent(id: string): Subagent | undefined {
  return subagentRegistry.get(id);
}

/** List all currently-registered subagents. */
export function listSubagents(): Subagent[] {
  return Array.from(subagentRegistry.values());
}

/** Clear all registered subagents. Useful for tests and between unrelated
 * orchestrator runs. */
export function clearSubagents(): void {
  subagentRegistry.clear();
}
