// Deep Research Engine - Core Types
//
// The pipeline is designed to surpass single-round research tools by adding:
//   1. A research PLAN (structured outline generated up-front, Gemini-style).
//   2. GAP ANALYSIS after round 1 — the agent reviews findings and identifies
//      what's missing, then generates follow-up questions.
//   3. A SECOND RESEARCH ROUND to fill the gaps.
//   4. Final SYNTHESIS that follows the plan's outline.

export type ResearchStatus =
  | "queued"
  | "planning"
  | "decomposing"
  | "searching"
  | "reading"
  | "extracting"
  | "analyzing_gaps"
  | "synthesizing"
  | "completed"
  | "failed";

export type SubQueryStatus =
  | "pending"
  | "searching"
  | "reading"
  | "extracting"
  | "done"
  | "failed";

export type SubQueryRound = 1 | 2;

export type SearchDepth = "standard" | "deep" | "advanced";

export type RetrieverType = "zai" | "tavily" | "duckduckgo";

export type LLMProvider = "zai" | "nvidia";

export interface ResearchConfig {
  query: string;
  depth: SearchDepth;
  numSubQueries: number;
  maxLinksPerQuery: number;
  pageReadConcurrency: number;
  reportMaxTokens: number;
  retriever: RetrieverType;
  llmProvider: LLMProvider;
  // Multi-round research (the key differentiator vs. single-round tools).
  enableMultiRound: boolean;
  // How many gap-filling sub-queries to generate in round 2.
  numGapQueries: number;
}

// A planned section of the final report (Gemini-style research plan).
export interface PlanSection {
  id: string;
  title: string;
  description: string;
}

export interface ResearchPlan {
  title: string;
  summary: string;
  sections: PlanSection[];
}

export interface SearchResultItem {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  rank: number;
  date: string;
  favicon: string;
}

export interface PageReadResult {
  url: string;
  title: string;
  text: string;
  publishedTime?: string;
  success: boolean;
  error?: string;
  tokensUsed: number;
  wordCount: number;
}

export interface Source {
  url: string;
  title: string;
  host: string;
  snippet: string;
  subQueryId: string;
  round: SubQueryRound;
  publishedTime?: string;
  excerpt?: string;
  tokensUsed?: number;
  wordCount?: number;
}

export interface SubQuery {
  id: string;
  question: string;
  status: SubQueryStatus;
  round: SubQueryRound;
  // For round-2 sub-queries, the gap they're meant to fill.
  rationale?: string;
  searchResults: SearchResultItem[];
  pagesRead: number;
  pagesSucceeded: number;
  keyFindings: string;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export interface LogEntry {
  ts: number;
  level: "info" | "warn" | "error" | "success";
  stage: ResearchStatus;
  message: string;
}

export interface ResearchStats {
  totalPagesFound: number;
  totalPagesRead: number;
  totalPagesSucceeded: number;
  totalTokensUsed: number;
  elapsedMs: number;
  subQueriesCompleted: number;
  roundsCompleted: number;
}

export interface ResearchJob {
  id: string;
  query: string;
  status: ResearchStatus;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
  config: ResearchConfig;
  plan: ResearchPlan | null;
  gapAnalysis: string | null;
  subQueries: SubQuery[];
  sources: Source[];
  report: string | null;
  logs: LogEntry[];
  error: string | null;
  stats: ResearchStats;
}

// Public-facing shape (sent to the client). Strips large text fields if needed.
export type ResearchJobPublic = Omit<ResearchJob, "logs"> & {
  logs: LogEntry[];
};

export function toPublicJob(job: ResearchJob): ResearchJobPublic {
  return { ...job };
}
