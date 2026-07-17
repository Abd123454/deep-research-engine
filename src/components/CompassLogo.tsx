// CompassLogo — Quaesitor's signature mark.
// A 4-point compass star (rose), symbol of exploration and investigation.
// Replaces the generic Sparkle icon from the previous Claude-inspired design.

export function CompassLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      {/* 4-point compass star */}
      <path d="M12 2 L13.5 10 L22 12 L13.5 14 L12 22 L10.5 14 L2 12 L10.5 10 Z" />
      {/* Center dot (cutout via background color) */}
      <circle cx="12" cy="12" r="1.5" fill="var(--background, #f4f1ea)" />
    </svg>
  );
}
