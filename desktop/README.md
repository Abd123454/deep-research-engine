# Quaesitor — Desktop App

A thin Electron wrapper around the **Quaesitor** Next.js web
application. It gives you a native desktop window, system-tray icon, native
menus, keyboard shortcuts, and dark-mode support — without bundling the web
app. The Electron shell simply loads the running Next.js server on
`http://localhost:3000`.

> This is a **separate project** with its own `package.json`. Do **not**
> install Electron in the main project — it's a heavy dependency (~200 MB)
> and the desktop app should stay isolated.

---

## Architecture

```
desktop/
├── package.json          # Separate npm project (electron + electron-builder)
├── main.js               # Electron main process (CommonJS)
├── preload.js            # Preload script — exposes a tiny audited API to the renderer
├── loading.html          # Loading / error screen shown while the web server boots
├── tray-icon.png         # 22×22 tray icon (sparkle, transparent bg)
├── icon.png              # 512×512 app icon (sparkle on dark rounded square)
├── _generate_icons.py    # Script used to (re)generate the PNG icons from scratch
└── README.md             # This file
```

The Electron app **does not** ship the Next.js build. It always loads
`http://localhost:3000` (override with `DEEP_RESEARCH_URL`). This keeps the
installer tiny and decouples native updates from web updates.

---

## Prerequisites

- **Node.js 20+** (for Electron itself)
- The **Quaesitor** Next.js app running on port 3000
  (`cd /home/z/my-project && bun run dev`)

---

## Setup

The Electron dependencies are **not** pre-installed. Run this once:

```bash
cd desktop
npm install
```

This installs `electron` and `electron-builder` (~200 MB). It's isolated to
the `desktop/` folder and won't touch the main project.

---

## Development

You need **two terminals**:

```bash
# Terminal 1 — start the Next.js web app
cd /home/z/my-project
bun run dev

# Terminal 2 — start Electron (it will probe port 3000 and connect once ready)
cd /home/z/my-project/desktop
npm run dev
```

Electron will show a loading spinner ("Starting Quaesitor…") while
it waits for `localhost:3000` to come up. It retries every 2 seconds for up
to 30 seconds, then shows a friendly error page with retry instructions if
the server still isn't reachable.

### Useful flags

| Flag              | Effect                                                        |
| ----------------- | ------------------------------------------------------------ |
| `--dev`           | Dev mode — explicit logging, devtools-friendly defaults      |
| `--no-tray`       | Skip creating the system-tray icon                           |
| `DEEP_RESEARCH_URL` | Override the server URL (default `http://localhost:3000`)  |

---

## Build

```bash
npm run build:mac    # → dist/Quaesitor-x.y.z.dmg / .zip
npm run build:linux  # → dist/Quaesitor-x.y.z.AppImage / .deb / .snap
npm run build:win    # → dist/Quaesitor Setup x.y.z.exe / portable .exe
```

Build artifacts land in `desktop/dist/`.

> **Note on macOS codesigning:** the `build` config references
> `build-resources/entitlements.mac.plist`. If you don't have an Apple
> Developer ID, remove the `entitlements` / `entitlementsInherit` keys from
> `package.json` before building, or create an empty entitlements file.

---

## Features

### Native window
- 1200×800 default, 800×600 minimum
- Frameless title bar on macOS (`hiddenInset`), standard on Win/Linux
- Dark background matches the web app's `#1e1e1e` palette

### System tray
- **Show App** — focus the window
- **New Research** — focus + send `new-research` to the renderer
- **New Chat** — focus + send `new-chat` to the renderer
- **Quit**
- Click the icon to show the window

### Native menu
- **File** — New Research, New Chat, Close/Quit
- **Edit** — Undo, Redo, Cut, Copy, Paste, Select All (+ Speech submenu on macOS)
- **View** — Reload, Force Reload, Toggle DevTools, Zoom In/Out/Reset,
  Fullscreen, Toggle Theme
- **Window** — Minimize, Zoom, Bring All to Front
- **Help** — About, Documentation, Report an Issue, Check for Updates

### Keyboard shortcuts
| Shortcut                  | Action                  |
| ------------------------- | ----------------------- |
| `Cmd/Ctrl + N`            | New Research            |
| `Cmd/Ctrl + Shift + N`    | New Chat                |
| `Cmd/Ctrl + R`            | Reload                  |
| `Cmd/Ctrl + Shift + R`    | Force reload            |
| `Cmd/Ctrl + Q`            | Quit                    |
| `Cmd/Ctrl + 0 / + / -`    | Reset / zoom in / out   |
| `F12`                     | Toggle DevTools         |
| `Cmd/Ctrl + Alt + N`      | Global: summon + New Research (works even when app isn't focused) |

### Single instance
Only one copy of the app can run at a time. Launching a second instance just
focuses the existing window.

### Graceful server-wait
On launch the app shows a branded loading page (`loading.html`) with a
spinner and a subtle progress bar. It polls `localhost:3000` every 2 seconds
for up to 30 seconds. If the server still isn't ready, the page switches to
an error view with a **Retry now** button.

### Dark mode
Follows the OS theme via `nativeTheme.themeSource = 'system'`. A
`theme-changed` IPC event is sent to the renderer whenever the OS theme
flips, so the web app can react immediately (it also honours
`prefers-color-scheme` directly). The **View → Toggle Theme** menu cycles
through `dark → light → system`.

### Security
The BrowserWindow is locked down:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Only an allow-listed set of IPC channels is exposed to the renderer via
  `contextBridge` (see `preload.js`).
- External links open in the user's default browser, never inside the app.
- Same-origin navigation only — cross-origin `will-navigate` events are
  redirected to the OS browser.

---

## Renderer-side integration (optional)

The Next.js web app can opt-in to the desktop integration by listening for
the events exposed on `window.desktopAPI`:

```ts
// e.g. in a useEffect somewhere top-level
if (typeof window !== 'undefined' && (window as any).desktopAPI) {
  const api = (window as any).desktopAPI;

  const off1 = api.onNewResearch(() => {
    // open the new-research view
  });
  const off2 = api.onNewChat(() => {
    // open the new-chat view
  });
  const off3 = api.onThemeChanged((isDark: boolean) => {
    // optionally force a theme refresh
  });

  return () => { off1?.(); off2?.(); off3?.(); };
}
```

`window.desktopAPI` is only defined when running inside the Electron shell —
the regular browser build is completely unaffected.

---

## Regenerating the icons

If you want to tweak the sparkle, edit `desktop/_generate_icons.py` and
re-run:

```bash
python3 desktop/_generate_icons.py
```

Requires Pillow (`pip install Pillow`).
