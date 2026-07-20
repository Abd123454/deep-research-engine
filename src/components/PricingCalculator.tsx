"use client";

// PricingCalculator — interactive monthly-cost estimator for the /pricing page.
//
// Lets users drag two sliders (research queries/month, chat messages/month)
// and toggle two switches ("use my own Ollama", "priority support"). The
// recommended plan + estimated monthly cost are computed live using the
// `recommendPlan` + `PLAN_LIMITS` helpers from `@/lib/plan-limits`.
//
// Design: warm Quaesitor palette, DM Sans (`font-ui`) for the calculator
// chrome (labels, sliders, buttons), Newsreader (`font-body`) for the
// headline. Visual elevation uses borders + surface tone only
// (per DESIGN.md). The "Estimated cost" card uses border-only depth.

import * as React from "react";
import { Calculator, Sparkles, Cpu, LifeBuoy } from "lucide-react";
import { PLAN_LIMITS, recommendPlan, type Plan } from "@/lib/plan-limits-data";

interface PricingCalculatorProps {
  /** Optional class to override the outer wrapper. */
  className?: string;
}

const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
  enterprise: "Enterprise",
};

const PLAN_ACCENT: Record<Plan, string> = {
  free: "border-[#d9d4c7] dark:border-[#3d3830]",
  pro: "border-[#8b4513] dark:border-[#b5673a]",
  team: "border-[#8b4513] dark:border-[#b5673a]",
  enterprise: "border-[#8b4513] dark:border-[#b5673a]",
};

export function PricingCalculator({ className }: PricingCalculatorProps) {
  // State: usage profile the user is estimating.
  const [research, setResearch] = React.useState(20);
  const [chat, setChat] = React.useState(800);
  const [useOwnOllama, setUseOwnOllama] = React.useState(false);
  const [prioritySupport, setPrioritySupport] = React.useState(false);

  // Derived: recommended plan + estimated monthly cost.
  const recommendedPlan = React.useMemo(
    () => recommendPlan({ monthlyResearch: research, monthlyChatMessages: chat, prioritySupport }),
    [research, chat, prioritySupport]
  );

  const baseCost = React.useMemo(() => {
    const limits = PLAN_LIMITS[recommendedPlan];
    // Ollama = free local inference. If the user is on Free + Ollama, the
    // cost is genuinely $0/mo. If they're on a paid plan + Ollama, the
    // plan fee still applies (they're paying for the platform, not the
    // LLM API). For Enterprise we surface the baseline ($499) since the
    // actual contract is custom.
    if (recommendedPlan === "free" && useOwnOllama) return 0;
    return limits.priceMonthly;
  }, [recommendedPlan, useOwnOllama]);

  // Add a small per-query overage estimate if the user exceeds the plan's
  // monthly research cap (only relevant for paid plans — Free just upgrades).
  const overage = React.useMemo(() => {
    const cap = PLAN_LIMITS[recommendedPlan].monthlyResearch;
    if (cap === Infinity) return 0;
    if (research <= cap) return 0;
    // $0.25 per extra research query (illustrative — real billing would
    // use metered usage via Stripe).
    return (research - cap) * 0.25;
  }, [research, recommendedPlan]);

  const estimatedCost = baseCost + overage;

  return (
    <section
      aria-labelledby="pricing-calc-heading"
      className={`rounded-[20px] border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#252220] p-6 sm:p-8 ${className ?? ""}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8e0d0] dark:bg-[#322e28] text-[#8b4513] dark:text-[#b5673a]">
          <Calculator className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2
            id="pricing-calc-heading"
            className="font-ui text-lg font-semibold text-[#2a2620] dark:text-[#e8e3d8]"
          >
            Estimate your monthly cost
          </h2>
          <p className="font-ui text-sm text-[#6b6358] dark:text-[#9a9080]">
            Drag the sliders to match your expected usage. We&apos;ll suggest the
            plan that fits.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sliders + toggles (3/5 width on desktop) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Research queries slider */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label
                htmlFor="calc-research"
                className="font-ui text-sm font-medium text-[#2a2620] dark:text-[#e8e3d8]"
              >
                Research queries / month
              </label>
              <span className="font-ui text-sm text-[#8b4513] dark:text-[#b5673a] tabular-nums">
                {research}
              </span>
            </div>
            <input
              id="calc-research"
              type="range"
              min={1}
              max={500}
              step={1}
              value={research}
              onChange={(e) => setResearch(Number(e.target.value))}
              className="w-full h-2 bg-[#e0d9c8] dark:bg-[#322e28] rounded-full appearance-none cursor-pointer accent-[#8b4513] dark:accent-[#b5673a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3] dark:focus-visible:ring-offset-[#252220]"
              aria-valuemin={1}
              aria-valuemax={500}
              aria-valuenow={research}
            />
            <div className="flex justify-between mt-1 font-ui text-xs text-[#6b6358] dark:text-[#9a9080]">
              <span>1</span>
              <span>500</span>
            </div>
          </div>

          {/* Chat messages slider */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label
                htmlFor="calc-chat"
                className="font-ui text-sm font-medium text-[#2a2620] dark:text-[#e8e3d8]"
              >
                Chat messages / month
              </label>
              <span className="font-ui text-sm text-[#8b4513] dark:text-[#b5673a] tabular-nums">
                {chat.toLocaleString()}
              </span>
            </div>
            <input
              id="calc-chat"
              type="range"
              min={100}
              max={10000}
              step={100}
              value={chat}
              onChange={(e) => setChat(Number(e.target.value))}
              className="w-full h-2 bg-[#e0d9c8] dark:bg-[#322e28] rounded-full appearance-none cursor-pointer accent-[#8b4513] dark:accent-[#b5673a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b4513] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3] dark:focus-visible:ring-offset-[#252220]"
              aria-valuemin={100}
              aria-valuemax={10000}
              aria-valuenow={chat}
            />
            <div className="flex justify-between mt-1 font-ui text-xs text-[#6b6358] dark:text-[#9a9080]">
              <span>100</span>
              <span>10,000</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2">
            <Toggle
              id="calc-ollama"
              checked={useOwnOllama}
              onChange={setUseOwnOllama}
              icon={<Cpu className="h-4 w-4" aria-hidden="true" />}
              label="I&apos;ll use my own Ollama (free local inference)"
              hint="Drops LLM API costs to $0 — you run the model on your own hardware."
            />
            <Toggle
              id="calc-support"
              checked={prioritySupport}
              onChange={setPrioritySupport}
              icon={<LifeBuoy className="h-4 w-4" aria-hidden="true" />}
              label="I need priority support"
              hint="Requires Team or Enterprise — Pro and Free use community support."
            />
          </div>
        </div>

        {/* Result card (2/5 width on desktop) */}
        <div className="lg:col-span-2">
          <div
            className={`h-full rounded-[16px] border-2 ${PLAN_ACCENT[recommendedPlan]} bg-[#f4f1ea] dark:bg-[#1c1a17] p-5 flex flex-col`}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-[#8b4513] dark:text-[#b5673a]" aria-hidden="true" />
              <span className="font-ui text-xs uppercase tracking-wide text-[#6b6358] dark:text-[#9a9080]">
                Recommended plan
              </span>
            </div>
            <p className="font-body text-2xl font-semibold text-[#2a2620] dark:text-[#e8e3d8] mb-1">
              {PLAN_LABELS[recommendedPlan]}
            </p>
            <p className="font-ui text-sm text-[#6b6358] dark:text-[#9a9080] mb-4">
              {recommendedPlan === "free" && useOwnOllama
                ? "Free tier + local inference = $0/month"
                : recommendedPlan === "enterprise"
                ? "Custom contract — baseline $499/mo"
                : `Fits ${research.toLocaleString()} research + ${chat.toLocaleString()} chat / mo`}
            </p>

            <div className="border-t border-[#d9d4c7] dark:border-[#3d3830] pt-4 mt-auto">
              <p className="font-ui text-xs uppercase tracking-wide text-[#6b6358] dark:text-[#9a9080] mb-1">
                Estimated monthly cost
              </p>
              <p className="font-body text-3xl font-semibold text-[#8b4513] dark:text-[#b5673a] tabular-nums">
                ${estimatedCost.toFixed(2)}
                <span className="font-ui text-sm font-normal text-[#6b6358] dark:text-[#9a9080] ml-1">
                  /mo
                </span>
              </p>
              {overage > 0 && (
                <p className="font-ui text-xs text-[#6b6358] dark:text-[#9a9080] mt-2">
                  Includes ${overage.toFixed(2)} estimated overage
                  ({research - PLAN_LIMITS[recommendedPlan].monthlyResearch} extra
                  queries @ $0.25 each).
                </p>
              )}
              {useOwnOllama && recommendedPlan !== "free" && (
                <p className="font-ui text-xs text-[#6b6358] dark:text-[#9a9080] mt-2">
                  LLM API cost: $0 (Ollama runs on your hardware). Plan fee covers
                  platform features.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Plan limits reference */}
      <details className="mt-6 group">
        <summary className="font-ui text-sm font-medium text-[#8b4513] dark:text-[#b5673a] cursor-pointer list-none flex items-center gap-1.5 hover:underline">
          <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">▸</span>
          See plan limits at a glance
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full font-ui text-xs text-[#2a2620] dark:text-[#e8e3d8]">
            <thead>
              <tr className="border-b border-[#d9d4c7] dark:border-[#3d3830] text-left text-[#6b6358] dark:text-[#9a9080]">
                <th className="py-2 pr-3 font-medium">Plan</th>
                <th className="py-2 px-3 font-medium">Research/mo</th>
                <th className="py-2 px-3 font-medium">Chat/mo</th>
                <th className="py-2 px-3 font-medium">Swarm agents</th>
                <th className="py-2 px-3 font-medium">Upload</th>
                <th className="py-2 pl-3 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PLAN_LIMITS) as Plan[]).map((p) => {
                const l = PLAN_LIMITS[p];
                const isRecommended = p === recommendedPlan;
                return (
                  <tr
                    key={p}
                    className={`border-b border-[#d9d4c7]/50 dark:border-[#3d3830]/50 ${isRecommended ? "bg-[#8b4513]/5 dark:bg-[#b5673a]/5" : ""}`}
                  >
                    <td className="py-2 pr-3 font-medium">
                      {l.label}
                      {isRecommended && (
                        <span className="ml-1.5 inline-block text-[#8b4513] dark:text-[#b5673a]">←</span>
                      )}
                    </td>
                    <td className="py-2 px-3 tabular-nums">
                      {l.monthlyResearch === Infinity ? "∞" : l.monthlyResearch.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 tabular-nums">
                      {l.monthlyChatMessages === Infinity ? "∞" : l.monthlyChatMessages.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 tabular-nums">{l.swarmAgents}</td>
                    <td className="py-2 px-3 tabular-nums">{l.maxFileUploadMB} MB</td>
                    <td className="py-2 pl-3 tabular-nums">
                      {l.priceMonthly === 0 ? "$0" : `$${l.priceMonthly}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

// ---------- Toggle ----------

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}

function Toggle({ id, checked, onChange, icon, label, hint }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 cursor-pointer rounded-lg p-2 -mx-2 hover:bg-[#e8e0d0]/40 dark:hover:bg-[#322e28]/40 transition-colors"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8e0d0] dark:bg-[#322e28] text-[#8b4513] dark:text-[#b5673a]">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-ui text-sm font-medium text-[#2a2620] dark:text-[#e8e3d8]">
          {label}
        </span>
        {hint && (
          <span className="block font-ui text-xs text-[#6b6358] dark:text-[#9a9080] mt-0.5">
            {hint}
          </span>
        )}
      </span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`h-6 w-11 rounded-full transition-colors ${
            checked
              ? "bg-[#8b4513] dark:bg-[#b5673a]"
              : "bg-[#d9d4c7] dark:bg-[#3d3830]"
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[#faf8f3] dark:bg-[#252220] transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </label>
  );
}
