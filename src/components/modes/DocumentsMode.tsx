"use client";

// DocumentsMode — placeholder for Phase B (document upload + Q&A).
// Shows a friendly "coming soon" state.

import { motion } from "framer-motion";
import { FileText, Upload } from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";

export function DocumentsMode() {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {t("documentsPlaceholder")}
        </h2>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-border/60 p-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Upload className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {t("documentsDesc")}
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
          <FileText className="h-3 w-3" />
          {t("comingSoon")}
        </div>
      </div>
    </motion.div>
  );
}
