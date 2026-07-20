# Quaesitor Desktop icons

Place `icon.png` (1024×1024 PNG, transparent background) here before
running `npm run tauri build`. Tauri uses it to generate platform-
specific icon variants (`.ico` for Windows, `.icns` for macOS, etc.).

A placeholder is acceptable for development — `tauri dev` does not
require icons; only `tauri build` does.

To generate all platform variants from a single source PNG:
```bash
npm run tauri icon icons/icon.png
```
