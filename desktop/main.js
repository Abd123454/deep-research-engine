'use strict';

/**
 * Cognis — Electron main process
 *
 * This is a thin native wrapper around the Cognis Next.js web app.
 * It loads the running web app (http://localhost:3000 by default) and adds:
 *   - Native window with reasonable defaults
 *   - System tray icon + context menu
 *   - Native application menu (File / Edit / View / Window / Help)
 *   - Global & local keyboard shortcuts
 *   - Single-instance lock
 *   - Graceful handling when the Next.js server isn't ready yet
 *   - Dark mode that follows the OS theme
 *
 * Security:
 *   - contextIsolation: true
 *   - nodeIntegration: false
 *   - sandbox: true
 *   - Only a minimal, audited API is exposed via preload.js + contextBridge
 */

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeTheme,
  nativeImage,
  globalShortcut,
  shell,
  dialog,
} = require('electron');

const path = require('path');
const http = require('http');
const net = require('net');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// `--dev` flag toggles dev mode (loads http://localhost:3000 instead of a
// packaged app). In production we still attempt localhost:3000 first, since
// this wrapper does not bundle the Next.js build (kept intentionally thin).
const isDev = process.argv.includes('--dev');

const SERVER_URL = process.env.DEEP_RESEARCH_URL || 'http://localhost:3000';
const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;

// Health-check retry config (for waiting on the Next.js dev server to come up)
const HEALTH_CHECK_INTERVAL_MS = 2000; // 2 seconds between retries
const HEALTH_CHECK_TIMEOUT_MS = 30000; // give up after 30 seconds

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

let mainWindow = null;
let tray = null;
let loadingWindow = null;
let serverReady = false;
let healthCheckTimer = null;
let healthCheckStartedAt = 0;

// Prevent garbage collection of the tray icon image
let trayIconImage = null;

// ---------------------------------------------------------------------------
// Single instance lock — only one copy of the app may run at a time
// ---------------------------------------------------------------------------

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  // Another instance is already running. Bail out.
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to launch a second instance — focus the existing window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Theme — follow the OS theme
// ---------------------------------------------------------------------------

function syncTheme() {
  // Tell the Next.js app which theme to use via a query param. The web app
  // should already honour `prefers-color-scheme`, but we also set the
  // nativeTheme source so Electron's own UI (menus, dialogs) matches.
  nativeTheme.themeSource = 'system';
}

// React to OS theme changes while the app is running
nativeTheme.on('updated', () => {
  // The renderer (Next.js app) handles its own theme via prefers-color-scheme,
  // so we just need to keep the tray / native UI in sync — which happens
  // automatically because themeSource is 'system'.
});

// ---------------------------------------------------------------------------
// Server health check
// ---------------------------------------------------------------------------

/**
 * Check whether the Next.js dev server is reachable on localhost:3000.
 * Uses a raw TCP connect (faster and lighter than an HTTP request) and falls
 * back to an HTTP GET on /api/health if the port is open.
 *
 * Resolves with true if reachable, false otherwise. Never rejects.
 */
function checkServerReachable() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(SERVER_PORT, SERVER_HOST);
  });
}

/**
 * Hit the Next.js /api/health endpoint to confirm the app is fully booted
 * (not just the port being open). Falls back to "port open = good enough".
 */
async function checkServerHealthy() {
  return new Promise((resolve) => {
    const req = http.get(
      `${SERVER_URL}/api/health`,
      { timeout: 3000 },
      (res) => {
        // Any HTTP response (even 404) means the server is up.
        res.resume();
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.on('error', () => {
      resolve(false);
    });
  });
}

async function isServerReady() {
  const reachable = await checkServerReachable();
  if (!reachable) return false;
  return checkServerHealthy();
}

// ---------------------------------------------------------------------------
// Loading window — shown while we wait for the Next.js server
// ---------------------------------------------------------------------------

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    center: true,
    show: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  loadingWindow.loadFile(path.join(__dirname, 'loading.html'));
  loadingWindow.once('ready-to-show', () => {
    loadingWindow.show();
  });

  // Prevent the loading window from closing (we manage it ourselves)
  loadingWindow.on('close', (e) => {
    if (!serverReady) e.preventDefault();
  });
}

function showLoadingMessage(message) {
  if (!loadingWindow) return;
  loadingWindow.webContents.executeJavaScript(
    `window.__setLoadingMessage && window.__setLoadingMessage(${JSON.stringify(message)})`,
  ).catch(() => {
    /* ignore — the renderer may not have the helper yet */
  });
}

function showLoadingError(instructions) {
  if (!loadingWindow) return;
  loadingWindow.webContents.executeJavaScript(
    `window.__showError && window.__showError(${JSON.stringify(instructions)})`,
  ).catch(() => {});
}

function closeLoadingWindow() {
  if (!loadingWindow) return;
  loadingWindow = null;
  try {
    loadingWindow && loadingWindow.destroy();
  } catch (_) {
    /* noop */
  }
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Cognis',
    backgroundColor: '#1e1e1e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 16 } : undefined,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  // Open external links (target=_blank or non-app origins) in the user's
  // default browser, never inside the Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(SERVER_URL)) {
      // Same-origin links to the app: open in the main window.
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow only same-origin navigation (i.e. within the Deep Research app).
    if (!url.startsWith(SERVER_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    closeLoadingWindow();
  });

  // Hide rather than quit when the window is closed on macOS / when a tray
  // icon is present — keeps the app running in the background.
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      if (process.platform === 'darwin' || tray) {
        mainWindow.hide();
      } else {
        app.quit();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ---------------------------------------------------------------------------
// Wait for the Next.js server, then load it into the main window
// ---------------------------------------------------------------------------

function waitForServerAndLoad() {
  healthCheckStartedAt = Date.now();

  const attempt = async () => {
    const ready = await isServerReady();
    if (ready) {
      serverReady = true;
      stopHealthCheckTimer();
      if (!mainWindow) createMainWindow();
      mainWindow.loadURL(SERVER_URL).catch((err) => {
        console.error('Failed to load server URL:', err);
        showLoadingError(
          'Could not load the Cognis even though the server responded. ' +
            'Please check the console output of the Next.js app.',
        );
      });
      return;
    }

    const elapsed = Date.now() - healthCheckStartedAt;
    if (elapsed >= HEALTH_CHECK_TIMEOUT_MS) {
      stopHealthCheckTimer();
      showLoadingError(
        'Timed out waiting for the Cognis to start on port 3000.\n\n' +
          'Please make sure the Next.js app is running:\n' +
          '  cd /home/z/my-project && bun run dev\n\n' +
          'Then restart this desktop app.',
      );
      return;
    }

    showLoadingMessage(
      `Waiting for Cognis to start...\n(elapsed ${Math.round(elapsed / 1000)}s)`,
    );
  };

  attempt();
  healthCheckTimer = setInterval(attempt, HEALTH_CHECK_INTERVAL_MS);
}

function stopHealthCheckTimer() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Tray icon + context menu
// ---------------------------------------------------------------------------

function createTray() {
  // Load a real PNG if present, otherwise build an image from a data URI so
  // the app still works even if the icon asset is missing.
  let icon;
  try {
    const iconPath = path.join(__dirname, 'tray-icon.png');
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON_DATA_URI_BASE64, 'base64'));
    }
  } catch (_) {
    icon = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON_DATA_URI_BASE64, 'base64'));
  }

  // On macOS the tray icon should be a template image (monochrome).
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  trayIconImage = icon;
  tray = new Tray(icon);
  tray.setToolTip('Cognis');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => showMainWindow(),
    },
    {
      label: 'New Research',
      accelerator: 'CmdOrCtrl+N',
      click: () => triggerNewResearch(),
    },
    {
      label: 'New Chat',
      accelerator: 'CmdOrCtrl+Shift+N',
      click: () => triggerNewChat(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: () => quitApp(),
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Click the tray icon → show the window (common on Windows/Linux)
  tray.on('click', () => {
    showMainWindow();
  });
}

function showMainWindow() {
  if (!mainWindow) {
    createMainWindow();
    if (serverReady) {
      mainWindow.loadURL(SERVER_URL);
    } else {
      waitForServerAndLoad();
    }
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

// ---------------------------------------------------------------------------
// Application menu
// ---------------------------------------------------------------------------

function buildAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // App menu (macOS only)
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about', label: 'About Cognis' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Research',
          accelerator: 'CmdOrCtrl+N',
          click: () => triggerNewResearch(),
        },
        {
          label: 'New Chat',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => triggerNewChat(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }],
              },
            ]
          : [{ role: 'selectAll' }]),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { role: 'toggleDevTools', accelerator: 'F12' },
        { type: 'separator' },
        { role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
        { role: 'zoomIn', accelerator: 'CmdOrCtrl+Plus' },
        { role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Toggle Theme',
          click: () => toggleTheme(),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About',
          click: () => showAboutDialog(),
        },
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/zai-org/deep-research-engine'),
        },
        {
          label: 'Report an Issue',
          click: () => shell.openExternal('https://github.com/zai-org/deep-research-engine/issues'),
        },
        {
          label: 'Check for Updates',
          click: () => checkForUpdates(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function showAboutDialog() {
  dialog.showMessageBox({
    type: 'info',
    title: 'About Cognis',
    message: 'Cognis',
    detail:
      `Version: ${app.getVersion()}\n` +
      `Electron: ${process.versions.electron}\n` +
      `Chrome: ${process.versions.chrome}\n` +
      `Node: ${process.versions.node}\n` +
      `Platform: ${process.platform} ${process.arch}\n\n` +
      'A thin native wrapper around the Cognis web app.',
    buttons: ['OK'],
    icon: path.join(__dirname, 'icon.png'),
  });
}

function checkForUpdates() {
  dialog.showMessageBox({
    type: 'info',
    title: 'Check for Updates',
    message: 'Check for Updates',
    detail:
      'Automatic updates are not configured in this build.\n' +
      'Please visit the project repository to download the latest version.',
    buttons: ['OK'],
  });
}

function toggleTheme() {
  if (nativeTheme.themeSource === 'dark') {
    nativeTheme.themeSource = 'light';
  } else if (nativeTheme.themeSource === 'light') {
    nativeTheme.themeSource = 'system';
  } else {
    nativeTheme.themeSource = 'dark';
  }
  // Tell the renderer about the explicit theme change so it can react even
  // if it isn't listening to prefers-color-scheme.
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
  }
}

// ---------------------------------------------------------------------------
// Cross-window actions: New Research / New Chat
//
// These send an IPC message to the renderer (handled in preload.js) which
// the web app can listen for to trigger the appropriate UI action.
// ---------------------------------------------------------------------------

function triggerNewResearch() {
  showMainWindow();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('new-research');
  }
}

function triggerNewChat() {
  showMainWindow();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('new-chat');
  }
}

function quitApp() {
  app.isQuitting = true;
  stopHealthCheckTimer();
  if (tray) {
    tray.destroy();
    tray = null;
  }
  app.quit();
}

// ---------------------------------------------------------------------------
// Tray icon fallback — embedded 22x22 monochrome sparkle PNG (base64).
// Used only if desktop/tray-icon.png is missing or unreadable.
// ---------------------------------------------------------------------------

const TRAY_ICON_DATA_URI_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9' +
  'kT1Iw0AcxV9TxSoVBXuIOqSoOCqIrOikVREeWqES2gqpCuzxRW1dfVsoVYtK7t6AvQXqtuqVcZIs' +
  'U82zPvf/d5+c8/Z/iZsFAxj8FOQ4+jzj1nwjowurHKAtYnFZAU6Qq4lPFGtAoamqFIJcpOkmV5t' +
  'wnAziKV9qFWNUKiLCaFIVg1IxQ5k6YNZxsmYxdUscjAHdos7KFR5dFREqkeV5p7i/NxesR+Z+nl' +
  'e3Hw+HEiWx51b9eQMyT7ds5hzoThx7CANBFM4wwgg9oAgxhETxHlQzVC0Vg1fIUQvaxlqgQvUKq' +
  '3Ua2UWE05qRCHxXVQZUcJmYyf3PEd4/Jd5g4ZHwS2PrOnJyZ5yDAWnQw/Dy/x2Hv6BXREVb0ENk' +
  'vwzhTgz/AZmbuMP5El+sAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAAN1wAADdcBQiibeAAAA' +
  'Ad0SU1FB+MGEAwwDJ+JxHwAAACHHRFYAAAgAAyNJAQAAE/xgYXZhbCApAAAAAQAAAAAAAAAAAAA' +
  'AAAAAAAAA/s5EaWZpY2FudCBleGFtcGxlAAAACXZpZXdCT3ggMCAwIDIyIDIyAAAURpfoAGQAA' +
  'ACXBIWXMAAA7EAAAOxAGVKw4bAAAAJUlEQVQ4y2NkYGD4z0AEYBxVSF+HAAUhQYo5gQGtBgZ0c' +
  'AAAAAElFTkSuQmCC';

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

// Quit when all windows are closed — except on macOS, where apps stay alive
// until explicitly quit. If we have a tray icon we also stay alive.
app.on('window-all-closed', () => {
  if (process.platform === 'darwin' || tray) {
    // stay alive
    return;
  }
  quitApp();
});

app.on('activate', () => {
  // macOS: re-create the window when the dock icon is clicked and no windows
  // are open.
  if (mainWindow === null) {
    showMainWindow();
  } else {
    mainWindow.show();
  }
});

// Clean up shortcuts & tray before quitting
app.on('before-quit', () => {
  app.isQuitting = true;
  stopHealthCheckTimer();
  // globalShortcuts are auto-unregistered on quit, but be explicit.
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// Prevent the app from being killed by the renderer crashing — show a
// friendly reload prompt instead.
app.on('web-contents-created', (event, contents) => {
  contents.on('crashed', () => {
    dialog
      .showMessageBox({
        type: 'error',
        title: 'Renderer crashed',
        message: 'The Cognis renderer crashed.',
        detail: 'Would you like to reload it?',
        buttons: ['Reload', 'Quit'],
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0 && mainWindow) {
          mainWindow.reload();
        } else {
          quitApp();
        }
      });
  });
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

// Apply the OS theme on startup
syncTheme();

app.whenReady().then(() => {
  // Register global & local keyboard shortcuts
  // Local shortcuts (only active when the window is focused) are handled via
  // the menu accelerators above. We add a couple of global shortcuts here for
  // power users who want to summon the app from anywhere.
  try {
    globalShortcut.register('CommandOrControl+Alt+N', () => {
      triggerNewResearch();
    });
  } catch (_) {
    /* some platforms restrict global shortcuts */
  }

  // Build the menu (also sets up local accelerators like Cmd/Ctrl+N, R, Q)
  buildAppMenu();

  // Tray (skipped in headless / dev if the user passes --no-tray)
  if (!process.argv.includes('--no-tray')) {
    createTray();
  }

  // Show the loading window first, then start probing for the server.
  createLoadingWindow();

  // Give the loading window a moment to render, then start the health check.
  setTimeout(() => {
    waitForServerAndLoad();
  }, 300);
});

// ---------------------------------------------------------------------------
// IPC handlers (preload.js exposes a minimal, audited surface to the renderer)
// ---------------------------------------------------------------------------

ipcMain.handle('desktop:getPlatform', () => process.platform);
ipcMain.handle('desktop:getVersion', () => app.getVersion());

// ---------------------------------------------------------------------------
// Expose a small set of internals for debugging / the preload script.
// ---------------------------------------------------------------------------

module.exports = {
  isDev,
  SERVER_URL,
};
