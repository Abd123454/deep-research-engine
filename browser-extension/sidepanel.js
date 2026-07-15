/* sidepanel.js — Deep Research Engine side panel.
 *
 * Owns all streaming API calls (the side panel is long-lived, unlike a
 * service worker). Talks to the background worker only for:
 *   - reading/writing settings + pending actions + results (via storage)
 *   - delegating "Research/Deep/Swarm" actions that need page extraction
 *
 * SSE streaming uses fetch + ReadableStream (no EventSource — we need POST).
 */

(() => {
  "use strict";
  const api = typeof browser !== "undefined" ? browser : chrome;

  const $ = (id) => document.getElementById(id);
  const els = {
    messages: $("messages"),
    status: $("statusLine"),
    composer: $("composer"),
    input: $("composerInput"),
    send: $("sendBtn"),
    qaResearch: $("qaResearch"),
    qaDeep: $("qaDeep"),
    qaSwarm: $("qaSwarm"),
    historyToggle: $("historyToggle"),
    history: $("history"),
    historyList: $("historyList"),
    historyClose: $("historyClose"),
    clearHistory: $("clearHistory"),
  };

  let isStreaming = false;
  let abortController = null;
  let lastPage = null; // cached page content for follow-up questions

  // ---------------------------------------------------------------------------
  // Minimal, safe markdown renderer (escape-first, then format).
  // ---------------------------------------------------------------------------

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMarkdown(md) {
    if (!md) return "";
    // Pull out fenced code blocks first so their contents aren't mangled.
    const codeBlocks = [];
    let text = String(md).replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(
        `<pre><code class="lang-${escapeHtml(lang || "text")}">${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`
      );
      return `\u0000CODEBLOCK${idx}\u0000`;
    });

    // Escape everything else.
    text = escapeHtml(text);

    // Inline code.
    text = text.replace(/`([^`\n]+)`/g, (_m, c) => `<code>${c}</code>`);

    // Headers.
    text = text.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

    // Bold + italic.
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

    // Links [text](url) — url must be http/https/mailto to avoid javascript:.
    text = text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Blockquotes.
    text = text.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");

    // Lists (group consecutive items).
    text = text.replace(
      /(?:^[ \t]*[-*]\s+.+\n?)+/gm,
      (block) => {
        const items = block
          .trim()
          .split("\n")
          .map((l) => l.replace(/^\s*[-*]\s+/, ""))
          .map((l) => `<li>${l}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
    );
    text = text.replace(
      /(?:^[ \t]*\d+\.\s+.+\n?)+/gm,
      (block) => {
        const items = block
          .trim()
          .split("\n")
          .map((l) => l.replace(/^\s*\d+\.\s+/, ""))
          .map((l) => `<li>${l}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }
    );

    // Paragraphs + line breaks.
    const lines = text.split("\n");
    const out = [];
    let para = [];
    const flush = () => {
      if (para.length) {
        out.push(`<p>${para.join("<br/>")}</p>`);
        para = [];
      }
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line) {
        flush();
      } else if (/^<(h\d|ul|ol|pre|blockquote|div)/.test(line)) {
        flush();
        out.push(line);
      } else if (/^<\/(h\d|ul|ol|pre|blockquote|div)/.test(line)) {
        flush();
        out.push(line);
      } else if (line.startsWith("\u0000CODEBLOCK")) {
        flush();
        const idx = parseInt(line.replace(/\u0000CODEBLOCK(\d+)\u0000/, "$1"), 10);
        out.push(codeBlocks[idx] || "");
      } else {
        para.push(line);
      }
    }
    flush();

    return out.join("\n");
  }

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  function setStatus(text) {
    els.status.textContent = text;
  }

  function scrollMessagesToBottom() {
    requestAnimationFrame(() => {
      els.messages.scrollTop = els.messages.scrollHeight;
    });
  }

  function addMessage(role, contentHtml, opts = {}) {
    // Remove empty-state if present.
    const empty = els.messages.querySelector(".empty-state");
    if (empty) empty.remove();

    const msg = document.createElement("div");
    msg.className = `msg ${role}`;
    if (opts.id) msg.id = opts.id;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (role === "ai" && opts.streaming) bubble.classList.add("cursor");
    bubble.innerHTML = contentHtml;
    msg.appendChild(bubble);

    if (opts.meta) {
      const m = document.createElement("div");
      m.className = "msg-meta";
      m.textContent = opts.meta;
      msg.appendChild(m);
    }

    els.messages.appendChild(msg);
    scrollMessagesToBottom();
    return bubble;
  }

  function showEmptyState() {
    els.messages.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "empty-state";
    wrap.innerHTML = `
      <div class="ico">
        <svg viewBox="0 0 128 128" width="28" height="28" aria-hidden="true">
          <path fill="currentColor" d="M64 24 L72 56 L104 64 L72 72 L64 104 L56 72 L24 64 L56 56 Z"/>
        </svg>
      </div>
      <h2>Research anything, anywhere</h2>
      <p>Capture the current page, ask a quick question, kick off a deep research, or run a multi-agent swarm — all from this panel.</p>
    `;
    els.messages.appendChild(wrap);
  }

  function showTyping() {
    const bubble = addMessage("ai", `<div class="typing"><span></span><span></span><span></span></div>`, {
      id: "typing-bubble",
    });
    return bubble;
  }

  function removeTyping() {
    const t = $("typing-bubble");
    if (t && t.parentNode) t.parentNode.removeChild(t);
  }

  // ---------------------------------------------------------------------------
  // SSE parsing (fetch + ReadableStream; supports POST bodies)
  // ---------------------------------------------------------------------------

  /**
   * Stream an SSE endpoint. Calls onData(parsed) for each `data:` event.
   * Returns when the stream closes or errors.
   */
  async function streamSSE(url, body, { headers, onData, signal } = {}) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(headers || {}),
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j && j.error) msg = j.error;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    if (!res.body) {
      throw new Error("No response body (streaming not supported).");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line (\n\n).
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        // Each event may have multiple lines; we only care about `data:`.
        const dataLines = rawEvent
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).replace(/^\s/, ""));
        if (!dataLines.length) continue;
        const dataStr = dataLines.join("\n");
        if (!dataStr || dataStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(dataStr);
          onData(parsed);
        } catch {
          // Non-JSON data line — pass through as a token if it looks like text.
          onData({ token: dataStr });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Action executors (run inside the side panel for streaming reliability)
  // ---------------------------------------------------------------------------

  async function getSettings() {
    return new Promise((resolve) => {
      api.storage.sync.get(
        { baseUrl: "http://localhost:3000" },
        (s) => resolve(s || { baseUrl: "http://localhost:3000" })
      );
    });
  }

  function buildResearchPrompt(page) {
    if (!page) return "";
    const ctx = page.text ? `\n\n--- Page content ---\n${page.text}` : "";
    const head = page.headings && page.headings.length
      ? `\n\nHeadings: ${page.headings.slice(0, 10).join(" | ")}`
      : "";
    return `Please analyze the following web page and give a concise, well-structured summary with the key points, entities, and any notable claims. Use markdown.\n\nTitle: ${page.title}\nURL: ${page.url}${page.description ? `\nDescription: ${page.description}` : ""}${head}${ctx}`.slice(0, 10000);
  }

  async function executeAction(action) {
    if (!action || !action.intent) return;
    const baseUrl = (action.baseUrl || (await getSettings()).baseUrl || "").replace(/\/$/, "");
    lastPage = action.page || lastPage;

    if (action.intent === "researchPage") {
      await runQuick(baseUrl, buildResearchPrompt(action.page), {
        label: "Research",
        userEcho: `Research: ${action.page?.title || action.page?.url || "this page"}`,
      });
    } else if (action.intent === "quickQuestion") {
      await runQuick(baseUrl, action.body.message, {
        label: "Quick",
        userEcho: action.question || "Quick question",
      });
    } else if (action.intent === "swarmPage") {
      await runSwarm(baseUrl, action.body.task);
    } else if (action.intent === "deepResearch") {
      await runDeepResearch(baseUrl, action.body.query, action.body.depth);
    }
  }

  async function runQuick(baseUrl, message, { label, userEcho }) {
    if (isStreaming) return;
    beginStreaming();
    addMessage("user", escapeHtml(userEcho || message.slice(0, 200)));
    const typing = showTyping();
    let bubble = null;
    let acc = "";

    abortController = new AbortController();
    setStatus(`Streaming from ${baseUrl}…`);

    try {
      await streamSSE(
        `${baseUrl}/api/modes/quick`,
        { message },
        {
          onData: (evt) => {
            if (evt.token) {
              if (!bubble) {
                removeTyping();
                bubble = addMessage("ai", "", { streaming: true });
              }
              acc += evt.token;
              bubble.innerHTML = renderMarkdown(acc);
              scrollMessagesToBottom();
            }
            if (evt.done) {
              if (bubble) bubble.classList.remove("cursor");
              setStatus("Done");
            }
            if (evt.error) {
              throw new Error(evt.error);
            }
          },
          signal: abortController.signal,
        }
      );

      if (!bubble) {
        removeTyping();
        bubble = addMessage("ai", "<em>(no response)</em>");
      } else {
        bubble.classList.remove("cursor");
      }

      await saveResult({
        id: `r_${Date.now()}`,
        intent: label.toLowerCase(),
        label,
        title: (userEcho || "Quick research").slice(0, 120),
        content: acc,
        createdAt: Date.now(),
      });
    } catch (err) {
      removeTyping();
      if (bubble) bubble.classList.remove("cursor");
      if (err.name === "AbortError") {
        addMessage("system", "Stopped.");
      } else {
        addMessage("system", `Error: ${err.message}`);
      }
      setStatus("Error");
    } finally {
      endStreaming();
    }
  }

  async function runSwarm(baseUrl, task) {
    if (isStreaming) return;
    beginStreaming();
    addMessage("user", escapeHtml(`Swarm: ${task}`));
    const typing = showTyping();
    let bubble = null;
    let acc = "";
    let agentBubbles = {};

    abortController = new AbortController();
    setStatus("Swarm running…");

    try {
      await streamSSE(
        `${baseUrl}/api/swarm`,
        { task },
        {
          onData: (evt) => {
            // Swarm events: swarm_start, agent_start, agent_token,
            // agent_done, swarm_done, error.
            if (evt.type === "agent_start") {
              const name = evt.agent || `Agent ${evt.index ?? "?"}`;
              if (!bubble) {
                removeTyping();
                bubble = addMessage("ai", "", { streaming: true });
                bubble.innerHTML = `<p><strong>🐝 Swarm started</strong></p>`;
              }
              const id = `agent-${evt.index ?? name}`;
              agentBubbles[id] = name;
              bubble.innerHTML += `<p><strong>${escapeHtml(name)}</strong></p><div id="${id}"></div>`;
              scrollMessagesToBottom();
            } else if (evt.type === "agent_token") {
              const id = `agent-${evt.index ?? evt.agent ?? "?"}`;
              const slot = bubble && bubble.querySelector(`#${CSS.escape(id)}`);
              if (slot) {
                slot.innerHTML += escapeHtml(evt.token);
                scrollMessagesToBottom();
              } else if (bubble) {
                acc += evt.token;
                bubble.innerHTML += escapeHtml(evt.token);
                scrollMessagesToBottom();
              }
            } else if (evt.type === "agent_done") {
              // mark complete — no-op visually
            } else if (evt.type === "swarm_done") {
              if (bubble) bubble.classList.remove("cursor");
              if (evt.finalReport) {
                removeTyping();
                const rep = addMessage("ai", "", { streaming: false });
                rep.innerHTML = `<p><strong>📋 Final report</strong></p>${renderMarkdown(evt.finalReport)}`;
              }
              setStatus("Swarm done");
            } else if (evt.type === "error") {
              throw new Error(evt.message || "Swarm error");
            } else if (evt.type === "swarm_start") {
              if (!bubble) {
                removeTyping();
                bubble = addMessage("ai", `<p><strong>🐝 Swarm started</strong> — ${escapeHtml(evt.agents ? `${evt.agents.length} agents` : "")}</p>`, { streaming: true });
              }
            }
          },
          signal: abortController.signal,
        }
      );

      if (bubble) bubble.classList.remove("cursor");

      await saveResult({
        id: `s_${Date.now()}`,
        intent: "swarm",
        label: "Swarm",
        title: task.slice(0, 120),
        content: acc,
        createdAt: Date.now(),
      });
    } catch (err) {
      removeTyping();
      if (bubble) bubble.classList.remove("cursor");
      if (err.name === "AbortError") {
        addMessage("system", "Stopped.");
      } else {
        addMessage("system", `Error: ${err.message}`);
      }
      setStatus("Error");
    } finally {
      endStreaming();
    }
  }

  async function runDeepResearch(baseUrl, query, depth) {
    if (isStreaming) return;
    beginStreaming();
    addMessage("user", escapeHtml(`Deep research: ${query}`));
    const bubble = addMessage("ai", `<p>Starting deep research…</p>`, { streaming: true });
    setStatus("Starting deep research…");

    abortController = new AbortController();

    let jobId = null;
    try {
      const res = await fetch(`${baseUrl}/api/research/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, depth: depth || "deep" }),
        signal: abortController.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      jobId = data.id;
      bubble.innerHTML = `<p>Deep research job <code>${escapeHtml(jobId)}</code> started.</p><p class="msg-meta">Polling status…</p>`;
      setStatus("Researching…");

      // Poll status every 2.5s until done.
      const finalReport = await pollJob(baseUrl, jobId, bubble);
      bubble.classList.remove("cursor");
      if (finalReport) {
        const rep = addMessage("ai", `<p><strong>📋 Final report</strong></p>${renderMarkdown(finalReport)}`);
      }
      await saveResult({
        id: `d_${Date.now()}`,
        intent: "deep",
        label: "Deep research",
        title: query.slice(0, 120),
        content: finalReport || "(no report)",
        jobId,
        createdAt: Date.now(),
      });
    } catch (err) {
      bubble.classList.remove("cursor");
      if (err.name === "AbortError") {
        addMessage("system", "Stopped.");
      } else {
        addMessage("system", `Error: ${err.message}`);
      }
      setStatus("Error");
    } finally {
      endStreaming();
    }
  }

  async function pollJob(baseUrl, jobId, bubble) {
    const maxAttempts = 240; // 10 min @ 2.5s
    for (let i = 0; i < maxAttempts; i++) {
      if (abortController && abortController.signal.aborted) {
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      }
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const res = await fetch(`${baseUrl}/api/research/status/${jobId}`);
        const data = await res.json();
        if (!data.ok) continue;
        const job = data.job;
        const status = job && job.status;
        const progress = job && job.progress;
        const phase = job && job.phase;
        let line = `Status: ${status || "…"}`;
        if (phase) line += ` · ${phase}`;
        if (progress && progress.total) {
          line += ` (${progress.done}/${progress.total})`;
        }
        bubble.innerHTML = `<p>${escapeHtml(line)}</p>`;
        setStatus(line);
        scrollMessagesToBottom();

        if (status === "complete") {
          const rep = (job && job.report) || (job && job.result && job.result.report) || "";
          return rep;
        }
        if (status === "error" || status === "failed") {
          throw new Error((job && job.error) || "Research failed");
        }
      } catch (err) {
        if (err.name === "AbortError") throw err;
        // network blip — keep polling
      }
    }
    throw new Error("Timed out waiting for research to complete.");
  }

  // ---------------------------------------------------------------------------
  // Streaming state
  // ---------------------------------------------------------------------------

  function beginStreaming() {
    isStreaming = true;
    els.send.disabled = true;
    els.send.innerHTML = `<span class="spinner"></span>`;
    els.qaResearch.disabled = els.qaDeep.disabled = els.qaSwarm.disabled = true;
  }

  function endStreaming() {
    isStreaming = false;
    abortController = null;
    els.send.disabled = false;
    els.send.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 11l18-8-8 18-2-8-8-2z"/></svg>`;
    els.qaResearch.disabled = els.qaDeep.disabled = els.qaSwarm.disabled = false;
  }

  // ---------------------------------------------------------------------------
  // Persistence (history)
  // ---------------------------------------------------------------------------

  function saveResult(result) {
    return new Promise((resolve) => {
      api.storage.local.get({ results: [], lastResult: null }, (res) => {
        const list = Array.isArray(res.results) ? res.results : [];
        list.unshift(result);
        api.storage.local.set(
          { results: list.slice(0, 20), lastResult: result },
          () => {
            renderHistory();
            resolve();
          }
        );
      });
    });
  }

  function fmtTime(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function renderHistory() {
    api.storage.local.get({ results: [] }, (res) => {
      const list = res.results || [];
      if (!list.length) {
        els.historyList.innerHTML = `<p class="history-empty">No research yet.</p>`;
        return;
      }
      els.historyList.innerHTML = "";
      for (const r of list) {
        const item = document.createElement("div");
        item.className = "history-item";
        item.innerHTML = `
          <p class="hi-title">${escapeHtml(r.title || "Untitled")}</p>
          <div class="hi-meta">
            <span class="badge">${escapeHtml(r.label || r.intent || "result")}</span>
            <span>${fmtTime(r.createdAt)}</span>
          </div>
        `;
        item.addEventListener("click", () => {
          showResult(r);
          toggleHistory(false);
        });
        els.historyList.appendChild(item);
      }
    });
  }

  function showResult(r) {
    els.messages.innerHTML = "";
    addMessage("user", escapeHtml(r.title || "Past result"), { meta: fmtTime(r.createdAt) });
    addMessage("ai", renderMarkdown(r.content || "(empty)"));
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------

  function sendBackground(type, extra) {
    return new Promise((resolve) => {
      api.runtime.sendMessage({ type, ...extra }, (res) => {
        if (api.runtime.lastError) {
          resolve({ ok: false, error: api.runtime.lastError.message });
        } else {
          resolve(res || { ok: false });
        }
      });
    });
  }

  // Composer submit → quick question (uses cached lastPage if available).
  els.composer.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isStreaming) {
      // Second press while streaming = stop.
      if (abortController) abortController.abort();
      return;
    }
    const q = els.input.value.trim();
    if (!q) return;
    els.input.value = "";
    els.input.style.height = "auto";

    const baseUrl = ((await getSettings()).baseUrl || "").replace(/\/$/, "");
    const ctx = lastPage
      ? `\n\n--- Page context ---\nTitle: ${lastPage.title}\nURL: ${lastPage.url}${lastPage.description ? `\nDescription: ${lastPage.description}` : ""}\n${(lastPage.text || "").slice(0, 6000)}`
      : "";
    const message = `Question: ${q}${ctx}\n\nAnswer concisely. Use markdown when helpful.`.slice(0, 10000);
    await runQuick(baseUrl, message, { label: "Quick", userEcho: q });
  });

  // Auto-grow textarea.
  els.input.addEventListener("input", () => {
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 120) + "px";
  });
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      els.composer.requestSubmit();
    }
  });

  // Quick-action chips → delegate to background (which extracts the page).
  els.qaResearch.addEventListener("click", async () => {
    if (isStreaming) return;
    setStatus("Extracting page…");
    const res = await sendBackground("RESEARCH_PAGE");
    if (!res || !res.ok) {
      addMessage("system", `Could not start: ${res?.error || "unknown"}`);
      setStatus("Ready");
      return;
    }
    await executeAction(res.action);
  });

  els.qaDeep.addEventListener("click", async () => {
    if (isStreaming) return;
    setStatus("Extracting page…");
    const res = await sendBackground("DEEP_RESEARCH");
    if (!res || !res.ok) {
      addMessage("system", `Could not start: ${res?.error || "unknown"}`);
      setStatus("Ready");
      return;
    }
    await executeAction(res.action);
  });

  els.qaSwarm.addEventListener("click", async () => {
    if (isStreaming) return;
    setStatus("Extracting page…");
    const res = await sendBackground("SWARM_PAGE");
    if (!res || !res.ok) {
      addMessage("system", `Could not start: ${res?.error || "unknown"}`);
      setStatus("Ready");
      return;
    }
    await executeAction(res.action);
  });

  // History drawer.
  function toggleHistory(force) {
    const shouldShow =
      typeof force === "boolean" ? force : els.history.hasAttribute("hidden");
    if (shouldShow) {
      els.history.removeAttribute("hidden");
      renderHistory();
    } else {
      els.history.setAttribute("hidden", "");
    }
  }
  els.historyToggle.addEventListener("click", () => toggleHistory());
  els.historyClose.addEventListener("click", () => toggleHistory(false));

  els.clearHistory.addEventListener("click", () => {
    if (!confirm("Clear all saved research?")) return;
    api.storage.local.set({ results: [], lastResult: null }, () => {
      renderHistory();
    });
  });

  // React to pending actions set by the background worker.
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.pendingAction && changes.pendingAction.newValue) {
      const action = changes.pendingAction.newValue;
      // Clear it so re-opening the panel doesn't re-run it.
      api.storage.local.remove("pendingAction");
      executeAction(action);
    }
  });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  showEmptyState();
  renderHistory();

  // On open, check for a pending action (popup may have set one just before
  // the panel opened).
  api.storage.local.get({ pendingAction: null }, (res) => {
    if (res && res.pendingAction) {
      api.storage.local.remove("pendingAction");
      executeAction(res.pendingAction);
    }
  });

  setStatus("Ready");
})();
