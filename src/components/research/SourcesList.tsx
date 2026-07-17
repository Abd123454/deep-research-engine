import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { dedupeSources } from "@/lib/research-ui-utils";

interface SourcesListProps {
  sources: { url: string; title: string; host: string }[];
}

// Source quality indicator based on domain TLD.
// .edu/.gov = high, .org = medium-high, .com = medium, others = low.
function getSourceQuality(host: string): { label: string; color: string } {
  const h = host.toLowerCase();
  if (h.endsWith(".edu") || h.endsWith(".gov") || h.endsWith(".mil"))
    return { label: "High", color: "text-[#8b4513] dark:text-[#b5673a]" };
  if (h.endsWith(".org") || h.includes("wikipedia.org") || h.includes("arxiv.org") || h.includes("nature.com") || h.includes("ieee.org"))
    return { label: "High", color: "text-[#8b4513] dark:text-[#b5673a]" };
  if (h.endsWith(".com") || h.endsWith(".net"))
    return { label: "Medium", color: "text-[#8b4513] dark:text-[#b5673a]" };
  return { label: "Low", color: "text-muted-foreground" };
}

export function SourcesList({ sources }: SourcesListProps) {
  const deduped = dedupeSources(sources);
  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide">
            Sources
          </h3>
          <Badge variant="secondary" className="ml-auto text-[10px] rounded-full">
            {deduped.length}
          </Badge>
        </div>
        {sources.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No sources collected yet.
          </p>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
            {deduped.slice(0, 60).map((s, i) => {
              const quality = getSourceQuality(s.host);
              return (
                <a
                  key={s.url + i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-mono font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium line-clamp-1 group-hover:text-primary">
                      {s.title || s.url}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {s.host}
                      </p>
                      <span className={cn("text-[8px] font-medium shrink-0", quality.color)}>
                        · {quality.label}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
