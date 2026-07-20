// Agent Swarm — multi-agent collaboration system.
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

import crypto from "crypto";
import { getLLM, type LLMMessage } from "./llm-provider";
import { detectToolCall, executeToolCall, getToolsDescription, type ToolCall } from "./agent-tools";
import { logger } from "./logger";
import { MAX_TOOL_ITERATIONS } from "./swarm-constants";
import { runWithConcurrency } from "./concurrency";

// God-object refactor (final-cleanup): the swarm's types + role
// definitions now live in `./swarm/types` and `./swarm/roles`. The
// orchestration logic (planSwarm, runWorker, synthesizeSwarm, runSwarm,
// the dynamic subagent API) stays here. The barrel at `./swarm/index`
// re-exports everything from one entry point.
//
// We re-export the types + role constants from here too, so existing
// callers that import from `@/lib/swarm` (the file) keep working —
// the new `./swarm/` directory is purely additive.
import type {
  AgentRole,
  Subtask,
  SwarmPlan,
  SwarmEvent,
  SwarmEventEmitter,
  Subagent,
  RunSwarmOptions,
} from "./swarm/types";
import {
  ROLE_PROMPTS,
  ROLE_TOOLS,
  PLAN_SYSTEM_PROMPT,
  SYNTH_SYSTEM_PROMPT,
} from "./swarm/roles";

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

// ---------- Orchestrator: plan the task ----------

export async function planSwarm(
  task: string
): Promise<Subtask[]> {
  const messages: LLMMessage[] = [
    { role: "system", content: PLAN_SYSTEM_PROMPT },
    { role: "user", content: `Task: ${task}\n\nBreak this into 2-4 subtasks for the swarm.` },
  ];

  const llm = await getLLM();
  const result = await llm.fast({ messages, maxTokens: 800, temperature: 0.3, json: true });
  const content = result.content.trim();

  // Extract JSON (tolerate markdown fences).
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // Fallback: single generalist.
    return [{ id: "s1", description: task, role: "generalist" }];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { subtasks?: Array<{ description?: string; role?: string }> };
    const subs = (parsed.subtasks || [])
      .filter((s) => s.description && s.role)
      .slice(0, 4)
      .map((s, i) => ({
        id: `s${i + 1}`,
        description: String(s.description).slice(0, 500),
        role: (validateRole(s.role) ? s.role : "generalist") as AgentRole,
      }));

    if (subs.length === 0) {
      return [{ id: "s1", description: task, role: "generalist" }];
    }
    return subs;
  } catch (err) {
    // Non-critical: LLM returned malformed subtask JSON. Fall back to a
    // single generalist agent so the swarm still produces output.
    logger.warn(
      { module: "swarm", err: err instanceof Error ? err.message : String(err) },
      "decomposeTask: JSON parse failed — using single-generalist fallback"
    );
    return [{ id: "s1", description: task, role: "generalist" }];
  }
}

function validateRole(role: unknown): role is AgentRole {
  return typeof role === "string" && [
    "researcher",
    "coder",
    "analyst",
    "writer",
    "generalist",
    "security_analyst",
    "electrical_engineer",
    "fact_checker",
    "bias_auditor",
    "device_controller",
  ].includes(role);
}

// ---------- Worker: execute a subtask ----------

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

// Kimi/Trilogy loop-degeneration detection (Trilogy AI production
// post-mortem): when a tool keeps failing, the model can enter a
// degenerate retry loop — e.g. 3 consecutive `exec` calls with
// `{"command":""}` after a script-not-found error. The model does not
// recover, it degrades.
//
// Mitigation: track (tool + JSON.stringify(params)) and break the loop
// after the same call is attempted LOOP_DETECTION_THRESHOLD times.
const LOOP_DETECTION_THRESHOLD = 3;

// Kimi §2.6: the model can return multiple tool_calls in one assistant
// message and they should run in parallel. We cap the per-message fan-out
// to avoid pathological cases (model emits 50 search calls at once and
// trips the rate limiter before any can complete).
const MAX_PARALLEL_TOOL_CALLS = 4;

/** Detect ALL ```tool\n{...}\n``` blocks in an assistant message.
 *
 * This is the multi-call counterpart to `detectToolCall` in agent-tools.ts.
 * Kimi's API returns multiple `tool_calls` per assistant message and runs
 * them concurrently (§2.6 of the kimi-research findings). We replicate that
 * pattern here by scanning for every fenced tool block in the response.
 *
 * Implemented locally (rather than reusing `detectToolCall`) so the swarm
 * test mock — which only mocks `detectToolCall` — is unaffected.
 */
function detectToolCalls(response: string): ToolCall[] {
  if (!response) return [];
  const calls: ToolCall[] = [];
  // Same fence format as agent-tools.ts: ```tool\n{"tool":"name","params":{...}}\n```
  const fenceRegex = /```tool\s*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(response)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { tool?: string; params?: Record<string, unknown> };
      if (parsed.tool) {
        calls.push({ tool: parsed.tool, params: parsed.params || {} });
      }
    } catch (err) {
      // Non-critical: this fenced ```tool block wasn't valid JSON (common
      // with smaller models that forget closing braces). Skip it and try
      // the next match — same behavior as agent-tools.detectToolCall.
      logger.debug(
        { module: "swarm", err: err instanceof Error ? err.message : String(err) },
        "detectToolCalls: fenced-block JSON parse failed — skipping"
      );
    }
  }
  return calls;
}

/** Recursively stable JSON serialization.
 *
 * P0-39 (audit fix): the previous implementation used
 * `JSON.stringify(call.params, Object.keys(call.params).sort())` which
 * ONLY sorts top-level keys. Nested objects retained their insertion
 * order, so `{"a":{"x":1,"y":2}}` and `{"a":{"y":2,"x":1}}` hashed
 * differently — a real degenerate loop where the model reorders nested
 * keys (which it does, because JSON object key order is not
 * semantically meaningful) was not detected.
 *
 * This implementation walks the entire object tree, sorting keys at
 * every depth. Arrays preserve element order (which is semantically
 * meaningful for `["a","b"]` vs `["b","a"]`).
 */
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          stableStringify((obj as Record<string, unknown>)[k])
      )
      .join(",") +
    "}"
  );
}

/** Hash a (tool, params) tuple for loop-degeneration tracking.
 *
 * Uses `stableStringify` (recursive key sort) so two semantically
 * identical calls with differently-ordered keys hash to the same
 * value. This is the actual loop-degeneration signal we care about —
 * the model is "doing the same thing" regardless of which order it
 * emitted the JSON keys in.
 */
function hashToolCall(call: ToolCall): string {
  const stable = stableStringify(call.params);
  return crypto.createHash("sha256").update(`${call.tool}:${stable}`).digest("hex");
}

export async function runWorker(
  subtask: Subtask,
  context: string,
  emit: SwarmEventEmitter
): Promise<string> {
  const agentId = subtask.id;
  const rolePrompt = ROLE_PROMPTS[subtask.role] || ROLE_PROMPTS.generalist;
  const roleTools = ROLE_TOOLS[subtask.role] ?? [];

  // Kimi P1 (Trilogy lesson): filter the tool description to ONLY this
  // role's tools, so the model is not tempted to call tools it doesn't
  // have. The old code passed the global catalog unfiltered.
  const toolsDesc = roleTools.length > 0
    ? `\n\nAvailable tools (you may call several in one response — they run in parallel):\n${getToolsDescription()}\n\nTo call a tool, use:\n\`\`\`tool\n{"tool": "name", "params": {...}}\n\`\`\``
    : "";

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `${rolePrompt}${toolsDesc}\n\nContext (overall task): ${context}\nYour subtask: ${subtask.description}\n\nRespond with your findings. Be focused and complete.`,
    },
    { role: "user", content: `Please complete your subtask: ${subtask.description}` },
  ];

  const llm = await getLLM();

  // Loop-degeneration tracker: maps hashToolCall(call) → count.
  // If any single (tool, params) tuple is attempted 3+ times, break.
  const callCounts = new Map<string, number>();

  // ReAct loop: think → maybe call tools (in parallel) → feed results → continue.
  let fullResponse = "";
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const result = await llm.smart({
      messages,
      maxTokens: 1500,
      temperature: 0.4,
      stream: true,
      onToken: (token: string) => {
        fullResponse += token;
        emit({ type: "agent_token", agentId, token });
      },
    });

    // Kimi P0-2: detect ALL tool calls in this assistant message and run
    // them in parallel. Filter to only the tools this role is allowed to
    // call (defense in depth — the model should not see other tools in
    // its system prompt, but if it hallucinates one we silently drop it).
    const allCalls = detectToolCalls(result.content);
    const allowedCalls = allCalls.filter((c) => roleTools.includes(c.tool));

    // Backward-compat: if detectToolCalls returned nothing, also try the
    // single-call detector from agent-tools.ts (it handles the inline
    // `[TOOL: name] params: {...}` format that detectToolCalls does not).
    if (allowedCalls.length === 0) {
      const single = detectToolCall(result.content);
      if (single && roleTools.includes(single.tool)) {
        allowedCalls.push(single);
      }
    }

    if (allowedCalls.length === 0) {
      // No tool call — we're done.
      return result.content;
    }

    // P0-40: process ALL detected tool calls in batches of
    // MAX_PARALLEL_TOOL_CALLS. Each batch runs its tool calls in parallel
    // via Promise.all; batches run sequentially to bound the per-batch
    // rate-limit fan-out (Kimi §2.6 — the model decides how many to emit;
    // we cap the worst-case concurrency at 4).
    //
    // Previously this code TRUNCATED to the first 4 calls and dropped
    // the rest. The audit flagged this as a correctness bug: if the
    // model emitted 6 search queries, queries 5 and 6 were silently
    // discarded and the model had no way to know — it would re-emit
    // them on the next iteration, wasting a turn. Batching executes
    // every requested call.
    if (allowedCalls.length > MAX_PARALLEL_TOOL_CALLS) {
      logger.warn(
        {
          module: "swarm",
          agentId,
          role: subtask.role,
          requested: allowedCalls.length,
          cap: MAX_PARALLEL_TOOL_CALLS,
          batches: Math.ceil(allowedCalls.length / MAX_PARALLEL_TOOL_CALLS),
        },
        "Worker requested more parallel tool calls than the cap — running in batches"
      );
    }

    const allResults: Array<{ call: ToolCall; result: { success: boolean; output: string } }> = [];
    let degenerateCall: ToolCall | null = null;

    for (
      let batchStart = 0;
      batchStart < allowedCalls.length;
      batchStart += MAX_PARALLEL_TOOL_CALLS
    ) {
      const batch = allowedCalls.slice(batchStart, batchStart + MAX_PARALLEL_TOOL_CALLS);

      // Loop-degeneration check (per batch): if any call in THIS batch
      // has already been attempted LOOP_DETECTION_THRESHOLD times, stop
      // processing further batches and surface the degenerate call to
      // the model. We still feed back the results collected so far.
      const degenerate = batch.find((c) => {
        const h = hashToolCall(c);
        return (callCounts.get(h) || 0) >= LOOP_DETECTION_THRESHOLD;
      });
      if (degenerate) {
        degenerateCall = degenerate;
        break;
      }

      // Record call counts for loop detection (before execution — the
      // count reflects "attempted", matching the original semantics
      // where "3+ times attempted with identical args" trips the guard).
      for (const c of batch) {
        const h = hashToolCall(c);
        callCounts.set(h, (callCounts.get(h) || 0) + 1);
      }

      // Emit tool-start events (one per call in this batch).
      for (const c of batch) {
        emit({ type: "agent_tool", agentId, tool: c.tool, params: c.params });
      }

      // Kimi P0-2: run all tool calls in the batch in parallel via
      // Promise.all. Per-batch wall-clock latency drops by ~N× compared
      // to serial execution.
      const batchResults = await Promise.all(
        batch.map((c) => executeToolCall(c))
      );

      // Emit tool-result events + collect for the feedback message.
      for (let i = 0; i < batchResults.length; i++) {
        const tr = batchResults[i]!;
        emit({
          type: "agent_result",
          agentId,
          tool: batch[i]!.tool,
          result: tr.output.slice(0, 2000),
        });
        allResults.push({ call: batch[i]!, result: tr });
      }
    }

    // Feed all tool results back to the model.
    messages.push({ role: "assistant", content: result.content });

    if (degenerateCall) {
      // Loop-degeneration: stop retrying and ask the model for a final
      // answer with what it has so far.
      const msg =
        `Loop-degeneration detected: tool "${degenerateCall.tool}" has been called ` +
        `${LOOP_DETECTION_THRESHOLD}+ times with identical arguments without progress. ` +
        `Breaking the ReAct loop to avoid wasting the worker's token budget. ` +
        `(Kimi/Trilogy production post-mortem mitigation.)`;
      logger.warn({ module: "swarm", agentId, tool: degenerateCall.tool }, msg);
      const partialSummary = allResults.length > 0
        ? allResults
            .map((r) => `Tool ${r.call.tool} result:\n${r.result.output.slice(0, 1500)}`)
            .join("\n\n")
        : "(no prior tool results)";
      messages.push({
        role: "user",
        content: `${partialSummary}\n\n${msg}\n\nStop retrying this tool call. Either use a different tool, fix the arguments, or give your final answer with what you have so far.`,
      });
      // Give the model one more turn to recover (no further tool calls will
      // be allowed once it responds — the next iteration will return its
      // content as the final answer if no new tool call is emitted).
      continue;
    }

    // Verifier loop: if ANY tool failed, ask the model to fix and retry.
    // If all succeeded, just continue with the results.
    const failed = allResults.filter((r) => !r.result.success);
    if (failed.length > 0) {
      const failureSummary = failed
        .map((r) => `Tool ${r.call.tool} failed:\n${r.result.output.slice(0, 1500)}`)
        .join("\n\n");
      messages.push({
        role: "user",
        content: `${failureSummary}\n\nPlease fix the issue(s) and try again. If you've already retried and it still fails, explain the error in your final answer.`,
      });
    } else {
      const successSummary = allResults
        .map((r) => `Tool ${r.call.tool} result:\n${r.result.output.slice(0, 1500)}`)
        .join("\n\n");
      messages.push({
        role: "user",
        content: `${successSummary}\n\nContinue based on these results. If you have enough information, give your final answer.`,
      });
    }
    // Continue the ReAct loop — next iteration may emit more tool calls.
  }

  // Hit iteration limit — return what we have.
  return fullResponse || "(no output)";
}

// ---------- Synthesizer: combine worker outputs ----------
export async function synthesizeSwarm(
  task: string,
  workerOutputs: Array<{ role: AgentRole; subtask: string; output: string }>,
  emit: SwarmEventEmitter
): Promise<string> {
  emit({ type: "synth_start" });

  const workerSummary = workerOutputs
    .map((w, i) => `### Agent ${i + 1} (${w.role})\nSubtask: ${w.subtask}\n\n${w.output}`)
    .join("\n\n---\n\n");

  const messages: LLMMessage[] = [
    { role: "system", content: SYNTH_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Original task: ${task}\n\nHere are the outputs from ${workerOutputs.length} specialist agents:\n\n${workerSummary}\n\nSynthesize these into a single comprehensive answer.`,
    },
  ];

  const llm = await getLLM();
  let finalReport = "";
  await llm.smart({
    messages,
    maxTokens: 3000,
    temperature: 0.5,
    stream: true,
    onToken: (token: string) => {
      finalReport += token;
      emit({ type: "synth_token", token });
    },
  });

  return finalReport;
}

// ---------- Swarm runner: orchestrate the whole thing ----------

const WORKER_TIMEOUT_MS = 90_000; // 90s per worker
const SYNTH_TIMEOUT_MS = 120_000; // 120s for synthesis

/** Wrap a promise with a timeout. Returns the result or throws on timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}


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
