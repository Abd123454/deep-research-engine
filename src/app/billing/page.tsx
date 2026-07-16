"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";

// Plan definitions duplicated here (client-safe, no server imports).
// The server-side source of truth is src/lib/stripe.ts.
const PLANS = {
  free: { name: "Free", limits: { researchPerMonth: 10, chatPerDay: 50, tokensPerMonth: 50_000 }, features: ["basic_research", "chat"] },
  pro: { name: "Pro", limits: { researchPerMonth: 100, chatPerDay: 500, tokensPerMonth: 1_000_000 }, features: ["basic_research", "chat", "swarm", "vision", "file_generation"] },
  team: { name: "Team", limits: { researchPerMonth: 1000, chatPerDay: Infinity, tokensPerMonth: 10_000_000 }, features: ["basic_research", "chat", "swarm", "vision", "file_generation", "organizations"] },
  enterprise: { name: "Enterprise", limits: { researchPerMonth: Infinity, chatPerDay: Infinity, tokensPerMonth: Infinity }, features: ["all"] },
} as const;

type Plan = keyof typeof PLANS;

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = React.useState<string>("free");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/billing/subscription")
      .then((r) => r.json())
      .then((data) => setCurrentPlan(data.plan || "free"))
      .finally(() => setLoading(false));
  }, []);

  async function upgrade(plan: Plan) {
    if (plan === "free" || plan === "enterprise") return;
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.assign(data.url);
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Billing</h1>
        <p className="text-muted-foreground mb-8">Manage your subscription and usage</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {(Object.keys(PLANS) as Plan[]).map((key) => {
            const plan = PLANS[key];
            const isCurrent = currentPlan === key;
            return (
              <div
                key={key}
                className={`rounded-2xl border p-6 ${isCurrent ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
              >
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="text-2xl font-bold mt-2">
                  {key === "free" ? "$0" : key === "enterprise" ? "Custom" : `$${key === "pro" ? "19" : "99"}`}
                  <span className="text-sm text-muted-foreground font-normal">/mo</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {plan.limits.researchPerMonth === Infinity ? "Unlimited" : plan.limits.researchPerMonth} research/mo</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {plan.limits.chatPerDay === Infinity ? "Unlimited" : plan.limits.chatPerDay} chat/day</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {(plan.limits.tokensPerMonth / 1_000_000).toFixed(1)}M tokens/mo</li>
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {f.replace(/_/g, " ")}</li>
                  ))}
                </ul>
                {isCurrent ? (
                  <p className="mt-4 text-center text-sm text-muted-foreground font-medium">Current Plan</p>
                ) : key === "enterprise" ? (
                  <a href="mailto:sales@quaesitor.ai" className="mt-4 block text-center rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Contact Sales</a>
                ) : (
                  <button
                    onClick={() => upgrade(key)}
                    className="mt-4 w-full rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
                  >
                    Upgrade to {plan.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Current Usage</h2>
          </div>
          <UsageWidget />
        </div>
      </div>
    </div>
  );
}

function UsageWidget() {
  const [usage, setUsage] = React.useState<{ research: { remaining: number; limit: number }; chat: { remaining: number; limit: number }; tokens: { remaining: number; limit: number } } | null>(null);

  React.useEffect(() => {
    fetch("/api/billing/usage")
      .then((r) => r.json())
      .then((data) => setUsage(data.usage))
      .catch(() => {});
  }, []);

  if (!usage) return <p className="text-sm text-muted-foreground">Loading usage...</p>;

  return (
    <div className="space-y-3">
      <UsageBar label="Research" remaining={usage.research.remaining} limit={usage.research.limit} />
      <UsageBar label="Chat" remaining={usage.chat.remaining} limit={usage.chat.limit} />
      <UsageBar label="Tokens" remaining={usage.tokens.remaining} limit={usage.tokens.limit} />
    </div>
  );
}

function UsageBar({ label, remaining, limit }: { label: string; remaining: number; limit: number }) {
  const used = limit - remaining;
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground">{used.toLocaleString()} / {limit === Infinity ? "∞" : limit.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
