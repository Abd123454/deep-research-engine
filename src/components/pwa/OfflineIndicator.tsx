"use client";
import * as React from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [offline, setOffline] = React.useState(false);
  React.useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#a37a3f] text-[#faf9f5] px-4 py-1.5 text-xs font-medium flex items-center gap-2">
      <WifiOff className="h-3.5 w-3.5" />
      You&apos;re offline. Some features may be unavailable.
    </div>
  );
}
