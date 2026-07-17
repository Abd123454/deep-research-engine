"use client";

// OnboardingFlow — 3-step first-run onboarding for Quaesitor.
//
// Steps:
//   1. Welcome — the investigator metaphor (compass logo, 6-stage research).
//   2. Choose your depth — shows the DepthIndicator (quick/standard/deep).
//   3. Your privacy — conversations are private, memory is opt-in,
//      you can delete anytime.
//
// Stores completion in localStorage (`quaesitor_onboarded`).
// Only renders for first-time users. The parent decides where to mount
// it (UnifiedInterface mounts it on the empty state).
//
// Design: warm Quaesitor palette, font-ui for chrome, font-body for
// prose. Modal-style overlay with backdrop, max-w-md card. Subtle
// Framer Motion transitions. No box-shadow — borders + surface tone.

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass, Search, BookOpen, GitBranch, Target, FileText,
  Shield, Database, Trash2, ArrowRight, Check, X,
} from "lucide-react";
import { CompassLogo } from "@/components/CompassLogo";
import { DepthIndicator, type Depth } from "@/components/DepthIndicator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "quaesitor_onboarded";
const ONBOARDED_VERSION = 1; // bump to force re-show after breaking changes

interface OnboardingFlowProps {
  /** Called when the user completes or skips onboarding. */
  onComplete?: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [visible, setVisible] = React.useState(false);
  const [step, setStep] = React.useState(0);

  // SSR safety: only show after mount (localStorage is client-only).
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || parsed.version !== ONBOARDED_VERSION) {
        setVisible(true);
      }
    } catch {
      // Corrupt localStorage — show onboarding to be safe.
      setVisible(true);
    }
  }, []);

  function complete() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: ONBOARDED_VERSION, completedAt: new Date().toISOString() })
      );
    } catch {
      // localStorage unavailable (private mode, etc.) — non-fatal.
    }
    setVisible(false);
    onComplete?.();
  }

  function skip() {
    complete();
  }

  function next() {
    if (step < 2) {
      setStep((s) => s + 1);
    } else {
      complete();
    }
  }

  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  if (!visible) return null;

  const steps = [
    <WelcomeStep key="welcome" />,
    <DepthStep key="depth" />,
    <PrivacyStep key="privacy" />,
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#2a2620]/40"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 8 }}
          transition={{ type: "spring", damping: 30, stiffness: 320 }}
          className="relative w-full max-w-md rounded-[20px] border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#1c1a17] overflow-hidden"
        >
          {/* Skip button (top-right) — available on every step */}
          <button
            onClick={skip}
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md text-[#6b6358] hover:bg-[#2a2620]/5 dark:text-[#9a9080] dark:hover:bg-[#e8e3d8]/5 transition-colors z-10"
            aria-label="Skip onboarding"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Step content */}
          <div className="px-6 pt-8 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
              >
                {steps[step]}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer — step indicator + nav */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-[#d9d4c7] dark:border-[#3d3830] bg-[#f4f1ea]/40 dark:bg-[#1c1a17]">
            {/* Step dots */}
            <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of 3`}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === step
                      ? "w-6 bg-[#8b4513] dark:bg-[#b5673a]"
                      : i < step
                        ? "w-1.5 bg-[#8b4513]/50 dark:bg-[#b5673a]/50"
                        : "w-1.5 bg-[#d9d4c7] dark:bg-[#3d3830]"
                  )}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={back} className="h-8 text-xs font-ui">
                  Back
                </Button>
              )}
              <Button
                onClick={next}
                size="sm"
                className="h-8 gap-1.5 text-xs font-ui bg-[#8b4513] dark:bg-[#b5673a] text-[#faf8f3] hover:bg-[#6b3410] dark:hover:bg-[#8b4513]"
              >
                {step === 2 ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Get started
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---------- Step 1: Welcome ----------
function WelcomeStep() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4f1ea] dark:bg-[#322e28] mb-4">
        <CompassLogo className="h-8 w-8 fill-[#8b4513] text-[#8b4513]" />
      </div>
      <h2 id="onboarding-title" className="font-body text-2xl font-semibold text-[#2a2620] dark:text-[#e8e3d8] mb-2">
        Welcome to Quaesitor
      </h2>
      <p className="text-sm font-body text-[#6b6358] dark:text-[#9a9080] leading-relaxed mb-5 max-w-sm">
        Quaesitor (Latin: <em>the seeker, the investigator</em>) is a research
        workstation. Ask a question, and it runs a 6-stage investigation —
        planning, searching, reading, extracting, gap analysis, synthesis —
        with cited sources you can verify.
      </p>

      {/* 6-stage visual */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
        {[
          { icon: GitBranch, label: "Plan" },
          { icon: Search, label: "Search" },
          { icon: BookOpen, label: "Read" },
          { icon: Compass, label: "Extract" },
          { icon: Target, label: "Gap analysis" },
          { icon: FileText, label: "Synthesize" },
        ].map((stage, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1 rounded-lg border border-[#d9d4c7] dark:border-[#3d3830] bg-[#f4f1ea]/50 dark:bg-[#322e28]/40 px-2 py-2.5"
          >
            <stage.icon className="h-3.5 w-3.5 text-[#8b4513] dark:text-[#b5673a]" />
            <span className="text-[10px] font-ui text-[#6b6358] dark:text-[#9a9080]">{stage.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Step 2: Choose your depth ----------
function DepthStep() {
  const [depth, setDepth] = React.useState<Depth>("standard");
  const depthDescription: Record<Depth, string> = {
    quick: "Fast answers for simple questions. One search round, brief synthesis. Best for fact-checks and quick lookups.",
    standard: "Balanced. Two search rounds with gap analysis, full synthesis with citations. The default for most queries.",
    deep: "Thorough investigation. Extra search rounds, more sources read, longer synthesis. Best for complex or contested topics.",
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f1ea] dark:bg-[#322e28] mb-4">
        <Compass className="h-6 w-6 text-[#8b4513] dark:text-[#b5673a]" />
      </div>
      <h2 className="font-body text-2xl font-semibold text-[#2a2620] dark:text-[#e8e3d8] mb-2">
        Choose your depth
      </h2>
      <p className="text-sm font-body text-[#6b6358] dark:text-[#9a9080] leading-relaxed mb-5 max-w-sm">
        Every query can run at three depths. The depth selector (three dots
        like a camera aperture) appears next to the input bar — pick the
        depth that matches the question.
      </p>

      {/* Depth indicator — interactive */}
      <div className="rounded-lg border border-[#d9d4c7] dark:border-[#3d3830] bg-[#f4f1ea]/40 dark:bg-[#322e28]/40 px-4 py-3 mb-3">
        <DepthIndicator depth={depth} onChange={setDepth} />
      </div>

      {/* Description of the selected depth */}
      <p className="text-xs font-body text-[#6b6358] dark:text-[#9a9080] leading-relaxed italic max-w-sm min-h-[3rem]">
        {depthDescription[depth]}
      </p>
    </div>
  );
}

// ---------- Step 3: Your privacy ----------
function PrivacyStep() {
  const items = [
    {
      icon: Shield,
      title: "Conversations are private",
      body: "Your queries and the responses you get are scoped to your account. Quaesitor does not sell or share conversation data.",
    },
    {
      icon: Database,
      title: "Memory is opt-in",
      body: "Long-term memory extraction is OFF by default. Enable it in settings if you want Quaesitor to remember facts across sessions. Explicit \"remember that…\" commands work regardless.",
    },
    {
      icon: Trash2,
      title: "Delete anytime",
      body: "Use Settings → Account → Delete, or the GDPR erasure endpoint (DELETE /api/account). Your data is gone within minutes — no soft deletes, no backups beyond the standard 35-day window.",
    },
  ];

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f1ea] dark:bg-[#322e28] mb-4">
        <Shield className="h-6 w-6 text-[#8b4513] dark:text-[#b5673a]" />
      </div>
      <h2 className="font-body text-2xl font-semibold text-[#2a2620] dark:text-[#e8e3d8] mb-4">
        Your privacy
      </h2>

      <div className="w-full space-y-2.5 text-left">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-[#d9d4c7] dark:border-[#3d3830] bg-[#f4f1ea]/40 dark:bg-[#322e28]/40 px-3 py-2.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#faf8f3] dark:bg-[#1c1a17]">
              <item.icon className="h-3.5 w-3.5 text-[#8b4513] dark:text-[#b5673a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-ui font-medium text-[#2a2620] dark:text-[#e8e3d8] mb-0.5">
                {item.title}
              </p>
              <p className="text-[11px] font-body text-[#6b6358] dark:text-[#9a9080] leading-relaxed">
                {item.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Helper: check onboarding status without mounting ----------
export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return true; // SSR: assume complete
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.version === ONBOARDED_VERSION;
  } catch {
    return false;
  }
}
