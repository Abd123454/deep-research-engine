"use client";

import { Languages } from "lucide-react";
import { useLocale } from "./locale-provider";

export function LanguageToggle() {
  const { locale, toggleLocale } = useLocale();
  return (
    <button
      onClick={toggleLocale}
      className="relative flex size-8 items-center justify-center rounded-md text-[#5e5d59] hover:bg-[#141413]/5 dark:text-[#a3a098] dark:hover:bg-[#faf9f5]/5 transition-colors"
      aria-label="Switch language"
      title={locale === "en" ? "العربية" : "English"}
    >
      <Languages className="h-4 w-4" />
      <span className="sr-only">Toggle language</span>
      <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-bold leading-none text-[#c96442]">
        {locale === "en" ? "ع" : "EN"}
      </span>
    </button>
  );
}
