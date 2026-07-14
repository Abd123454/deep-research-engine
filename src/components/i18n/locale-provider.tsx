"use client";

// Locale context + useT hook.
//
// Persists the chosen locale in localStorage. Sets <html lang> and dir
// (rtl/ltr) attributes so the browser and screen readers render correctly.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type Locale,
  type StringKey,
  LOCALES,
  isRTL,
  t as translate,
} from "@/lib/i18n/strings";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  t: (key: StringKey) => string;
  isRTL: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = "dre-locale";

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && LOCALES.includes(stored as Locale)) return stored as Locale;
  const nav = navigator.language?.toLowerCase() || "";
  if (nav.startsWith("ar")) return "ar";
  return "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Lazy init: detect locale on first render (client-side) to avoid the
  // setState-in-effect cascading-render lint error.
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    return detectInitialLocale();
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const rtl = isRTL(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "en" ? "ar" : "en");
  }, [locale, setLocale]);

  const t = useCallback(
    (key: StringKey) => translate(locale, key),
    [locale]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, toggleLocale, t, isRTL: isRTL(locale) }),
    [locale, setLocale, toggleLocale, t]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}

export function useT(): (key: StringKey) => string {
  return useLocale().t;
}
