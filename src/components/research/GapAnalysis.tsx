import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

interface GapAnalysisProps {
  gapAnalysis: string;
}

export function GapAnalysis({ gapAnalysis }: GapAnalysisProps) {
  return (
    <Card className="border-[#d9d4c7] dark:border-[#3d3830]/40 bg-[#8b4513]/5 dark:bg-[#b5673a]/5">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8b4513]/20 dark:bg-[#b5673a]/20">
            <Target className="h-3.5 w-3.5 text-[#8b4513] dark:text-[#b5673a]" />
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
