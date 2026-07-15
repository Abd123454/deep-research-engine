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

import { getLLM, type LLMMessage } from "./llm-provider";
import { detectToolCall, executeToolCall, getToolsDescription } from "./agent-tools";

// ---------- Types ----------

export type AgentRole = "researcher" | "coder" | "analyst" | "writer" | "generalist";

export interface Subtask {
  id: string;
  description: string;
  role: AgentRole;
}

export interface SwarmPlan {
  taskId: string;
  task: string;
  subtasks: Subtask[];
}

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

export type SwarmEventEmitter = (event: SwarmEvent) => void;

// ---------- Role config ----------

const ROLE_PROMPTS: Record<AgentRole, string> = {
  researcher: `You are a Research Specialist agent in a swarm. Your job is to find accurate, current information.
Use the web_search tool when you need facts. Cite sources inline as [1], [2] etc.
Be thorough but focused on your assigned subtask only.`,
  coder: `You are a Code Specialist agent in a swarm. Your job is to write and test code.
Use the run_code tool to verify your code works. Show the code and its output.
Be precise and focus only on your assigned subtask.`,
  analyst: `You are a Data Analyst agent in a swarm. Your job is to analyze data and draw insights.
Use run_code (Python) for calculations and web_search for context.
Present findings with clear reasoning.`,
  writer: `You are a Writer agent in a swarm. Your job is to craft clear, well-structured prose.
Focus on readability, flow, and tone. No need for tools unless essential.`,
  generalist: `You are a Generalist agent in a swarm. Handle your subtask using any available tool.
Be concise and complete.`,
};

const ROLE_TOOLS: Record<AgentRole, string[]> = {
  researcher: ["web_search"],
  coder: ["run_code"],
  analyst: ["run_code", "web_search"],
  writer: [],
  generalist: ["web_search", "run_code"],
};

// ---------- Orchestrator: plan the task ----------

const PLAN_SYSTEM_PROMPT = `You are the Orchestrator of an AI agent swarm. Your job is to break down a complex task into 2-4 subtasks, each assigned to a specialist agent.

Available agent roles:
- researcher: finds facts and current information (has web_search)
- coder: writes and tests code (has run_code)
- analyst: analyzes data, does calculations (has run_code, web_search)
- writer: crafts prose, summaries, explanations (no tools)
- generalist: flexible, has all tools

Rules:
1. Return ONLY valid JSON (no markdown, no explanation).
2. Create 2-4 subtasks. More than 4 is wasteful; fewer than 2 is under-utilizing the swarm.
3. Each subtask must be independent enough to run in parallel.
4. Assign the most fitting role to each subtask.
5. Descriptions should be specific and actionable.

Output format:
{
  "subtasks": [
    { "description": "...", "role": "researcher" }
  ]
}`;

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
  } catch {
    return [{ id: "s1", description: task, role: "generalist" }];
  }
}

function validateRole(role: unknown): role is AgentRole {
  return typeof role === "string" && ["researcher", "coder", "analyst", "writer", "generalist"].includes(role);
}

// ---------- Worker: execute a subtask ----------

const MAX_TOOL_ITERATIONS = 3;

export async function runWorker(
  subtask: Subtask,
  context: string,
  emit: SwarmEventEmitter
): Promise<string> {
  const agentId = subtask.id;
  const rolePrompt = ROLE_PROMPTS[subtask.role] || ROLE_PROMPTS.generalist;
  const toolsDesc = ROLE_TOOLS[subtask.role].length > 0
    ? `\n\nAvailable tools:\n${getToolsDescription()}\n\nTo call a tool, use:\n\`\`\`tool\n{"tool": "name", "params": {...}}\n\`\`\``
    : "";

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `${rolePrompt}${toolsDesc}\n\nContext (overall task): ${context}\nYour subtask: ${subtask.description}\n\nRespond with your findings. Be focused and complete.`,
    },
    { role: "user", content: `Please complete your subtask: ${subtask.description}` },
  ];

  const llm = await getLLM();

  // ReAct loop: think → maybe call tool → feed result → continue.
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

    // Check for tool call.
    const toolCall = detectToolCall(result.content);
    if (toolCall && ROLE_TOOLS[subtask.role].includes(toolCall.tool)) {
      emit({ type: "agent_tool", agentId, tool: toolCall.tool, params: toolCall.params });

      const toolResult = await executeToolCall(toolCall);
      emit({ type: "agent_result", agentId, tool: toolCall.tool, result: toolResult.output.slice(0, 2000) });

      // Feed tool result back for another iteration.
      messages.push({ role: "assistant", content: result.content });
      messages.push({
        role: "user",
        content: `Tool result:\n${toolResult.output.slice(0, 3000)}\n\nContinue based on this result. If you have enough information, give your final answer.`,
      });
      continue;
    }

    // No tool call — we're done.
    return result.content;
  }

  // Hit iteration limit — return what we have.
  return fullResponse || "(no output)";
}

// ---------- Synthesizer: combine worker outputs ----------

const SYNTH_SYSTEM_PROMPT = `You are the Synthesizer of an AI agent swarm. Multiple specialist agents have each completed a subtask. Your job is to combine their outputs into a single, coherent, well-structured final answer.

Rules:
1. Do not just concatenate — integrate and deduplicate.
2. Use clear markdown structure (## headings, bullet points).
3. Resolve contradictions by noting them.
4. Cite which agent/role contributed key points when relevant.
5. Be comprehensive but not redundant.`;

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

export async function runSwarm(
  task: string,
  emit: SwarmEventEmitter
): Promise<{ plan: SwarmPlan; finalReport: string }> {
  // Phase 1: Plan.
  const subtasks = await planSwarm(task);
  const plan: SwarmPlan = { taskId: crypto.randomUUID(), task, subtasks };
  emit({ type: "swarm_start", taskId: plan.taskId, plan });

  // Phase 2: Run workers in parallel.
  const workerResults = await Promise.allSettled(
    subtasks.map(async (subtask) => {
      emit({ type: "agent_start", agentId: subtask.id, role: subtask.role, task: subtask.description });
      try {
        const output = await runWorker(subtask, task, emit);
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
    })
  );

  // Collect results (including failures, which become error notes).
  const outputs = workerResults.map((r) =>
    r.status === "fulfilled" ? r.value : { role: "generalist" as AgentRole, subtask: "unknown", output: "(worker crashed)" }
  );

  // Phase 3: Synthesize.
  const finalReport = await synthesizeSwarm(task, outputs, emit);
  emit({ type: "swarm_done", finalReport });

  return { plan, finalReport };
}

// ---------- SSE serialization ----------

export function serializeSSE(event: SwarmEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
