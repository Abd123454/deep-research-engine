"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, Key, CreditCard, TrendingUp } from "lucide-react";

interface Stats {
  plan: string;
  planName: string;
  usage: {
    research: { remaining: number; limit: number };
    chat: { remaining: number; limit: number };
    tokens: { remaining: number; limit: number };
  };
  features: string[];
  recentActivity: Array<{ id: string; query: string; status: string; createdAt: string }>;
}

export default function DashboardPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!stats) return <div className="flex items-center justify-center min-h-screen">Failed to load</div>;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground mb-8">Your usage and account overview</p>

        {/* Plan card */}
        <div className="rounded-2xl border border-border p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-lg font-semibold">{stats.planName}</p>
              </div>
            </div>
            <Link href="/pricing" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Upgrade</Link>
          </div>
        </div>

        {/* Usage stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <UsageCard icon={TrendingUp} label="Research" remaining={stats.usage.research.remaining} limit={stats.usage.research.limit} />
          <UsageCard icon={Activity} label="Chat" remaining={stats.usage.chat.remaining} limit={stats.usage.chat.limit} />
          <UsageCard icon={Activity} label="Tokens" remaining={stats.usage.tokens.remaining} limit={stats.usage.tokens.limit} />
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No research jobs yet. Start your first research!</p>
          ) : (
            <div className="space-y-2">
              {stats.recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-2">
                  <span className="text-sm truncate flex-1">{item.query}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${item.status === "completed" ? "bg-[#c96442]/10 dark:bg-[#d97757]/10 text-[#c96442] dark:text-[#d97757]" : item.status === "failed" ? "bg-[#c44848]/10 text-[#c44848]" : "bg-[#c96442]/10 dark:bg-[#d97757]/10 text-[#c96442] dark:text-[#d97757]"}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API keys section */}
        <div className="rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">API Keys</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Generate API keys to use Quaesitor programmatically via the MCP server or REST API.</p>
          <button className="rounded-lg bg-[#c96442] dark:bg-[#d97757] text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-[#c96442]/90 dark:hover:bg-[#d97757]/90">Generate New Key</button>
        </div>
      </div>
    </div>
  );
}

function UsageCard({ icon: Icon, label, remaining, limit }: { icon: React.ElementType; label: string; remaining: number; limit: number }) {
  const used = limit - remaining;
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{used.toLocaleString()} <span className="text-sm text-muted-foreground font-normal">/ {limit === Infinity ? "∞" : limit.toLocaleString()}</span></p>
      <div className="h-2 rounded-full bg-secondary overflow-hidden mt-2">
        <div className="h-full bg-[#c96442] dark:bg-[#d97757] transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
