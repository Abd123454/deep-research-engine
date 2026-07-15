/* content.js — Deep Research Engine content script.
 *
 * Runs on every page (<all_urls>). Responsibilities:
 *   1. expose extractPageContent() to the background/popup
 *   2. listen for messages from the extension requesting page content
 *   3. optionally render a floating "Research with AI" button (off by default)
 *
 * Uses the `browser` API with a `chrome` fallback for Firefox/Chrome compat.
 */

(() => {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;

  // ---------------------------------------------------------------------------
  // Page content extraction
  // ---------------------------------------------------------------------------

  /**
   * Extract a compact, useful representation of the current page.
   * Returns { title, url, text, description, headings }.
   *
   * `text` is capped at 10k chars to stay within the quick-mode API limit
   * and to keep payloads small for storage / streaming.
   */
  function extractPageContent() {
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
      .slice(0, 50); // cap to keep payload reasonable

    const rawText = (document.body?.innerText || "").replace(/\s+\n/g, "\n").trim();
    const text = rawText.slice(0, 10000);

    return {
      title: document.title || location.href,
      url: location.href,
      text,
      description: metaDesc || ogDesc,
      headings,
      extractedAt: new Date().toISOString(),
    };
  }

  // Expose on window so popup/background can also call via scripting.executeScript
  // (useful as a fallback path when message passing fails).
  try {
    Object.defineProperty(window, "__deepResearchExtractPageContent", {
      value: extractPageContent,
      configurable: false,
      writable: false,
    });
  } catch {
    // some pages lock window; ignore.
  }

  // ---------------------------------------------------------------------------
  // Message listener
  // ---------------------------------------------------------------------------

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "EXTRACT_PAGE_CONTENT") {
      try {
        sendResponse({ ok: true, data: extractPageContent() });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message || err) });
      }
      return true; // keep channel open for async sendResponse (sync here, but safe)
    }

    if (msg.type === "TOGGLE_FLOATING_BUTTON") {
      setFloatingButtonEnabled(!!msg.enabled);
      sendResponse({ ok: true, enabled: !!msg.enabled });
      return true;
    }

    return false;
  });

  // ---------------------------------------------------------------------------
  // Floating "Research with AI" button (off by default — toggle via settings)
  // ---------------------------------------------------------------------------

  let floatingBtn = null;
  let floatingEnabled = false;
  const FLOATING_BTN_ID = "__deep_research_floating_btn__";
  const FLOATING_STYLE_ID = "__deep_research_floating_style__";

  function injectFloatingStyles() {
    if (document.getElementById(FLOATING_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = FLOATING_STYLE_ID;
    style.textContent = `
      #${FLOATING_BTN_ID} {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483646;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 14px;
        border: none;
        border-radius: 999px;
        background: #107A6E;
        color: #fff;
        font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 6px 18px rgba(16,122,110,0.35), 0 2px 4px rgba(0,0,0,0.12);
        cursor: pointer;
        transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
        user-select: none;
      }
      #${FLOATING_BTN_ID}:hover {
        transform: translateY(-1px);
        background: #0e6a60;
        box-shadow: 0 8px 22px rgba(16,122,110,0.45);
      }
      #${FLOATING_BTN_ID}:active { transform: translateY(0); }
      #${FLOATING_BTN_ID} svg { width: 16px; height: 16px; flex: 0 0 16px; }
      @media (prefers-color-scheme: dark) {
        #${FLOATING_BTN_ID} {
          background: #14a89a;
          box-shadow: 0 6px 18px rgba(20,168,154,0.4), 0 2px 4px rgba(0,0,0,0.4);
        }
        #${FLOATING_BTN_ID}:hover { background: #16b8a9; }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function createFloatingButton() {
    if (floatingBtn) return floatingBtn;
    injectFloatingStyles();
    const btn = document.createElement("button");
    btn.id = FLOATING_BTN_ID;
    btn.type = "button";
    btn.title = "Research this page with AI";
    btn.setAttribute("aria-label", "Research this page with AI");
    btn.innerHTML = `
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <path fill="#fff" d="M64 24 L72 56 L104 64 L72 72 L64 104 L56 72 L24 64 L56 56 Z"/>
      </svg>
      <span>Research with AI</span>
    `;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        api.runtime.sendMessage({
          type: "FLOATING_BUTTON_CLICKED",
          payload: extractPageContent(),
        });
      } catch {
        // extension context invalidated (e.g. reloaded) — silently ignore
      }
    });
    // Use a rAF + body check to attach even on SPAs that replace body.
    const attach = () => {
      if (document.body && !document.body.contains(btn)) {
        document.body.appendChild(btn);
      }
    };
    attach();
    // Re-attach if removed by SPA navigations (lightweight observer).
    const mo = new MutationObserver(() => {
      if (floatingEnabled && !document.body.contains(btn)) attach();
    });
    mo.observe(document.documentElement, { childList: true, subtree: false });
    floatingBtn = btn;
    return btn;
  }

  function removeFloatingButton() {
    if (floatingBtn && floatingBtn.parentNode) {
      floatingBtn.parentNode.removeChild(floatingBtn);
    }
    floatingBtn = null;
  }

  function setFloatingButtonEnabled(enabled) {
    floatingEnabled = enabled;
    if (enabled) {
      createFloatingButton();
    } else {
      removeFloatingButton();
    }
  }

  // On load, read the stored setting and apply.
  // (Storage is async; do not block page render.)
  try {
    api.storage.sync.get({ showFloatingButton: false }, (res) => {
      if (res && res.showFloatingButton) {
        setFloatingButtonEnabled(true);
      }
    });
    // React to setting changes while the page is open.
    api.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.showFloatingButton) {
        setFloatingButtonEnabled(!!changes.showFloatingButton.newValue);
      }
    });
  } catch {
    // storage might be unavailable in rare contexts; ignore.
  }
})();
