# Quaesitor Desktop (Tauri)

Lightweight desktop wrapper for Quaesitor. Bundle size: ~10MB (vs 150MB Electron).

## Prerequisites
- Rust (https://rustup.rs)
- Tauri CLI: `npm install -g @tauri-apps/cli`

## Development
```bash
# 1. Start the Quaesitor server
cd .. && bun run dev

# 2. In another terminal, start Tauri
cd desktop-tauri && npm install && npm run tauri dev
```

## Build (Windows MSI/NSIS)
```bash
npm run tauri build
# Output: desktop-tauri/src-tauri/target/release/bundle/
```

## Build (Linux DEB/AppImage)
```bash
npm run tauri build
```

## Security
- Tauri uses secure defaults: no nodeIntegration, contextIsolation enabled
- CSP enforced
- Shell plugin requires explicit permission
- Notification plugin for research completion alerts
