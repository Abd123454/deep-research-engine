"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ListTree,
  ArrowRight,
  Loader2,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ResearchPlan, PlanSection } from "@/lib/types";

interface PlanPreviewProps {
  plan: ResearchPlan;
  onStart: (plan: ResearchPlan) => void;
  onCancel: () => void;
}

export function PlanPreview({ plan: initialPlan, onStart, onCancel }: PlanPreviewProps) {
  const [editing, setEditing] = React.useState(false);
  const [plan, setPlan] = React.useState<ResearchPlan>(initialPlan);

  const updateTitle = (title: string) => setPlan((p) => ({ ...p, title }));
  const updateSummary = (summary: string) => setPlan((p) => ({ ...p, summary }));
  const updateSection = (id: string, field: keyof PlanSection, value: string) =>
    setPlan((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  // cap at 9
  const MAX_SECTIONS = 9;
  const addSection = () =>
    setPlan((p) => {
      if (p.sections.length >= MAX_SECTIONS) return p;
      return {
        ...p,
        sections: [
          ...p.sections,
          {
            id: `s${Date.now()}`,
            title: "New section",
            description: "Describe what this section covers.",
          },
        ],
      };
    });
  const removeSection = (id: string) =>
    setPlan((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== id) }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-4"
    >
      <Card className="border-border/70">
        <CardContent className="p-5 sm:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient">
                <ListTree className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-tight">Research plan</h3>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Review, edit, or start the research
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing((v) => !v)}
              className="gap-1.5 text-xs"
            >
              {editing ? (
                <>
                  <Check className="h-3 w-3" /> Done
                </>
              ) : (
                <>
                  <Pencil className="h-3 w-3" /> Edit
                </>
              )}
            </Button>
          </div>

          {/* Title */}
          {editing ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Report title</Label>
              <Input
                value={plan.title}
                onChange={(e) => updateTitle(e.target.value)}
                className="text-sm font-semibold"
              />
            </div>
          ) : (
            <h4 className="text-base font-semibold text-primary">
              {plan.title}
            </h4>
          )}

          {/* Summary */}
          {editing ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Summary</Label>
              <Textarea
                value={plan.summary}
                onChange={(e) => updateSummary(e.target.value)}
                className="text-xs min-h-[60px] resize-y"
              />
            </div>
          ) : (
            plan.summary && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {plan.summary}
              </p>
            )
          )}

          {/* Sections */}
          <div className="space-y-2">
            {plan.sections.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2",
                  editing && "gap-1.5"
                )}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-gradient text-[10px] font-bold text-white mt-0.5">
                  {i + 1}
                </span>
                {editing ? (
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <Input
                      value={s.title}
                      onChange={(e) => updateSection(s.id, "title", e.target.value)}
                      className="h-8 text-xs font-medium"
                    />
                    <Textarea
                      value={s.description}
                      onChange={(e) => updateSection(s.id, "description", e.target.value)}
                      className="text-[11px] min-h-[40px] resize-y"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSection(s.id)}
                      className="h-6 gap-1 text-[10px] text-destructive hover:text-destructive px-2"
                    >
                      <Trash2 className="h-2.5 w-2.5" /> Remove
                    </Button>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-snug">{s.title}</p>
                    {s.description && (
                      <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                        {s.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {editing && plan.sections.length < MAX_SECTIONS && (
              <Button
                variant="outline"
                size="sm"
                onClick={addSection}
                className="w-full gap-1.5 text-xs h-8 border-dashed"
              >
                <Plus className="h-3 w-3" /> Add section
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
            <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5 text-xs">
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button
              onClick={() => onStart(plan)}
              size="sm"
              className="gap-1.5 text-xs bg-brand-gradient hover:opacity-90 border-0"
            >
              Start research
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Loading state shown while the plan is being generated.
export function PlanPreviewLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="border-border/70">
        <CardContent className="p-6 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">Creating research plan...</p>
            <p className="text-xs text-muted-foreground">
              Analyzing your query and designing the report structure
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
