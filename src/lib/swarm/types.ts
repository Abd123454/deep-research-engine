// Quaesitor — Agent Swarm types.
//
// Extracted from `src/lib/swarm.ts` as part of the god-object
// refactoring pass (final-cleanup task). The original file was 936 lines;
// moving the type definitions here keeps `swarm.ts` focused on the
// orchestration + worker + synthesizer logic.
//
// MOVE ONLY — these type definitions are byte-for-byte identical to the
// ones that were inline in `swarm.ts`. The only change is the file they
// live in.

/**
 * The set of specialist agent roles a swarm worker can take on.
 *
 * - `researcher`           — finds facts and current information (web_search)
 * - `coder`                — writes and tests code (run_code)
 * - `analyst`              — analyzes data, does calculations (run_code, web_search)
 * - `writer`               — crafts prose, summaries, explanations (no tools)
 * - `generalist`           — flexible, has all tools
 * - `security_analyst`     — cybersecurity specialist (threat modeling, CVEs, OWASP, compliance)
 * - `electrical_engineer`  — industrial electrical systems (control circuits, ATS, contactors, motors)
 * - `fact_checker`         — verifies every factual claim against the cited sources
 * - `bias_auditor`         — identifies cultural, geographic, linguistic, and ideological biases
 * - `device_controller`    — manages the user's device across Win/macOS/Linux
 */
export type AgentRole =
  | "researcher"
  | "coder"
  | "analyst"
  | "writer"
  | "generalist"
  | "security_analyst"
  | "electrical_engineer"
  | "fact_checker"
  | "bias_auditor"
  | "device_controller";

/**
 * A single subtask assigned to one worker in the swarm.
 *
 * The orchestrator's `planSwarm()` produces an array of these; each is
 * dispatched to a worker via `runWorker()`.
 */
export interface Subtask {
  id: string;
  description: string;
  role: AgentRole;
}

/**
 * The full plan for a swarm run — the original task plus the subtasks
 * the orchestrator decomposed it into.
 */
export interface SwarmPlan {
  taskId: string;
  task: string;
  subtasks: Subtask[];
}

/**
 * A real-time event streamed from the swarm to the client (over SSE).
 *
 * Discriminated union — the `type` field selects the shape of the
 * remaining fields:
 *
 *   - `swarm_start`   → { taskId, plan: SwarmPlan }
 *   - `agent_start`   → { agentId, role, task }
 *   - `agent_token`   → { agentId, token }
 *   - `agent_tool`    → { agentId, tool, params }
 *   - `agent_result`  → { agentId, tool, result }
 *   - `agent_done`    → { agentId, error? }
 *   - `synth_start`   → (no extra fields)
 *   - `synth_token`   → { token }
 *   - `swarm_done`    → { finalReport }
 *   - `error`         → { message }
 */
export interface SwarmEvent {
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
  [key: string]: unknown;
}

/**
 * Callback signature for emitting swarm events to the client.
 *
 * The swarm runtime calls this with each `SwarmEvent` as the run
 * progresses; the caller is responsible for serializing it to SSE
 * (see `serializeSSE()`) and writing it to the HTTP response.
 */
export type SwarmEventEmitter = (event: SwarmEvent) => void;

/**
 * A dynamically-created subagent (Kimi K2.5 two-tool swarm pattern).
 *
 * Mirrors `create_subagent(name, system_prompt)` from Kimi K2.5
 * (Appendix E.8 of arXiv:2602.02276v1). The orchestrator can spawn
 * specialized subagents at runtime and assign them tasks via
 * `assignTask()`, rather than relying solely on the static
 * `planSwarm()` output.
 */
export interface Subagent {
  id: string;
  name: string;
  role: AgentRole;
  systemPrompt: string;
  createdAt: number;
}

/**
 * Options for `runSwarm()`.
 */
export interface RunSwarmOptions {
  /**
   * The user invoking the swarm. Used for per-user isolation of any
   * memory recall / tool execution performed by swarm workers, and
   * for plan-limit attribution. When omitted, the swarm runs in
   * "legacy" mode with no per-user scoping (kept for backward
   * compatibility with the existing tests and the eval runner).
   */
  userId?: string;
  /**
   * Cooperative-cancellation signal. When the caller aborts (e.g. the
   * HTTP client closed the SSE stream), the swarm checks `signal.aborted`
   * between phases and short-circuits. The signal is also forwarded
   * to LLM calls that opt into supporting it (currently none — the
   * `LLMCompletionOptions` interface does not yet accept `signal` —
   * but the field is plumbed through so future LLM provider changes
   * can wire it up without touching the swarm layer again).
   */
  signal?: AbortSignal;
}
