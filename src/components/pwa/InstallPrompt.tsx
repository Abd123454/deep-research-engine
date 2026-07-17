"use client";
import * as React from "react";
import { Download, X } from "lucide-react";

// BeforeInstallPromptEvent is not in standard DOM lib types (W3C never standardized it).
// Chrome/Edge support it; Firefox/Safari don't fire the event at all.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 30_000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-[#d9d4c7] dark:border-[#3d3830] bg-[#faf8f3] dark:bg-[#1c1a17] p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4f1ea] dark:bg-[#322e28]">
          <Download className="h-5 w-5 text-[#8b4513]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[#2a2620] dark:text-[#e8e3d8]">Install App</h3>
          <p className="text-xs text-[#6b6358] dark:text-[#9a9080] mt-1">Install Deep Research for quick access and offline use.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; setShow(false); setDeferredPrompt(null); }}
              className="rounded-lg bg-[#8b4513] dark:bg-[#b5673a] text-[#faf8f3] px-3 py-1.5 text-xs font-medium hover:bg-[#6b3410] dark:hover:bg-[#8b4513] transition-colors"
            >Install</button>
            <button onClick={() => setShow(false)} className="rounded-lg border border-[#d9d4c7] dark:border-[#3d3830] text-[#2a2620] dark:text-[#e8e3d8] px-3 py-1.5 text-xs hover:bg-[#f4f1ea] dark:hover:bg-[#322e28] transition-colors">Not now</button>
          </div>
        </div>
        <button onClick={() => setShow(false)} className="text-[#6b6358] hover:text-[#2a2620] dark:text-[#9a9080] dark:hover:text-[#e8e3d8]"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
