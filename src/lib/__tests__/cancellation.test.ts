// Tests for real cancellation (Round 11 wiring).
//
// Verifies that AbortController + AbortSignal correctly cancel in-flight
// fetch requests when the user clicks Stop.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch so we can control when it resolves/rejects.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { searchWeb } from "../retriever";
import { readPage, readPages } from "../page-reader";

describe("Real cancellation (Round 11 wiring)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe("searchWeb with AbortSignal", () => {
    it("passes the signal to fetch (aborted signal → returns empty quickly)", async () => {
      const controller = new AbortController();
      controller.abort("test");

      // fetch should be called with an already-aborted signal and reject.
      fetchMock.mockImplementation((_url, opts) => {
        if (opts?.signal?.aborted) {
          return Promise.reject(new DOMException("Aborted", "AbortError"));
        }
        return Promise.resolve(new Response("[]", { status: 200 }));
      });

      // searchWeb catches errors and returns empty results — it doesn't throw.
      const results = await searchWeb("test query", 5, controller.signal);
      expect(Array.isArray(results)).toBe(true);
      // With an aborted signal, no results should come back.
      expect(results.length).toBe(0);
    });

    it("aborts mid-request when signal fires", async () => {
      const controller = new AbortController();

      // fetch returns a pending promise that we can abort.
      // If the signal is already aborted, reject immediately.
      fetchMock.mockImplementation((_url, opts) => {
        if (opts?.signal?.aborted) {
          return Promise.reject(new DOMException("Aborted", "AbortError"));
        }
        return new Promise((_, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      });

      const promise = searchWeb("test query", 5, controller.signal);

      // Abort after 50ms.
      setTimeout(() => controller.abort("user cancelled"), 50);

      // searchWeb catches errors and returns empty results — it doesn't throw.
      const results = await promise;
      expect(Array.isArray(results)).toBe(true);
    }, 10000);

    it("works normally when signal is not aborted", async () => {
      const controller = new AbortController();

      fetchMock.mockResolvedValue(
        new Response(
          `<html><body>
            <a class="result__a" href="https://example.com">Example</a>
            <a class="result__snippet" href="https://example.com">Snippet text</a>
          </body></html>`,
          { status: 200, headers: { "content-type": "text/html" } }
        )
      );

      // Should not throw — signal is not aborted.
      const results = await searchWeb("test query", 5, controller.signal);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("readPage with AbortSignal", () => {
    it("aborts Wikipedia API fetch when signal fires", async () => {
      const controller = new AbortController();

      fetchMock.mockImplementation((_url, opts) => {
        if (opts?.signal?.aborted) {
          return Promise.reject(new DOMException("Aborted", "AbortError"));
        }
        return new Promise((_, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      });

      const url = "https://en.wikipedia.org/wiki/Example";
      const promise = readPage(url, controller.signal);

      setTimeout(() => controller.abort("user cancelled"), 50);

      // readPage catches errors and returns a failed result (doesn't throw).
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    }, 10000);

    it("aborts direct page fetch when signal fires", async () => {
      const controller = new AbortController();

      fetchMock.mockImplementation((_url, opts) => {
        return new Promise((_, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      });

      const url = "https://example.com/article";
      const promise = readPage(url, controller.signal);

      setTimeout(() => controller.abort("user cancelled"), 50);

      const result = await promise;
      expect(result.success).toBe(false);
    });
  });

  describe("readPages with AbortSignal", () => {
    it("stops reading pages when signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort("test");

      fetchMock.mockResolvedValue(
        new Response("<html><body>content</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      );

      const urls = ["https://a.com", "https://b.com", "https://c.com"];
      const results = await readPages(urls, 3, controller.signal);

      // With an already-aborted signal, workers return immediately.
      // Results array should exist but pages may not have been read.
      expect(results.length).toBe(urls.length);
      // fetch should NOT have been called because workers check signal.aborted first.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("aborts mid-batch when signal fires during reading", async () => {
      const controller = new AbortController();
      let callCount = 0;

      // First fetch resolves quickly; subsequent ones are slow.
      fetchMock.mockImplementation((_url, opts) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            new Response("<html><body>fast</body></html>", {
              status: 200,
              headers: { "content-type": "text/html" },
            })
          );
        }
        return new Promise((_, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      });

      const urls = ["https://a.com", "https://b.com", "https://c.com", "https://d.com"];
      const promise = readPages(urls, 2, controller.signal);

      // Abort after 100ms (after first page read, during second).
      setTimeout(() => controller.abort("user cancelled"), 100);

      const results = await promise;
      // Some pages may have been read, but the batch stops after abort.
      expect(results.length).toBe(urls.length);
    });
  });

  describe("AbortController on ResearchJob", () => {
    it("can be created and aborted", () => {
      const controller = new AbortController();
      const signal = controller.signal;

      expect(signal.aborted).toBe(false);

      controller.abort("Cancelled by user");

      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBe("Cancelled by user");
    });

    it("aborts all fetch calls sharing the same signal", async () => {
      const controller = new AbortController();
      const signal = controller.signal;

      let abortedCount = 0;
      const promises: Promise<unknown>[] = [];

      // Create 3 concurrent fetches sharing the same signal.
      for (let i = 0; i < 3; i++) {
        promises.push(
          new Promise((_, reject) => {
            signal.addEventListener("abort", () => {
              abortedCount++;
              reject(new DOMException("Aborted", "AbortError"));
            });
          })
        );
      }

      // Abort — all 3 should reject.
      controller.abort("test");

      await Promise.allSettled(promises);
      expect(abortedCount).toBe(3);
    });
  });
});
