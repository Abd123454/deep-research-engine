"use client";

import { Languages } from "lucide-react";
import { useLocale } from "./locale-provider";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { locale, toggleLocale } = useLocale();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleLocale}
      aria-label="Toggle language"
      title={locale === "en" ? "العربية" : "English"}
      className="h-8 w-8"
    >
      <Languages className="h-4 w-4" />
      <span className="sr-only">Toggle language</span>
      <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-bold leading-none">
        {locale === "en" ? "ع" : "EN"}
      </span>
    </Button>
  );
}
