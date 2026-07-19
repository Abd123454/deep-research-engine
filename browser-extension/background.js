/* background.js — Quaesitor service worker (Manifest V3).
 *
 * Responsibilities:
 *   1. action.onClicked → open the side panel (defensive; popup usually
 *      intercepts the click, but we honour the spec and also support the
 *      no-popup / Firefox sidebarAction case).
 *   2. Message hub: popup & content scripts talk to us; we extract page
 *      content from the active tab, build a "pending action", stash it in
 *      chrome.storage.local, and (in Chrome) open the side panel which then
 *      performs the actual streaming API call.
 *   3. Persist the last result + a rolling history (last 20) in local storage.
 *
 * Why the side panel does the streaming (not the service worker):
 *   MV3 service workers can be terminated mid-stream, which would abort
 *   long SSE responses. The side panel is a long-lived document, so it owns
 *   the fetch + ReadableStream. Background just sets up the action.
 *
 * Chrome/Firefox compatibility: we prefer `chrome.` and fall back to `browser.`.
 *
 * H-6 (CVSS 6.0): previously the manifest declared
 *   "host_permissions": ["<all_urls>"]
 *   "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content.js"] }]
 * which auto-injected content.js into EVERY page the user visited — a
 * broad privilege grant that any compromised extension version (or a
 * malicious update) could abuse to read every page. We now rely on the
 * `activeTab` permission, which grants tab access ONLY when the user
 * invokes the extension (clicks the toolbar icon, opens the side panel,
 * or uses the context menu). Page content is extracted on demand via
 * `chrome.scripting.executeScript`. The optional floating-button
 * feature is now injected on demand per-tab when the user enables it,
 * rather than running on every page load.
 */

(() => {
  "use strict";
  const api = typeof browser !== "undefined" ? browser : chrome;

  const DEFAULTS = {
    baseUrl: "http://localhost:3000",
    showFloatingButton: false,
  };

  // ---------------------------------------------------------------------------
  // Settings helpers
  // ---------------------------------------------------------------------------

  function getSettings() {
    return new Promise((resolve) => {
      api.storage.sync.get(DEFAULTS, (res) => {
        resolve(res || DEFAULTS);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Side panel opening (Chrome sidePanel API; Firefox fallback to new tab)
  // ---------------------------------------------------------------------------

  async function openSidePanel(windowId) {
    // Chrome 114+ sidePanel API.
    if (api.sidePanel && typeof api.sidePanel.open === "function") {
      try {
        await api.sidePanel.open({ windowId });
        // Make sure the panel is enabled for this window.
        if (api.sidePanel.setOptions) {
          api.sidePanel.setOptions({
            enabled: true,
            path: "sidepanel.html",
          });
        }
        return true;
      } catch {
        // fall through
      }
    }
    // Firefox: open sidepanel.html in a new tab as a graceful fallback.
    if (api.tabs && api.tabs.create) {
      await api.tabs.create({ url: api.runtime.getURL("sidepanel.html") });
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Active tab helper
  // ---------------------------------------------------------------------------

  function getActiveTab() {
    return new Promise((resolve) => {
      api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs && tabs[0] ? tabs[0] : null);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Page content extraction (talks to content.js; falls back to executeScript)
  // ---------------------------------------------------------------------------

  async function extractFromTab(tab) {
    if (!tab || !tab.id) {
      return { ok: false, error: "No active tab." };
    }

    // Try messaging the content script first (fast path).
    const viaMessage = await new Promise((resolve) => {
      try {
        api.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_CONTENT" }, (resp) => {
          if (api.runtime.lastError) {
            resolve(null);
          } else {
            resolve(resp);
          }
        });
      } catch {
        resolve(null);
      }
    });

    if (viaMessage && viaMessage.ok) {
      return viaMessage;
    }

    // Fallback: inject a one-shot extractor via chrome.scripting.
    if (api.scripting && api.scripting.executeScript) {
      try {
        const [res] = await api.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              const metaDesc =
                document
                  .querySelector('meta[name="description"]')
                  ?.getAttribute("content")
                  ?.trim() || "";
              const ogDesc =
                document
                  .querySelector('meta[property="og:description"]')
                  ?.getAttribute("content")
                  ?.trim() || "";
              const headings = Array.from(
                document.querySelectorAll("h1, h2, h3")
              )
                .map((h) => h.innerText.trim())
                .filter(Boolean)
                .slice(0, 50);
              const text = (document.body?.innerText || "")
                .replace(/\s+\n/g, "\n")
                .trim()
                .slice(0, 10000);
              return {
                ok: true,
                data: {
                  title: document.title || location.href,
                  url: location.href,
                  text,
                  description: metaDesc || ogDesc,
                  headings,
                  extractedAt: new Date().toISOString(),
                },
              };
            } catch (e) {
              return { ok: false, error: String(e && e.message || e) };
            }
          },
        });
        if (res && res.result) {
          return res.result;
        }
      } catch {
        // fall through
      }
    }

    // Last resort: just use the tab's title/url.
    return {
      ok: true,
      data: {
        title: tab.title || tab.url || "",
        url: tab.url || "",
        text: "",
        description: "",
        headings: [],
        extractedAt: new Date().toISOString(),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Pending-action + result storage
  // ---------------------------------------------------------------------------

  function setPendingAction(action) {
    return new Promise((resolve) => {
      api.storage.local.set({ pendingAction: action }, () => resolve());
    });
  }

  function appendResult(result) {
    return new Promise((resolve) => {
      api.storage.local.get({ results: [], lastResult: null }, (res) => {
        const list = Array.isArray(res.results) ? res.results : [];
        list.unshift(result); // newest first
        const capped = list.slice(0, 20);
        api.storage.local.set(
          { results: capped, lastResult: result },
          () => resolve(result)
        );
      });
    });
  }

  // Build a short topic string from page content (used for deep research).
  function deriveTopic(page) {
    if (!page) return "";
    const heading = page.headings && page.headings[0];
    const base = heading || page.title || page.url || "";
    const desc = page.description ? ` — ${page.description.slice(0, 160)}` : "";
    return `${base}${desc}`.slice(0, 500);
  }

  // Build a "research this page" prompt for the quick endpoint.
  function buildResearchPrompt(page) {
    const ctx = page.text
      ? `\n\n--- Page content ---\n${page.text}`
      : "";
    const head = page.headings && page.headings.length
      ? `\n\nHeadings: ${page.headings.slice(0, 10).join(" | ")}`
      : "";
    return `Please analyze the following web page and give a concise, well-structured summary with the key points, entities, and any notable claims. Use markdown.\n\nTitle: ${page.title}\nURL: ${page.url}${page.description ? `\nDescription: ${page.description}` : ""}${head}${ctx}`.slice(0, 10000);
  }

  function buildQuickQuestionPrompt(page, question) {
    const ctx = page.text
      ? `\n\n--- Page content for context ---\n${page.text.slice(0, 8000)}`
      : "";
    return `Question about this page: ${question}\n\nPage title: ${page.title}\nPage URL: ${page.url}${page.description ? `\nPage description: ${page.description}` : ""}${ctx}\n\nAnswer the question using the page content above. If the page doesn't contain the answer, say so. Use markdown when helpful.`.slice(0, 10000);
  }

  // ---------------------------------------------------------------------------
  // Message router
  // ---------------------------------------------------------------------------

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return;

    (async () => {
      try {
        switch (msg.type) {
          case "OPEN_SIDE_PANEL": {
            const win = sender.tab && sender.tab.windowId;
            const ok = await openSidePanel(win);
            sendResponse({ ok });
            return;
          }

          case "RESEARCH_PAGE":
          case "QUICK_QUESTION":
          case "DEEP_RESEARCH":
          case "SWARM_PAGE": {
            const tab = await getActiveTab();
            const extraction = await extractFromTab(tab);
            if (!extraction.ok) {
              sendResponse({ ok: false, error: extraction.error });
              return;
            }
            const page = extraction.data;
            const settings = await getSettings();

            let action;
            if (msg.type === "RESEARCH_PAGE") {
              action = {
                intent: "researchPage",
                endpoint: "/api/modes/quick",
                method: "POST",
                body: { message: buildResearchPrompt(page) },
                page,
                baseUrl: settings.baseUrl,
                createdAt: Date.now(),
              };
            } else if (msg.type === "QUICK_QUESTION") {
              const q = (msg.question || "").trim();
              if (!q) {
                sendResponse({ ok: false, error: "Question is required." });
                return;
              }
              action = {
                intent: "quickQuestion",
                endpoint: "/api/modes/quick",
                method: "POST",
                body: { message: buildQuickQuestionPrompt(page, q) },
                question: q,
                page,
                baseUrl: settings.baseUrl,
                createdAt: Date.now(),
              };
            } else if (msg.type === "DEEP_RESEARCH") {
              action = {
                intent: "deepResearch",
                endpoint: "/api/research/start",
                method: "POST",
                body: { query: deriveTopic(page), depth: "deep" },
                page,
                baseUrl: settings.baseUrl,
                createdAt: Date.now(),
              };
            } else {
              // SWARM_PAGE
              action = {
                intent: "swarmPage",
                endpoint: "/api/swarm",
                method: "POST",
                body: { task: deriveTopic(page) },
                page,
                baseUrl: settings.baseUrl,
                createdAt: Date.now(),
              };
            }

            await setPendingAction(action);
            // Open the side panel (user-gesture was in popup; Chrome allows
            // sidePanel.open from a worker only if invoked during the
            // message round-trip — best effort; side panel also auto-runs
            // pending action on open).
            await openSidePanel(tab && tab.windowId);
            sendResponse({ ok: true, action });
            return;
          }

          case "FLOATING_BUTTON_CLICKED": {
            // From content.js. payload = extracted page content.
            const page = msg.payload || null;
            const settings = await getSettings();
            const action = {
              intent: "researchPage",
              endpoint: "/api/modes/quick",
              method: "POST",
              body: { message: buildResearchPrompt(page || { title: "", url: "", text: "" }) },
              page: page || { title: "", url: "", text: "" },
              baseUrl: settings.baseUrl,
              createdAt: Date.now(),
            };
            await setPendingAction(action);
            await openSidePanel(sender.tab && sender.tab.windowId);
            sendResponse({ ok: true });
            return;
          }

          case "SAVE_RESULT": {
            const r = msg.result;
            if (r) {
              await appendResult(r);
            }
            sendResponse({ ok: true });
            return;
          }

          case "GET_SETTINGS": {
            const s = await getSettings();
            sendResponse({ ok: true, settings: s });
            return;
          }

          case "SET_SETTINGS": {
            await new Promise((resolve) => {
              api.storage.sync.set({ ...msg.settings }, resolve);
            });
            // H-6: Propagate floating-button toggle to all tabs. Without
            // <all_urls> in host_permissions, content.js is no longer
            // auto-injected — we must inject it on demand via
            // chrome.scripting.executeScript (allowed because we have the
            // `scripting` permission + `activeTab` covers user-initiated
            // invocations). When the user toggles the floating button OFF,
            // we send the TOGGLE message to any tab where content.js is
            // already loaded; on failure we silently skip (the tab either
            // hasn't had content.js injected yet, or the user navigated
            // away). When toggled ON, we inject content.js (idempotent if
            // already injected) then send the TOGGLE message.
            if (msg.settings && typeof msg.settings.showFloatingButton !== "undefined") {
              const enabled = !!msg.settings.showFloatingButton;
              const tabs = await new Promise((r) => api.tabs.query({}, r));
              for (const t of tabs) {
                if (!t.id) continue;
                // Skip chrome://, edge://, about: pages — scripting
                // is not allowed on browser-internal URLs.
                const url = t.url || "";
                if (/^(chrome|edge|about|moz-extension|chrome-extension):/i.test(url)) {
                  continue;
                }
                if (enabled && api.scripting && api.scripting.executeScript) {
                  try {
                    await api.scripting.executeScript({
                      target: { tabId: t.id },
                      files: ["content.js"],
                    });
                  } catch {
                    // Tab may have navigated away or refused injection
                    // (e.g. web store pages). Silently skip — the user
                    // can re-toggle from a normal page.
                  }
                }
                api.tabs.sendMessage(
                  t.id,
                  { type: "TOGGLE_FLOATING_BUTTON", enabled },
                  () => void api.runtime.lastError
                );
              }
            }
            sendResponse({ ok: true });
            return;
          }

          default:
            sendResponse({ ok: false, error: "Unknown message type." });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message || err) });
      }
    })();

    return true; // async sendResponse
  });

  // ---------------------------------------------------------------------------
  // action.onClicked → open side panel
  // (Fires only when no default_popup is set. With our popup it normally
  //  won't fire; kept per spec + for the no-popup Firefox sidebarAction case.)
  // ---------------------------------------------------------------------------

  if (api.action && api.action.onClicked) {
    api.action.onClicked.addListener(async (tab) => {
      await openSidePanel(tab && tab.windowId);
    });
  }

  // Set side panel options at install/startup (Chrome).
  if (api.sidePanel && api.sidePanel.setOptions) {
    try {
      api.sidePanel.setOptions({
        enabled: true,
        path: "sidepanel.html",
      });
    } catch {
      // ignore — some contexts disallow this.
    }
  }

  // Startup log (visible in service worker devtools console).
  console.log("[Quaesitor] background service worker ready.");
})();
