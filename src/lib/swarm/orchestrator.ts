// Quaesitor — Agent Swarm orchestrator module.
//
// Extracted from `src/lib/swarm.ts` as part of the god-object
// refactoring pass (final-10 task). The original file was 742 lines;
// moving the orchestrator (planSwarm) + synthesizer (synthesizeSwarm)
// + their helpers here keeps `swarm.ts` focused on the `runSwarm`
// entry point + the dynamic subagent API.
//
// MOVE ONLY — these functions + constants are byte-for-byte identical
// to the ones that were inline in `swarm.ts`. The only change is the
// file they live in. Public surface (`planSwarm`, `synthesizeSwarm`)
// is re-exported from `swarm.ts` so existing callers keep working
// without changes.
//
// Orchestrator responsibilities:
//   1. `planSwarm(task)` — ask the LLM to break the task into 2-4
//      subtasks, each assigned a specialist role. Returns the subtask
//      array (with fallback to a single generalist on malformed JSON).
//   2. `synthesizeSwarm(task, workerOutputs, emit)` — combine the
//      parallel worker outputs into a single coherent final answer.
//      Emits `synth_start` + `synth_token` events as it streams the
//      synthesis.
//
// The `runSwarm` entry point that wires plan → workers → synth lives
// in `swarm.ts` because it owns the per-run state (taskId, signal,
// cancellation checks) and the worker fan-out (`runWithConcurrency`).
// The dynamic subagent API (`createSubagent`, `assignTask`) also
// lives there because it owns the process-local subagent registry.

import { getLLM, type LLMMessage } from "../llm-provider";
import { logger } from "../logger";
import type {
  AgentRole,
  Subtask,
  SwarmEventEmitter,
} from "./types";
import {
  PLAN_SYSTEM_PROMPT,
  SYNTH_SYSTEM_PROMPT,
} from "./roles";

/**
 * Validate that a string is a known `AgentRole`. Used by `planSwarm`
 * to filter LLM-returned role strings — unknown roles fall back to
 * `"generalist"` rather than producing a runtime type error.
 */
export function validateRole(role: unknown): role is AgentRole {
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

/**
 * Plan a swarm: ask the LLM to break the task into 2-4 subtasks, each
 * assigned a specialist role.
 *
 * Returns the subtask array. Falls back to a single generalist if the
 * LLM returns malformed JSON or an empty subtask list — the swarm
 * still produces output in that case (one worker handles the whole
 * task). Robust to markdown fences around the JSON.
 *
 * @param task the user's task description.
 * @returns 1-4 subtasks (id + description + role).
 */
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

/**
 * Synthesize the final report from the parallel worker outputs.
 *
 * Streams the synthesis token-by-token (emits `synth_start` once +
 * `synth_token` per token). The LLM is given a system prompt that
 * instructs it to integrate (not concatenate), deduplicate, resolve
 * contradictions, and cite which agent contributed which point.
 *
 * @param task           the original user task.
 * @param workerOutputs  the parallel worker results (role + subtask + output).
 * @param emit           the SSE event emitter.
 * @returns the final synthesized report (full text).
 */
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

// ---------- Timeout helper (used by runSwarm in swarm.ts) ----------

/** Wrap a promise with a timeout. Returns the result or throws on timeout. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

// Per-phase timeout budgets. Exported so `runSwarm` (in `swarm.ts`) can
// use them without duplicating the values, and so tests can assert the
// expected budget if needed.
export const WORKER_TIMEOUT_MS = 90_000; // 90s per worker
export const SYNTH_TIMEOUT_MS = 120_000; // 120s for synthesis
