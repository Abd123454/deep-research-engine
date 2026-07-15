'use strict';

/**
 * Deep Research Engine — preload script
 *
 * Runs in an isolated context with access to a subset of Node/Electron APIs,
 * and exposes a tiny, audited surface to the renderer (the Next.js web app)
 * via `contextBridge.exposeInMainWorld`.
 *
 * Security: this is the ONLY bridge between the renderer and Node. Keep the
 * surface as small as possible. Never expose `ipcRenderer.on` directly —
 * always wrap it so the renderer can only subscribe to specific, known
 * channels.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of channels the renderer is allowed to receive messages on.
const ALLOWED_INBOUND_CHANNELS = ['new-research', 'new-chat', 'theme-changed'];

// Whitelist of channels the renderer is allowed to invoke (request/response).
const ALLOWED_INVOKE_CHANNELS = ['desktop:getPlatform', 'desktop:getVersion'];

/**
 * Subscribe to an inbound channel. Returns an unsubscribe function.
 *
 * @param {string} channel - One of ALLOWED_INBOUND_CHANNELS.
 * @param {(event: unknown, ...args: unknown[]) => void} callback
 * @returns {() => void}
 */
function on(channel, callback) {
  if (!ALLOWED_INBOUND_CHANNELS.includes(channel)) {
    console.warn(`[desktopAPI] blocked subscription to unknown channel: ${channel}`);
    return () => {};
  }
  const listener = (event, ...args) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

/**
 * Invoke a request/response channel and return a Promise.
 *
 * @param {string} channel - One of ALLOWED_INVOKE_CHANNELS.
 * @param {unknown[]} args
 * @returns {Promise<unknown>}
 */
function invoke(channel, ...args) {
  if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) {
    return Promise.reject(new Error(`[desktopAPI] blocked invoke on unknown channel: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

// ---------------------------------------------------------------------------
// Expose the desktop API to the renderer
// ---------------------------------------------------------------------------

contextBridge.exposeInMainWorld('desktopAPI', {
  /** The OS platform: 'darwin' | 'win32' | 'linux' */
  platform: process.platform,

  /** The Electron app version (from package.json). Resolves async. */
  getVersion: () => invoke('desktop:getVersion'),

  /** Whether we're running in dev mode (loaded localhost:3000 directly). */
  isDev: process.argv.includes('--dev'),

  /** Subscribe to "New Research" events (triggered by tray / menu / shortcut). */
  onNewResearch: (callback) => on('new-research', callback),

  /** Subscribe to "New Chat" events. */
  onNewChat: (callback) => on('new-chat', callback),

  /** Subscribe to OS theme changes. Callback receives `isDark: boolean`. */
  onThemeChanged: (callback) => on('theme-changed', (isDark) => callback(isDark)),
});
