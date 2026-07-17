"use client";

// DepthIndicator — Quaesitor's signature depth selector.
// 3 dots like a camera lens aperture: ●●● Deep / ●●○ Standard / ●○○ Quick.
// Unique to Quaesitor, no equivalent in other AI chat products.

import * as React from "react";

export type Depth = "quick" | "standard" | "deep";

const DEPTHS: Record<Depth, { dots: number; label: string }> = {
  quick: { dots: 1, label: "Quick" },
  standard: { dots: 2, label: "Standard" },
  deep: { dots: 3, label: "Deep" },
};

export function DepthIndicator({
  depth,
  onChange,
}: {
  depth: Depth;
  onChange?: (d: Depth) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {(Object.keys(DEPTHS) as Depth[]).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange?.(d)}
          className={`flex items-center gap-1.5 font-ui text-xs transition-colors ${
            depth === d
              ? "text-[#2a2620] dark:text-[#e8e3d8]"
              : "text-[#6b6358] dark:text-[#9a9080] hover:text-[#2a2620] dark:hover:text-[#e8e3d8]"
          }`}
          aria-pressed={depth === d}
          aria-label={`Depth: ${DEPTHS[d].label}`}
        >
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full border ${
                  i < DEPTHS[d].dots
                    ? "bg-[#8b4513] border-[#8b4513] dark:bg-[#b5673a] dark:border-[#b5673a]"
                    : "border-[#6b6358] dark:border-[#9a9080]"
                }`}
              />
            ))}
          </span>
          {DEPTHS[d].label}
        </button>
      ))}
    </div>
  );
}
