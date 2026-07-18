// Shared constants for the swarm + ReAct agent loops.
//
// WHY THIS FILE EXISTS:
// The intensive audit (task fix-5-p0, P0-2) flagged that `MAX_TOOL_ITERATIONS`
// had drifted between the swarm (`src/lib/swarm.ts` → 15) and the chat agent
// route (`src/app/api/chat/agent/route.ts` → 5). The two values must agree:
// a swarm worker spawned from a chat turn should get the same iteration
// budget whether it's invoked via /api/swarm or /api/chat/agent.
//
// Centralizing the constant here means future agents can't silently
// re-diverge — there's exactly one source of truth.
//
// VALUE: 15
// Rationale (from swarm.ts):
//   Kimi K2.5/K2.6 production trajectories do 50–300 sequential tool calls
//   per subagent (K2 Thinking blog). The old cap of 4 was wildly
//   conservative and caused timeouts where the agent ran out of iteration
//   budget before completing even a single research loop.
//
//   15 is a middle ground: high enough to let a researcher do 3–5
//   search → read → extract cycles, low enough to stay within the
//   90s worker timeout. Kimi-Researcher averages 23 reasoning steps +
//   70 search queries; we are not in that league, but 4 was clearly
//   too low.
//
// If you change this value, update the test in
// `src/lib/__tests__/verifier-loop.test.ts` that references the budget.

export const MAX_TOOL_ITERATIONS = 15;
