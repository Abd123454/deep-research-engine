// Deep Research Engine - Core Types

export type ResearchStatus =
  | "queued"
  | "decomposing"
  | "searching"
  | "reading"
  | "extracting"
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
  publishedTime?: string;
  excerpt?: string;
  tokensUsed?: number;
  wordCount?: number;
}

export interface SubQuery {
  id: string;
  question: string;
  status: SubQueryStatus;
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
