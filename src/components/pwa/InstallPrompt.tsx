"use client";
import * as React from "react";
import { Download, X } from "lucide-react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShow(true), 30_000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-border bg-card shadow-xl p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Install App</h3>
          <p className="text-xs text-muted-foreground mt-1">Install Deep Research for quick access and offline use.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; setShow(false); setDeferredPrompt(null); }}
              className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium"
            >Install</button>
            <button onClick={() => setShow(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Not now</button>
          </div>
        </div>
        <button onClick={() => setShow(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
