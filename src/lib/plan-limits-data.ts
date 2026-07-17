// Plan limits data — pure constants and types, safe for client-side import.
// This file has NO server-only imports (no db, no prisma, no fs).
// Client components (PricingCalculator, dashboard) import from here.
// Server-side functions (getPlanForUser, checkLimit) live in plan-limits.ts.

export type Plan = "free" | "pro" | "team" | "enterprise";

export interface PlanLimit {
  /** Max deep-research jobs started per calendar month. */
  monthlyResearch: number;
  /** Max chat messages sent per calendar month. */
  monthlyChatMessages: number;
  /** Max research jobs running concurrently for one user. */
  maxConcurrentJobs: number;
  /** Max single file upload size (MB). */
  maxFileUploadMB: number;
  /** Max agents in an agent-swarm job. */
  swarmAgents: number;
  /** Whether the user can define custom long-term memories. */
  customMemory: boolean;
  /** Whether priority support SLA applies. */
  prioritySupport: boolean;
  /** Whether MFA is available for the account. */
  mfa: boolean;
  /** Human-readable plan name. */
  label: string;
  /** Price in USD per month (0 for Free, 499 for Enterprise baseline). */
  priceMonthly: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimit> = {
  free: {
    monthlyResearch: 10,
    monthlyChatMessages: 500,
    maxConcurrentJobs: 1,
    maxFileUploadMB: 5,
    swarmAgents: 2,
    customMemory: false,
    prioritySupport: false,
    mfa: false,
    label: "Free",
    priceMonthly: 0,
  },
  pro: {
    monthlyResearch: 100,
    monthlyChatMessages: 5000,
    maxConcurrentJobs: 3,
    maxFileUploadMB: 25,
    swarmAgents: 5,
    customMemory: true,
    prioritySupport: false,
    mfa: true,
    label: "Pro",
    priceMonthly: 19,
  },
  team: {
    monthlyResearch: 500,
    monthlyChatMessages: 25000,
    maxConcurrentJobs: 10,
    maxFileUploadMB: 50,
    swarmAgents: 9,
    customMemory: true,
    prioritySupport: true,
    mfa: true,
    label: "Team",
    priceMonthly: 99,
  },
  enterprise: {
    monthlyResearch: Infinity,
    monthlyChatMessages: Infinity,
    maxConcurrentJobs: Infinity,
    maxFileUploadMB: 100,
    swarmAgents: 9,
    customMemory: true,
    prioritySupport: true,
    mfa: true,
    label: "Enterprise",
    priceMonthly: 499,
  },
};

/**
 * Recommend a plan based on usage estimates.
 * Pure function — safe for client-side use (pricing calculator).
 */
export function recommendPlan(params: {
  monthlyResearch: number;
  monthlyChatMessages: number;
  prioritySupport?: boolean;
  localInference?: boolean;
}): Plan {
  const { monthlyResearch, monthlyChatMessages, prioritySupport } = params;
  if (monthlyResearch > 500 || monthlyChatMessages > 25000 || prioritySupport) {
    return "team";
  }
  if (monthlyResearch > 100 || monthlyChatMessages > 5000) {
    return "pro";
  }
  return "free";
}
