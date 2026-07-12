import { Card, CardContent } from "@/components/ui/card";
import { ListTree } from "lucide-react";
import type { ResearchPlan as ResearchPlanType } from "@/lib/types";

interface ResearchPlanProps {
  plan: ResearchPlanType;
}

export function ResearchPlan({ plan }: ResearchPlanProps) {
  if (plan.sections.length === 0) return null;
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient">
            <ListTree className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight">Research plan</h3>
            <p className="text-[11px] text-muted-foreground leading-tight">
              The agent created this outline before researching
            </p>
          </div>
        </div>
        <h4 className="text-base font-semibold text-primary mb-1">
          {plan.title}
        </h4>
        {plan.summary && (
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            {plan.summary}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {plan.sections.map((s, i) => (
            <div
              key={s.id}
              className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-gradient text-[10px] font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium leading-snug">{s.title}</p>
                {s.description && (
                  <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                    {s.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
