import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubQuery } from "@/lib/types";
import { SQ_STATUS_META } from "@/lib/research-ui-utils";

interface SubQueryListProps {
  subQueries: SubQuery[];
}

function SubQueryCard({ index, sq }: { index: number; sq: SubQuery }) {
  const meta = SQ_STATUS_META[sq.status];
  const Icon = meta.icon;
  const isActive =
    sq.status === "searching" || sq.status === "reading" || sq.status === "extracting";

  return (
    <div className="rounded-lg border border-border/50 bg-card/60 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold",
              sq.round === 2
                ? "bg-[#8b4513]/20 dark:bg-[#b5673a]/20 text-[#8b4513] dark:text-[#b5673a]"
                : "bg-[#8b4513]/15 dark:bg-[#b5673a]/15 text-[#8b4513]"
            )}
          >
            {index + 1}
          </span>
          {sq.round === 2 && (
            <Badge className="bg-[#8b4513]/15 dark:bg-[#b5673a]/15 text-[#8b4513] dark:text-[#b5673a] text-[8px] px-1 py-0 rounded">
              R2
            </Badge>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium leading-snug">{sq.question}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 gap-0.5 rounded-full", meta.cls)}>
              {isActive ? <Loader2 className="h-2 w-2 animate-spin" /> : <Icon className="h-2 w-2" />}
              {meta.label}
            </Badge>
            {sq.searchResults.length > 0 && (
              <span className="text-[9px] text-muted-foreground">{sq.searchResults.length} results</span>
            )}
            {sq.pagesRead > 0 && (
              <span className="text-[9px] text-muted-foreground">· {sq.pagesSucceeded}/{sq.pagesRead} read</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubQueryList({ subQueries }: SubQueryListProps) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide">
            Sub-queries
          </h3>
          <Badge variant="secondary" className="ml-auto text-[10px] rounded-full">
            {subQueries.length}
          </Badge>
        </div>
        <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
          {subQueries.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Generating sub-questions...
            </p>
          )}
          {subQueries.map((sq, i) => (
            <SubQueryCard key={sq.id} index={i} sq={sq} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
