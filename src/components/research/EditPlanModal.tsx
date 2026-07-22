"use client";

// EditPlanModal.tsx — inline modal for editing a research plan before
// restarting the research with the user's modifications.
//
// Extracted from deep-research.tsx (FC-4, UI God-object split). This is
// a self-contained presentational component: it receives the current
// plan + callbacks for updating it, saving, and cancelling. No state
// of its own beyond what the parent passes down.
//
// The modal lets the user:
//   - Edit the report title
//   - Edit the summary
//   - Add/remove/edit up to 9 sections (title + description each)
//   - Save & restart (calls onSave with the edited plan) or Cancel

import * as React from "react";
import { X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResearchPlan } from "@/lib/types";

export interface EditPlanModalProps {
  plan: ResearchPlan;
  setPlan: (p: ResearchPlan) => void;
  onSave: (p: ResearchPlan) => void;
  onCancel: () => void;
}

export function EditPlanModal({ plan, setPlan, onSave, onCancel }: EditPlanModalProps) {
  const updateTitle = (title: string) => setPlan({ ...plan, title });
  const updateSummary = (summary: string) => setPlan({ ...plan, summary });
  const updateSection = (id: string, field: "title" | "description", value: string) =>
    setPlan({
      ...plan,
      sections: plan.sections.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    });
  const removeSection = (id: string) =>
    setPlan({ ...plan, sections: plan.sections.filter((s) => s.id !== id) });
  const addSection = () => {
    if (plan.sections.length >= 9) return;
    setPlan({
      ...plan,
      sections: [
        ...plan.sections,
        { id: `s${Date.now()}`, title: "New section", description: "Describe what this section covers." },
      ],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <Card className="w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Edit research plan</h3>
            <Button variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Report title</Label>
            <Input
              value={plan.title}
              onChange={(e) => updateTitle(e.target.value)}
              className="text-sm font-semibold"
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Summary</Label>
            <textarea
              value={plan.summary}
              onChange={(e) => updateSummary(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs min-h-[60px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Sections */}
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground">
              Sections ({plan.sections.length}/9)
            </Label>
            {plan.sections.map((s, i) => (
              <div key={s.id} className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-gradient text-[10px] font-bold text-white mt-1">
                  {i + 1}
                </span>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Input
                    value={s.title}
                    onChange={(e) => updateSection(s.id, "title", e.target.value)}
                    className="h-8 text-xs font-medium"
                  />
                  <textarea
                    value={s.description}
                    onChange={(e) => updateSection(s.id, "description", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] min-h-[40px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <button
                  onClick={() => removeSection(s.id)}
                  className="text-[10px] text-muted-foreground hover:text-destructive shrink-0 mt-1"
                >
                  Remove
                </button>
              </div>
            ))}
            {plan.sections.length < 9 && (
              <button
                onClick={addSection}
                className="w-full rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-muted/40"
              >
                + Add section
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onSave(plan)}
              className="text-xs bg-brand-gradient hover:opacity-90 border-0 gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Save & restart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
