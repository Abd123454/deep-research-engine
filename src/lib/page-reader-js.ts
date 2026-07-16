// JS-rendered page reading via Playwright (optional).
//
// This module is dynamically imported only when the direct fetch + Readability
// path returns too little text (indicating a JS-rendered SPA). Playwright is
// an optional dependency — if it's not installed, this module returns a clear
// "not available" error and the caller falls back gracefully.
//
// To enable: bun add playwright && bunx playwright install chromium
//
// Usage:
//   const result = await readPageWithJS(url);
//   if (result.success) { /* use result.text */ }

import type { Browser, BrowserType } from "playwright";

export interface JSPageResult {
  text: string;
  title: string;
  success: boolean;
  error?: string;
  tokensUsed: number;
  wordCount: number;
}

const TIMEOUT_MS = 15_000;
const MAX_TEXT_CHARS = 8000;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function readPageWithJS(url: string, signal?: AbortSignal): Promise<JSPageResult> {
  let chromium: BrowserType["launch"] | null = null;

  // Dynamic import — if Playwright isn't installed, return gracefully.
  // We use a variable to hold the module name so the bundler doesn't try
  // to statically resolve it (which would cause "Module not found" warnings
  // during build when playwright is not installed).
  try {
    const moduleName = "playwright";
    const playwright = await import(/* webpackIgnore: true */ /* @vite-ignore */ moduleName);
    chromium = playwright.chromium.launch;
  } catch {
    return {
      text: "",
      title: "",
      success: false,
      error: "Playwright not installed. Run: bun add playwright && bunx playwright install chromium",
      tokensUsed: 0,
      wordCount: 0,
    };
  }

  if (!chromium) {
    return {
      text: "",
      title: "",
      success: false,
      error: "Playwright chromium.launch not available",
      tokensUsed: 0,
      wordCount: 0,
    };
  }

  let browser: Browser | null = null;
  try {
    if (signal?.aborted) {
      throw new Error("Aborted before browser launch");
    }

    browser = await chromium({ headless: true });
    const page = await browser.newPage();

    // Navigate with timeout. waitUntil "domcontentloaded" is faster than
    // "networkidle" and sufficient for most SPA content.
    await page.goto(url, { timeout: TIMEOUT_MS, waitUntil: "domcontentloaded" });

    // Check abort after navigation.
    if (signal?.aborted) {
      throw new Error("Aborted during page load");
    }

    // Give SPAs a moment to render content. 1s is a balance between
    // catching React/Vue mounts and not wasting time on slow pages.
    await page.waitForTimeout(1000);

    // Extract text content, removing non-content elements.
    const text = await page.evaluate(() => {
      // Remove script, style, nav, footer, header, aside, ads.
      document
        .querySelectorAll("script, style, nav, footer, header, aside, [role='navigation'], .ad, .advertisement")
        .forEach((el) => el.remove());
      return (document.body as HTMLElement)?.innerText || "";
    });

    const title = await page.title();

    if (!text || text.length < 100) {
      return {
        text: "",
        title,
        success: false,
        error: "Page has too little text content after JS rendering",
        tokensUsed: 0,
        wordCount: 0,
      };
    }

    const truncated = text.slice(0, MAX_TEXT_CHARS);
    return {
      text: truncated,
      title,
      success: true,
      tokensUsed: 0,
      wordCount: countWords(truncated),
    };
  } catch (err) {
    // Handle abort specially.
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      return {
        text: "",
        title: "",
        success: false,
        error: "Aborted",
        tokensUsed: 0,
        wordCount: 0,
      };
    }
    return {
      text: "",
      title: "",
      success: false,
      error: err instanceof Error ? err.message : "Playwright failed",
      tokensUsed: 0,
      wordCount: 0,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore close errors
      }
    }
  }
}

/**
 * Check if Playwright is available without actually launching a browser.
 * Used by the page-reader to decide whether to attempt JS rendering.
 */
export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    const moduleName = "playwright";
    await import(/* webpackIgnore: true */ /* @vite-ignore */ moduleName);
    return true;
  } catch {
    return false;
  }
}
