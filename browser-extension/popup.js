/* popup.js — Cognis popup logic.
 *
 * Talks to the background service worker for every action (extraction,
 * side-panel opening, streaming). The popup itself stays thin.
 */

(() => {
  "use strict";
  const api = typeof browser !== "undefined" ? browser : chrome;

  const $ = (id) => document.getElementById(id);

  const els = {
    research: $("researchBtn"),
    quick: $("quickBtn"),
    quickInput: $("quickInput"),
    deep: $("deepBtn"),
    swarm: $("swarmBtn"),
    openPanel: $("openPanelBtn"),
    baseUrl: $("baseUrlInput"),
    floating: $("floatingToggle"),
    save: $("saveSettingsBtn"),
    saved: $("savedMsg"),
    pageInfo: $("pageInfo"),
  };

  // ---------------------------------------------------------------------------
  // Settings load/save
  // ---------------------------------------------------------------------------

  function loadSettings() {
    api.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
      if (api.runtime.lastError) return;
      if (res && res.ok && res.settings) {
        els.baseUrl.value = res.settings.baseUrl || "";
        els.floating.checked = !!res.settings.showFloatingButton;
      }
    });
  }

  function saveSettings() {
    const settings = {
      baseUrl: els.baseUrl.value.trim() || "http://localhost:3000",
      showFloatingButton: !!els.floating.checked,
    };
    els.save.disabled = true;
    api.runtime.sendMessage({ type: "SET_SETTINGS", settings }, (res) => {
      els.save.disabled = false;
      if (res && res.ok) {
        els.saved.textContent = "Saved ✓";
        setTimeout(() => (els.saved.textContent = ""), 1600);
      } else {
        els.saved.textContent = "Failed to save";
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Action helpers
  // ---------------------------------------------------------------------------

  function sendAction(type, extra) {
    return new Promise((resolve) => {
      api.runtime.sendMessage({ type, ...extra }, (res) => {
        if (api.runtime.lastError) {
          resolve({ ok: false, error: api.runtime.lastError.message });
        } else {
          resolve(res || { ok: false, error: "No response" });
        }
      });
    });
  }

  function withSpinner(btn, fn) {
    return async () => {
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span><span>Working…</span>`;
      try {
        await fn();
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
        // Close the popup so the side panel takes focus (best effort).
        setTimeout(() => window.close(), 250);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Wire up buttons
  // ---------------------------------------------------------------------------

  els.research.addEventListener(
    "click",
    withSpinner(els.research, () => sendAction("RESEARCH_PAGE"))
  );

  els.quick.addEventListener("click", () => {
    const q = els.quickInput.value.trim();
    if (!q) {
      els.quickInput.focus();
      return;
    }
    withSpinner(els.quick, () => sendAction("QUICK_QUESTION", { question: q }))();
  });

  els.quickInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.quick.click();
    }
  });

  els.deep.addEventListener(
    "click",
    withSpinner(els.deep, () => sendAction("DEEP_RESEARCH"))
  );

  els.swarm.addEventListener(
    "click",
    withSpinner(els.swarm, () => sendAction("SWARM_PAGE"))
  );

  els.openPanel.addEventListener("click", () => {
    api.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" }, () => {
      setTimeout(() => window.close(), 200);
    });
  });

  els.save.addEventListener("click", saveSettings);

  els.baseUrl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveSettings();
  });

  // ---------------------------------------------------------------------------
  // Show current tab info in the footer
  // ---------------------------------------------------------------------------

  api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const t = tabs && tabs[0];
    if (t) {
      els.pageInfo.textContent = t.title
        ? `${t.title} — ${t.url}`
        : t.url || "Unknown tab";
      els.pageInfo.title = els.pageInfo.textContent;
    } else {
      els.pageInfo.textContent = "No active tab";
    }
  });

  loadSettings();
})();
