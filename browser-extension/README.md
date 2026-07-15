# Cognis — Browser Extension

A Manifest V3 browser extension (Chrome & Firefox) that lets you capture the
current page and send it to the **Cognis** web app for analysis.

> Capture a page → ask a quick question, get a summary, run a deep research
> pipeline, or unleash a multi-agent swarm — all from a popup or a side panel.

---

## Features

- **Research this page** — extracts the page text, headings, and metadata, then
  streams an AI analysis via `/api/modes/quick`.
- **Quick question** — ask one-off questions about the current page (uses page
  content as context).
- **Deep research** — starts a full asynchronous research pipeline via
  `/api/research/start` and polls `/api/research/status/:id` until the report
  is ready.
- **Swarm** — runs a multi-agent swarm analysis via `/api/swarm` and streams
  per-agent tokens plus the final consolidated report.
- **Side panel** — a mini chat UI with:
  - streaming responses (SSE) rendered as markdown
  - follow-up questions (uses the last page as context)
  - a history drawer of the last 20 results (cached locally for offline viewing)
- **Floating "Research with AI" button** on pages (opt-in via settings; off by
  default to avoid clutter).
- **Dark mode** via `prefers-color-scheme`.
- **Configurable API base URL** (defaults to `http://localhost:3000`).

---

## Installation

### Chrome / Edge / Brave (and other Chromium browsers)

1. Open `chrome://extensions` in the address bar.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select the `browser-extension/` folder (the one containing `manifest.json`).
5. The Cognis icon appears in your toolbar. Pin it for easy access.

> **Side panel:** Chrome 114+ is required for the side panel API. On older
> versions or other Chromium browsers without `chrome.sidePanel`, the extension
> falls back to opening `sidepanel.html` in a new tab.

### Firefox

1. Open `about:debugging` in the address bar.
2. Click **This Firefox** in the left sidebar.
3. Click **Load Temporary Add-on…**.
4. Select the `manifest.json` file inside the `browser-extension/` folder.
5. The extension loads temporarily (until Firefox restarts).

> Firefox does not yet support the MV3 `side_panel` API the same way Chrome
> does. The extension will open the side panel UI in a new tab instead. The
> popup, content script, and all API integrations work normally.

---

## Configuration

1. Click the extension icon to open the popup.
2. In the **Settings** section, set **API base URL** to wherever your Deep
   Research Engine instance is running.
   - Default for development: `http://localhost:3000`
   - For production: your deployed URL (e.g. `https://research.example.com`)
3. (Optional) Toggle **Show floating button on pages** if you want a per-page
   "Research with AI" button on every site.
4. Click **Save settings**. Settings are synced across devices (when signed into
   the browser account) via `chrome.storage.sync`.

---

## Usage

1. Navigate to any web page you want to research.
2. Click the Cognis toolbar icon.
3. Choose an action:
   - **Research this page** → instant AI summary of the page.
   - **Quick question** → type a question about the page, hit send.
   - **Deep research** → kicks off the full research pipeline (can take minutes).
   - **Swarm** → multi-agent analysis with streaming per-agent output.
   - **Open side panel** → opens the chat-style side panel for follow-ups.
4. Results stream into the side panel (Chrome) or a new tab (Firefox). The last
   20 results are cached locally so you can review them offline.
5. In the side panel, you can ask follow-up questions in the composer at the
   bottom. Use the **history** button (top-right) to browse past results.

---

## Architecture

```
browser-extension/
├── manifest.json          # MV3 manifest (Chrome sidePanel + Firefox gecko)
├── background.js          # Service worker: message hub, extraction, opens side panel
├── content.js             # Per-page: extractPageContent() + optional floating button
├── popup.html / .css / .js  # 320px launcher popup
├── sidepanel.html / .css / .js  # Chat-style side panel (owns all streaming)
├── icons/
│   ├── icon16.png  icon48.png  icon128.png  # raster icons (manifest)
│   └── icon16.svg  icon48.svg  icon128.svg  # vector source
└── README.md
```

### Message flow

```
Popup click ──msg──▶ background.js ──extract──▶ content.js (active tab)
                         │
                         ├─ builds "pendingAction" ─▶ chrome.storage.local
                         └─ opens sidePanel (Chrome) / new tab (Firefox)

Side panel opens ─▶ reads pendingAction from storage ─▶ streams the API call
                    (fetch + ReadableStream, NOT EventSource — we need POST)
```

The side panel performs all streaming because MV3 service workers can be
terminated mid-stream, which would abort long SSE responses. The panel is a
long-lived document, so it owns every `fetch` + `ReadableStream`.

### Endpoints used

| Action           | Endpoint                       | Method | Body                          |
| ---------------- | ------------------------------ | ------ | ----------------------------- |
| Research / Quick | `/api/modes/quick`             | POST   | `{ message }` (SSE)           |
| Swarm            | `/api/swarm`                   | POST   | `{ task }` (SSE)              |
| Deep research    | `/api/research/start`          | POST   | `{ query, depth }`            |
| Poll status      | `/api/research/status/:id`     | GET    | —                             |

### CORS

Browser extensions with `host_permissions: ["<all_urls>"]` can make
cross-origin requests to any host without CORS restrictions. The Deep Research
Engine's own CORS config therefore does not need to be modified for the
extension to talk to it.

---

## Compatibility

- **Manifest V3** (works in Chrome 88+, Firefox 115+).
- Uses `browser.*` with a `chrome.*` fallback for Firefox/Chrome parity.
- No build step, no bundler, no TypeScript — plain vanilla JS/HTML/CSS.
- System fonts only (no external font loading).
- Total size: ~40 KB (well under the 100 KB budget).

---

## Troubleshooting

- **"Error: HTTP 503"** — the Cognis has no LLM provider
  configured. Set `NVIDIA_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or
  `OLLAMA_URL` on the server.
- **Side panel won't open** — make sure you're on Chrome 114+. On Firefox or
  older Chromium, the panel opens in a new tab instead.
- **Floating button doesn't appear** — enable it in the popup settings. Some
  sites with strict CSP may block the injected button; the popup actions still
  work in that case.
- **Settings don't persist** — ensure the `storage` permission is granted
  (it's in the manifest by default).

---

## Privacy

- Page content is extracted locally and sent **only** to the API base URL you
  configure. Nothing is sent to any third party.
- The last 20 research results are stored in `chrome.storage.local` on your
  device for offline review. Clear them any time via the history drawer's
  **Clear history** button.
- No analytics, no telemetry, no remote code.
