// Module declaration for optional `playwright` dependency.
//
// Playwright is an optional dependency — it's only needed for JS-rendered
// page reading (SPA sites). If it's not installed, the page-reader-js module
// returns a graceful "not available" error.
//
// This declaration prevents TypeScript from failing when `playwright` is not
// in node_modules. The runtime `await import("playwright")` in page-reader-js.ts
// catches the "module not found" error gracefully.

declare module "playwright" {
  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }
  export interface Page {
    goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
    waitForTimeout(ms: number): Promise<void>;
    waitForLoadState(state?: string): Promise<void>;
    title(): Promise<string>;
    evaluate<T>(fn: () => T): Promise<T>;
  }
  export interface BrowserType {
    launch(options?: { headless?: boolean }): Promise<Browser>;
  }
  export const chromium: BrowserType;
  export const firefox: BrowserType;
  export const webkit: BrowserType;
}
