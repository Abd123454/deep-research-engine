// Quaesitor Desktop — Tauri main entry point
// This is a thin wrapper that loads the Quaesitor web app.
// The actual AI logic runs in the Next.js server.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Tauri v2 uses the JS-side configuration
    // This file exists for native plugin registration if needed
    quaesitor_desktop_lib::run()
}
