"use client";

// Dashboard — usage + plan + carbon footprint + quick links.
//
// Commercial #3 — surfaces:
//   - Current plan badge (Free / Pro / Team / Enterprise)
//   - Usage this month: research count, chat count, tokens used
//   - Carbon footprint this month (from the carbon-footprint lib + dashboard
//     stats endpoint)
//   - Quick links: billing portal, API keys, settings (privacy + memory)
//
// Design: warm Quaesitor cards (`bg-[#faf8f3]` / `dark:bg-[#252220]`,
// `border-[#d9d4c7]` / `dark:border-[#3d3830]`), `font-body` (Newsreader)
// for prose content + numbers, `font-ui` (DM Sans) for chrome (labels,
// buttons, badges). No box-shadow, no gradient (per DESIGN.md).

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  Key,
  CreditCard,
  TrendingUp,
  Leaf,
  Settings,
  Brain,
  ChevronRight,
} from "lucide-react";
import { formatCarbon } from "@/lib/carbon-footprint";
import { PLAN_LIMITS, type Plan } from "@/lib/plan-limits-data";

interface Stats {
  plan: Plan;
  planName: string;
  usage: {
    research: { remaining: number; limit: number };
    chat: { remaining: number; limit: number };
    tokens: { remaining: number; limit: number };
  };
  features: string[];
  recentActivity: Array<{ id: string; query: string; status: string; createdAt: string }>;
  // Optional fields added by the Commercial #3 dashboard expansion.
  // Older `/api/dashboard/stats` responses may not include them — we use
  // `??` + `?.` so the page degrades gracefully.
  usageThisMonth?: {
    researchCount: number;
    chatCount: number;
    tokensUsed: number;
  };
  carbon?: {
    grams: number;
    source: string;
    local?: boolean;
  };
}

const PLAN_BADGE_STYLES: Record<Plan, string> = {
  free:
    "bg-[#e0d9c8] dark:bg-[#322e28] text-[#2a2620] dark:text-[#e8e3d8] border-[#d9d4c7] dark:border-[#3d3830]",
  pro: "bg-[#8b4513]/10 dark:bg-[#b5673a]/10 text-[#8b4513] dark:text-[#b5673a] border-[#8b4513]/30 dark:border-[#b5673a]/30",
  team: "bg-[#8b4513]/15 dark:bg-[#b5673a]/15 text-[#8b4513] dark:text-[#b5673a] border-[#8b4513]/40 dark:border-[#b5673a]/40",
  enterprise:
    "bg-[#8b4513] dark:bg-[#b5673a] text-[#faf8f3] border-transparent",
};

export default function DashboardPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/dashboard/stats")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Stats>;
      })
      .then(setStats)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f4f1ea] dark:bg-[#1c1a17] font-body text-lg text-[#6b6358] dark:text-[#9a9080]">
        Loading dashboard…
      </div>
    );
  }
  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f1ea] dark:bg-[#1c1a17] px-6 text-center">
        <p className="font-body text-lg text-[#a33a3a] mb-2">Failed to load dashboard</p>
        <p className="font-ui text-sm text-[#6b6358] dark:text-[#9a9080]">{error ?? "Unknown error"}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg border border-[#d9d4c7] dark:border-[#3d3830] px-4 py-2 font-ui text-sm hover:bg-[#e0d9c8] dark:hover:bg-[#322e28] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const planLimit = PLAN_LIMITS[stats.plan] ?? PLAN_LIMITS.free;
  const usageMonth = stats.usageThisMonth ?? {
    researchCount: stats.usage.research.limit - stats.usage.research.remaining,
    chatCount: stats.usage.chat.limit - stats.usage.chat.remaining,
    tokensUsed: stats.usage.tokens.limit - stats.usage.tokens.remaining,
  };

  return (
    <div className="min-h-screen bg-[#f4f1ea] dark:bg-[#1c1a17] text-[#2a2620] dark:text-[#e8e3d8]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-body text-4xl font-normal mb-1">Dashboard</h1>
            <p className="font-ui text-sm text-[#6b6358] dark:text-[#9a9080]">
              Your usage and account overview
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-ui text-xs font-medium ${PLAN_BADGE_STYLES[stats.plan]}`}
            aria-label={`Current plan: ${stats.planName}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {stats.planName} plan
          </span>
        </header>

        {/* Plan + Carbon row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Plan card */}
          <section className="rounded-[20px] border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#252220] p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8e0d0] dark:bg-[#322e28] text-[#8b4513] dark:text-[#b5673a]">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-ui text-xs uppercase tracking-wide text-[#6b6358] dark:text-[#9a9080]">
                  Current plan
                </p>
                <p className="font-body text-xl font-semibold">{stats.planName}</p>
              </div>
            </div>
            <p className="font-ui text-sm text-[#6b6358] dark:text-[#9a9080] mb-4">
              {stats.plan === "free"
                ? "Free tier — $0/mo. Upgrade to unlock more research, swarm agents, and file generation."
                : stats.plan === "enterprise"
                ? "Enterprise — custom contract. Contact sales for changes."
                : `$${planLimit.priceMonthly}/mo · ${planLimit.monthlyResearch === Infinity ? "Unlimited" : planLimit.monthlyResearch.toLocaleString()} research/mo · ${planLimit.swarmAgents} swarm agents`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/pricing"
                className="rounded-lg bg-[#8b4513] dark:bg-[#b5673a] text-[#faf8f3] px-4 py-2 font-ui text-sm font-medium hover:bg-[#6b3410] dark:hover:bg-[#8b4513] transition-colors"
              >
                {stats.plan === "free" ? "Upgrade" : "Change plan"}
              </Link>
              <Link
                href="/billing"
                className="rounded-lg border border-[#d9d4c7] dark:border-[#3d3830] px-4 py-2 font-ui text-sm hover:bg-[#e0d9c8] dark:hover:bg-[#322e28] transition-colors"
              >
                Billing portal
              </Link>
            </div>
          </section>

          {/* Carbon card */}
          <section className="rounded-[20px] border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#252220] p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8e0d0] dark:bg-[#322e28] text-[#8b4513] dark:text-[#b5673a]">
                <Leaf className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-ui text-xs uppercase tracking-wide text-[#6b6358] dark:text-[#9a9080]">
                  Carbon footprint this month
                </p>
                <p className="font-body text-xl font-semibold tabular-nums">
                  {stats.carbon ? formatCarbon(stats.carbon.grams) : "—"}
                  {stats.carbon?.local && (
                    <span className="ml-2 font-ui text-xs text-[#6b6358] dark:text-[#9a9080]">
                      (local inference)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <p className="font-ui text-xs text-[#6b6358] dark:text-[#9a9080] mb-4">
              {stats.carbon
                ? stats.carbon.source
                : "Carbon tracking data not available — run a research job or send a chat message to see estimates."}
            </p>
            <a
              href="https://github.com/Abd123454/deep-research-engine/blob/main/docs/ENVIRONMENTAL.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-ui text-xs text-[#8b4513] dark:text-[#b5673a] hover:underline"
            >
              How we estimate CO₂
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </a>
          </section>
        </div>

        {/* Usage this month (3 cards) */}
        <section
          aria-label="Usage this month"
          className="mb-6"
        >
          <h2 className="font-ui text-sm font-medium uppercase tracking-wide text-[#6b6358] dark:text-[#9a9080] mb-3">
            Usage this month
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UsageCard
              icon={TrendingUp}
              label="Research jobs"
              used={usageMonth.researchCount}
              limit={stats.usage.research.limit}
            />
            <UsageCard
              icon={Activity}
              label="Chat messages"
              used={usageMonth.chatCount}
              limit={stats.usage.chat.limit}
            />
            <UsageCard
              icon={Activity}
              label="Tokens used"
              used={usageMonth.tokensUsed}
              limit={stats.usage.tokens.limit}
            />
          </div>
        </section>

        {/* Recent activity */}
        <section className="rounded-[20px] border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#252220] p-6 mb-6">
          <h2 className="font-body text-lg font-semibold mb-4">Recent activity</h2>
          {stats.recentActivity.length === 0 ? (
            <p className="font-ui text-sm text-[#6b6358] dark:text-[#9a9080]">
              No research jobs yet. Start your first research from the home page.
            </p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {stats.recentActivity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-[#d9d4c7]/60 dark:border-[#3d3830]/60 px-4 py-2.5"
                >
                  <span className="font-body text-sm truncate flex-1 mr-3">
                    {item.query}
                  </span>
                  <span
                    className={`font-ui text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                      item.status === "completed"
                        ? "bg-[#8b4513]/10 dark:bg-[#b5673a]/10 text-[#8b4513] dark:text-[#b5673a]"
                        : item.status === "failed"
                        ? "bg-[#a33a3a]/10 text-[#a33a3a]"
                        : "bg-[#e0d9c8] dark:bg-[#322e28] text-[#6b6358] dark:text-[#9a9080]"
                    }`}
                  >
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick links */}
        <section
          aria-label="Quick links"
          className="rounded-[20px] border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#252220] p-6"
        >
          <h2 className="font-body text-lg font-semibold mb-4">Quick links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <QuickLink
              href="/billing"
              icon={CreditCard}
              label="Billing portal"
              hint="Manage subscription, invoices, payment methods"
            />
            <QuickLink
              href="/dashboard#api-keys"
              icon={Key}
              label="API keys"
              hint="Generate keys for the REST + MCP API"
            />
            <QuickLink
              href="/settings/memory"
              icon={Brain}
              label="Memory settings"
              hint="Consent, view, edit, export long-term memories"
            />
            <QuickLink
              href="/settings/privacy"
              icon={Settings}
              label="Privacy settings"
              hint="Data retention, MFA, account export"
            />
          </div>

          {/* API keys section (kept from original dashboard) */}
          <div id="api-keys" className="mt-6 pt-6 border-t border-[#d9d4c7] dark:border-[#3d3830] scroll-mt-24">
            <div className="flex items-center gap-2 mb-2">
              <Key className="h-4 w-4 text-[#8b4513] dark:text-[#b5673a]" aria-hidden="true" />
              <h3 className="font-ui text-sm font-semibold">API keys</h3>
            </div>
            <p className="font-ui text-sm text-[#6b6358] dark:text-[#9a9080] mb-3">
              Generate API keys to use Quaesitor programmatically via the MCP
              server or REST API.
            </p>
            <button
              type="button"
              className="rounded-lg bg-[#8b4513] dark:bg-[#b5673a] text-[#faf8f3] px-4 py-2 font-ui text-sm font-medium hover:bg-[#6b3410] dark:hover:bg-[#8b4513] transition-colors"
            >
              Generate new key
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------- UsageCard ----------

function UsageCard({
  icon: Icon,
  label,
  used,
  limit,
}: {
  icon: React.ElementType;
  label: string;
  used: number;
  limit: number;
}) {
  const pct = limit > 0 && limit !== Infinity ? (used / limit) * 100 : 0;
  const displayLimit = limit === Infinity ? "∞" : limit.toLocaleString();
  return (
    <div className="rounded-[20px] border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#252220] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-[#6b6358] dark:text-[#9a9080]" aria-hidden="true" />
        <span className="font-ui text-sm font-medium">{label}</span>
      </div>
      <p className="font-body text-2xl font-semibold tabular-nums">
        {used.toLocaleString()}{" "}
        <span className="font-ui text-sm font-normal text-[#6b6358] dark:text-[#9a9080]">
          / {displayLimit}
        </span>
      </p>
      <div className="h-1.5 rounded-full bg-[#e0d9c8] dark:bg-[#322e28] overflow-hidden mt-2">
        <div
          className="h-full bg-[#8b4513] dark:bg-[#b5673a] transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

// ---------- QuickLink ----------

function QuickLink({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border border-[#d9d4c7] dark:border-[#3d3830] p-3 hover:bg-[#e8e0d0]/40 dark:hover:bg-[#322e28]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3] dark:focus-visible:ring-offset-[#252220]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e8e0d0] dark:bg-[#322e28] text-[#8b4513] dark:text-[#b5673a]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-ui text-sm font-medium text-[#2a2620] dark:text-[#e8e3d8] group-hover:text-[#8b4513] dark:group-hover:text-[#b5673a] transition-colors">
          {label}
        </span>
        <span className="block font-ui text-xs text-[#6b6358] dark:text-[#9a9080] mt-0.5">
          {hint}
        </span>
      </span>
      <ChevronRight
        className="h-4 w-4 text-[#6b6358] dark:text-[#9a9080] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
}
