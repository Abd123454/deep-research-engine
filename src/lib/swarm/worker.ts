// Quaesitor — Agent Swarm worker module.
//
// Extracted from `src/lib/swarm.ts` as part of the god-object
// refactoring pass (final-10 task). The original file was 742 lines;
// moving the worker ReAct loop + its loop-degeneration helpers here
// keeps `swarm.ts` focused on the orchestration entry point
// (`runSwarm`) + the dynamic subagent API.
//
// MOVE ONLY — these functions + constants are byte-for-byte identical
// to the ones that were inline in `swarm.ts`. The only change is the
// file they live in. Public surface (`runWorker`) is re-exported from
// `swarm.ts` so existing callers (`import { runWorker } from
// "@/lib/swarm"`) keep working without changes.
//
// Worker responsibilities:
//   1. Build the system prompt for the subtask's role.
//   2. Run the ReAct loop: think → maybe call tools (in parallel) →
//      feed results → continue.
//   3. Detect loop-degeneration (same tool+params attempted 3+ times)
//      and break out, asking the model for a final answer with what
//      it has so far (Kimi/Trilogy production post-mortem mitigation).
//   4. Emit `agent_token` / `agent_tool` / `agent_result` / `agent_done`
//      events to the SSE stream.
//
// The orchestration (plan → fan-out workers → synthesize) lives in
// `swarm/orchestrator.ts`. The dynamic subagent API (createSubagent /
// assignTask) lives in `swarm.ts` because it owns the process-local
// subagent registry.

import crypto from "crypto";
import { getLLM, type LLMMessage } from "../llm-provider";
import {
  detectToolCall,
  executeToolCall,
  getToolsDescription,
  type ToolCall,
} from "../agent-tools";
import { logger } from "../logger";
import { MAX_TOOL_ITERATIONS } from "../swarm-constants";
import type { Subtask, SwarmEventEmitter } from "./types";
import { ROLE_PROMPTS, ROLE_TOOLS } from "./roles";

// Kimi/Trilogy loop-degeneration detection (Trilogy AI production
// post-mortem): when a tool keeps failing, the model can enter a
// degenerate retry loop — e.g. 3 consecutive `exec` calls with
// `{"command":""}` after a script-not-found error. The model does not
// recover, it degrades.
//
// Mitigation: track (tool + JSON.stringify(params)) and break the loop
// after the same call is attempted LOOP_DETECTION_THRESHOLD times.
export const LOOP_DETECTION_THRESHOLD = 3;

// Kimi §2.6: the model can return multiple tool_calls in one assistant
// message and they should run in parallel. We cap the per-message fan-out
// to avoid pathological cases (model emits 50 search calls at once and
// trips the rate limiter before any can complete).
export const MAX_PARALLEL_TOOL_CALLS = 4;

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
export function detectToolCalls(response: string): ToolCall[] {
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
export function stableStringify(obj: unknown): string {
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
export function hashToolCall(call: ToolCall): string {
  const stable = stableStringify(call.params);
  return crypto.createHash("sha256").update(`${call.tool}:${stable}`).digest("hex");
}

/**
 * Execute a single subtask in the swarm.
 *
 * ReAct loop: think → maybe call tools (in parallel) → feed results →
 * continue. Emits `agent_token` (every LLM token), `agent_tool`
 * (before each tool call), `agent_result` (after each tool call), and
 * (via the orchestrator) `agent_done` when the worker finishes.
 *
 * Loop-degeneration guard: if any single (tool, params) tuple is
 * attempted LOOP_DETECTION_THRESHOLD (3) times, the loop breaks and
 * the model is asked for a final answer with what it has so far.
 *
 * @param subtask  the subtask to execute (id + description + role).
 * @param context  the overall task description (passed as "Context"
 *                 in the system prompt — gives the worker visibility
 *                 into what the orchestrator is trying to achieve).
 * @param emit     the SSE event emitter. The orchestrator wraps this
 *                 with a timeout + cancellation check.
 * @returns the worker's final text output (the assistant's last
 *          message — either a direct response or a summary after the
 *          ReAct loop terminates).
 */
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
