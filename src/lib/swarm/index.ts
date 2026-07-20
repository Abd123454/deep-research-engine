// Quaesitor — Agent Swarm barrel.
//
// Re-exports the public surface of the agent swarm module so callers
// can import everything from a single entry point:
//
//   import {
//     runSwarm,
//     planSwarm,
//     runWorker,
//     synthesizeSwarm,
//     createSubagent,
//     assignTask,
//     serializeSSE,
//     type AgentRole,
//     type SwarmEvent,
//     type SwarmEventEmitter,
//     type Subtask,
//     type SwarmPlan,
//     type Subagent,
//     type RunSwarmOptions,
//     ROLE_PROMPTS,
//     ROLE_TOOLS,
//     PLAN_SYSTEM_PROMPT,
//     SYNTH_SYSTEM_PROMPT,
//   } from "@/lib/swarm";
//
// This module is part of the god-object refactoring pass
// (final-cleanup task). The actual orchestration logic still lives in
// `src/lib/swarm.ts` — this file is a thin re-export layer that exposes
// the types + role constants + main entry points in one place. No logic
// is duplicated.

// Types (re-exported from `./types`).
export type {
  AgentRole,
  Subtask,
  SwarmPlan,
  SwarmEvent,
  SwarmEventEmitter,
  Subagent,
  RunSwarmOptions,
} from "./types";

// Role definitions + prompts (re-exported from `./roles`).
export {
  ROLE_PROMPTS,
  ROLE_TOOLS,
  PLAN_SYSTEM_PROMPT,
  SYNTH_SYSTEM_PROMPT,
} from "./roles";

// Pipeline entry points + helpers. Re-exported from the original
// `swarm.ts` — the functions themselves were NOT moved (the orchestration
// logic is too tightly coupled to extract safely; the audit allowed the
// MINIMUM split of types + role constants only).
export {
  planSwarm,
  runWorker,
  synthesizeSwarm,
  runSwarm,
  serializeSSE,
  createSubagent,
  assignTask,
  getSubagent,
  listSubagents,
  clearSubagents,
  MAX_TOOL_ITERATIONS,
} from "../swarm";
