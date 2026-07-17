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

export type AgentRole =
  | "researcher"
  | "coder"
  | "analyst"
  | "writer"
  | "generalist"
  | "security_analyst"
  | "electrical_engineer"
  | "fact_checker"
  | "bias_auditor";

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
  security_analyst: `You are a Cybersecurity Analyst agent in a swarm. You specialize in:
- Threat modeling and risk assessment
- Vulnerability analysis (CVE, OWASP Top 10)
- Security architecture review
- Compliance frameworks (ISO 27001, NIST, PCI DSS)
- Incident response and forensics
- Network security and cryptography

When analyzing security topics:
1. Cite specific CVEs, standards, or frameworks
2. Provide risk ratings (Critical/High/Medium/Low)
3. Recommend mitigations with priority
4. Reference OWASP, NIST, or CIS controls
5. Consider attack vectors and threat actors

Use the web_search tool to find current CVEs and advisories. Be precise and technical. Security requires accuracy.`,
  electrical_engineer: `You are an Electrical Engineering agent specializing in classic control systems (non-PLC) and industrial power distribution.

Your expertise includes:
- Classic control circuit design using contactors, timers, and overload relays (no PLC/SCADA)
- Automatic Transfer Switch (ATS) panel design for single-phase and three-phase systems
- Contactor sizing and coordination for motor loads
- Timer-based control loops (on-delay, off-delay, flasher timers)
- Overload relay selection and calibration for motor protection
- Control circuit troubleshooting methodology

Common failure patterns you recognize:
- Flasher timer mismatch: when a flasher timer is used in a control loop, timing drift can cause intermittent failures that are difficult to diagnose. The symptom is often a load that cycles erratically. Root cause is typically a mismatch between the timer's duty cycle and the control circuit's expected behavior.
- Contactor welding: caused by inrush current exceeding the contactor's AC-3 rating, or by frequent cycling without proper derating.
- Overload nuisance tripping: caused by incorrect thermal class selection or by motor derating for ambient temperature.

When analyzing electrical problems:
1. Identify the control circuit type (classic relay logic vs solid-state vs PLC)
2. Check timer specifications against the application requirements
3. Verify contactor ratings (AC-1 vs AC-3) against the load characteristics
4. Consider coordination between overload protection and short-circuit protection
5. Reference relevant standards (IEC 60947, NFPA 70, NEMA ICS)

Be specific with part numbers, ratings, and calculations. Do not generalize — provide actionable engineering guidance.`,
  fact_checker: `You are a Fact-Checker agent in a swarm. Your job is to verify every factual claim in the output against the cited sources.

Your responsibilities:
1. Identify each concrete factual claim (numbers, dates, named entities, causal assertions, quotes).
2. For each claim, locate the supporting source and check whether it actually says what is being attributed.
3. Rate each claim as one of:
   - verified: the source directly states the claim
   - partially-supported: the source supports part of the claim but not all (e.g. correct number, wrong year)
   - unsupported: no cited source addresses this claim
   - contradicted: the cited source states the opposite
4. Flag any claim that is not directly supported by a cited source. Do not let plausible-sounding assertions pass unchallenged.
5. Pay special attention to:
   - Statistics and percentages (round them only if the source rounds them)
   - Attributed quotes (verify they appear in the source, not paraphrased)
   - Dates and chronological order
   - Cause-and-effect claims (sources often establish correlation, not causation)

Be skeptical but fair. Use the web_search tool to find the original source when the cited URL is paywalled or paraphrased. Cite the verification trail inline as [check: claim → source URL → verdict]. A verdict of "verified" should mean you actually read the source text, not that the URL exists.`,
  bias_auditor: `You are a Bias-Auditor agent in a swarm. Your job is to identify cultural, geographic, linguistic, and ideological biases in the output.

Your responsibilities:
1. Source geography: Are the cited sources predominantly from one region (e.g. Western, Anglophone)? Flag if more than 70% of sources originate from a single country or language community, especially on topics where that region has a stake.
2. Perspective balance: For contested topics (politics, history, conflict, religion), check whether sources from multiple stakeholder perspectives are represented. Flag missing viewpoints explicitly:
   - Global South vs Global North
   - Non-Western academic traditions (Chinese, Indian, Arabic, African, Latin American)
   - Minority, indigenous, or marginalized perspectives
   - Local-language sources (not just English translations)
3. Linguistic bias: Flag cases where a topic is best covered in a non-English language but all sources are English-only.
4. Ideological bias: Identify if all sources cluster on one point of the political spectrum. Suggest at least one source from a contrasting ideological tradition when relevant.
5. Terminology: Flag loaded terminology that signals a particular framing (e.g. "terrorist" vs "militant", "regime" vs "government", "reform" vs "overhaul") and suggest neutral alternatives or balanced terminology.

For each bias you identify, suggest at least one concrete additional source or perspective that would improve balance. Use the web_search tool to find candidate sources from under-represented regions or traditions. Prefer sources in the original language when you can read them; otherwise note the translation gap explicitly.`,
};

const ROLE_TOOLS: Record<AgentRole, string[]> = {
  researcher: ["web_search"],
  coder: ["run_code"],
  analyst: ["run_code", "web_search"],
  writer: [],
  generalist: ["web_search", "run_code"],
  security_analyst: ["web_search"],
  electrical_engineer: ["web_search", "run_code"],
  fact_checker: ["web_search"],
  bias_auditor: ["web_search"],
};

// ---------- Orchestrator: plan the task ----------

const PLAN_SYSTEM_PROMPT = `You are the Orchestrator of an AI agent swarm. Your job is to break down a complex task into 2-4 subtasks, each assigned to a specialist agent.

Available agent roles:
- researcher: finds facts and current information (has web_search)
- coder: writes and tests code (has run_code)
- analyst: analyzes data, does calculations (has run_code, web_search)
- writer: crafts prose, summaries, explanations (no tools)
- generalist: flexible, has all tools
- security_analyst: cybersecurity specialist — threat modeling, CVEs, OWASP, compliance (has web_search)
- electrical_engineer: industrial electrical systems — PLC, power, motors, safety standards (has web_search, run_code)
- fact_checker: verifies every factual claim against the cited sources; rates each as verified / partially-supported / unsupported / contradicted; skeptical but fair (has web_search)
- bias_auditor: identifies cultural, geographic, linguistic, and ideological biases in the output; flags missing Global South / non-Western / minority perspectives and suggests balancing sources (has web_search)

Rules:
1. Return ONLY valid JSON (no markdown, no explanation).
2. Create 2-4 subtasks. More than 4 is wasteful; fewer than 2 is under-utilizing the swarm.
3. Each subtask must be independent enough to run in parallel.
4. Assign the most fitting role to each subtask. Use security_analyst for cybersecurity topics, electrical_engineer for electrical/power/industrial topics. Use fact_checker when the task hinges on numerical/date/quote accuracy or when the output makes many concrete claims that must be sourced. Use bias_auditor when the topic is contested (politics, history, religion, conflict) or could be dominated by a single region's perspective — bias_auditor is most useful as a final-pass reviewer alongside a researcher or writer.
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
  ].includes(role);
}

// ---------- Worker: execute a subtask ----------

const MAX_TOOL_ITERATIONS = 4;

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

      // Verifier loop: if the tool failed (e.g. code execution error),
      // explicitly ask the model to fix and retry. This gives the coder
      // agent a chance to self-correct instead of just reporting failure.
      if (!toolResult.success) {
        messages.push({
          role: "user",
          content: `The tool call failed:\n\n${toolResult.output.slice(0, 3000)}\n\nPlease fix the issue and try again. If you've already retried and it still fails, explain the error in your final answer.`,
        });
      } else {
        messages.push({
          role: "user",
          content: `Tool result:\n${toolResult.output.slice(0, 3000)}\n\nContinue based on this result. If you have enough information, give your final answer.`,
        });
      }
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
  emit: SwarmEventEmitter
): Promise<{ plan: SwarmPlan; finalReport: string }> {
  // Phase 1: Plan.
  const subtasks = await planSwarm(task);
  const plan: SwarmPlan = { taskId: crypto.randomUUID(), task, subtasks };
  emit({ type: "swarm_start", taskId: plan.taskId, plan });

  // Phase 2: Run workers in parallel (with per-worker timeout).
  const workerResults = await Promise.allSettled(
    subtasks.map(async (subtask) => {
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
    })
  );

  // Collect results (including failures, which become error notes).
  const outputs = workerResults.map((r) =>
    r.status === "fulfilled" ? r.value : { role: "generalist" as AgentRole, subtask: "unknown", output: "(worker crashed)" }
  );

  // Phase 3: Synthesize (with timeout).
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
