"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Sparkles, Zap, Building2, Crown } from "lucide-react";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "/mo",
    icon: Sparkles,
    color: "text-muted-foreground",
    features: ["10 research/mo", "50 chat/day", "50K tokens/mo", "Basic research", "Chat mode"],
    cta: "Get Started",
    href: "/register",
  },
  {
    key: "pro",
    name: "Pro",
    price: "$19",
    period: "/mo",
    icon: Zap,
    color: "text-primary",
    popular: true,
    features: ["100 research/mo", "500 chat/day", "1M tokens/mo", "Agent Swarm", "Vision", "File generation", "Priority support"],
    cta: "Upgrade to Pro",
    href: "/billing",
  },
  {
    key: "team",
    name: "Team",
    price: "$99",
    period: "/mo",
    icon: Building2,
    color: "text-primary",
    features: ["1,000 research/mo", "Unlimited chat", "10M tokens/mo", "Everything in Pro", "Team collaboration", "API access", "SSO"],
    cta: "Upgrade to Team",
    href: "/billing",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    icon: Crown,
    color: "text-primary",
    features: ["Unlimited everything", "Dedicated support", "Custom integrations", "On-premise option", "SLA guarantee", "Audit logs"],
    cta: "Contact Sales",
    href: "mailto:sales@quaesitor.ai",
  },
];

export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = React.useState("free");

  React.useEffect(() => {
    fetch("/api/billing/subscription")
      .then((r) => r.json())
      .then((data) => setCurrentPlan(data.plan || "free"))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Pricing</h1>
          <p className="text-muted-foreground text-lg">Choose the plan that fits your research needs</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentPlan === plan.key;
            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border p-6 ${plan.popular ? "border-primary ring-2 ring-primary/20" : "border-border"} ${isCurrent ? "bg-primary/5" : ""}`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </span>
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ${plan.color} mb-3`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <p className="mt-4 text-center text-sm text-muted-foreground font-medium">Current Plan</p>
                ) : (
                  <Link
                    href={plan.href}
                    className={`mt-4 block text-center rounded-lg px-4 py-2 text-sm font-medium ${plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border hover:bg-accent"}`}
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border p-8">
          <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-1">Can I use my own LLM API keys?</h3>
              <p className="text-sm text-muted-foreground">Yes! Quaesitor supports NVIDIA NIM (free), OpenAI, Anthropic, and Ollama (local). Set your keys in .env.</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">What happens when I hit my limit?</h3>
              <p className="text-sm text-muted-foreground">You'll see a friendly upgrade prompt. Your existing research and conversations are always accessible.</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Is my data private?</h3>
              <p className="text-sm text-muted-foreground">Yes. Quaesitor is self-hosted — your data stays on your server. No telemetry without explicit PostHog/Sentry configuration.</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Can I cancel anytime?</h3>
              <p className="text-sm text-muted-foreground">Yes, cancel from the billing portal at any time. Your plan remains active until the end of the billing period.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
