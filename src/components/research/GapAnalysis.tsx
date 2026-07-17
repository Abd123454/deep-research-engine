import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

interface GapAnalysisProps {
  gapAnalysis: string;
}

export function GapAnalysis({ gapAnalysis }: GapAnalysisProps) {
  return (
    <Card className="border-[#e8e6dc] dark:border-[#3d3a35]/40 bg-[#c96442]/5 dark:bg-[#d97757]/5">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#c96442]/20 dark:bg-[#d97757]/20">
            <Target className="h-3.5 w-3.5 text-[#c96442] dark:text-[#d97757]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight">Gap analysis</h3>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Round-1 review → identified knowledge gaps → triggered round 2
            </p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-foreground/80">
          {gapAnalysis}
        </p>
      </CardContent>
    </Card>
  );
}
