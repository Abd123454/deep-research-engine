"use client";

// HistoryMode — placeholder for Phase D (session persistence).
// Shows a friendly "coming soon" state.

import { motion } from "framer-motion";
import { Clock, History } from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";

export function HistoryMode() {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {t("historyPlaceholder")}
        </h2>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-border/60 p-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <History className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {t("historyDesc")}
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {t("comingSoon")}
        </div>
      </div>
    </motion.div>
  );
}
