// Centralized environment-variable helpers (DRY — previously duplicated in
// llm-provider.ts, retriever.ts, and research-engine.ts).

export function env(key: string, fallback = ""): string {
  if (typeof process === "undefined") return fallback;
  return (process.env?.[key] ?? fallback).trim();
}

// Alias for env() used where a string fallback is read explicitly.
export function envStr(key: string, fallback: string): string {
  return env(key, fallback);
}

export function envInt(
  key: string,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (typeof process === "undefined") return fallback;
  const raw = process.env?.[key];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function envBool(key: string, fallback: boolean): boolean {
  if (typeof process === "undefined") return fallback;
  const raw = process.env?.[key];
  if (!raw) return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

export function envList(key: string, fallback: string): string[] {
  const raw = env(key, fallback);
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return items.length > 0 ? items : [fallback];
}
