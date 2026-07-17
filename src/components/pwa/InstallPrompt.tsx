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
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-[#e8e6dc] dark:border-[#3d3a35] bg-[#faf9f5] dark:bg-[#1a1a18] p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0eee6] dark:bg-[#393937]">
          <Download className="h-5 w-5 text-[#c96442]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[#141413] dark:text-[#faf9f5]">Install App</h3>
          <p className="text-xs text-[#87867f] dark:text-[#a3a098] mt-1">Install Deep Research for quick access and offline use.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; setShow(false); setDeferredPrompt(null); }}
              className="rounded-lg bg-[#c96442] dark:bg-[#d97757] text-[#faf9f5] px-3 py-1.5 text-xs font-medium hover:bg-[#b5563a] dark:hover:bg-[#c6613f] transition-colors"
            >Install</button>
            <button onClick={() => setShow(false)} className="rounded-lg border border-[#e8e6dc] dark:border-[#3d3a35] text-[#141413] dark:text-[#faf9f5] px-3 py-1.5 text-xs hover:bg-[#f0eee6] dark:hover:bg-[#393937] transition-colors">Not now</button>
          </div>
        </div>
        <button onClick={() => setShow(false)} className="text-[#87867f] hover:text-[#141413] dark:text-[#a3a098] dark:hover:text-[#faf9f5]"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
