import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Tone is conveyed through brightness + border weight + label, never hue.
 * - critical: brightest, solid white dot, heavy border
 * - warn: bright, ring dot
 * - active: live pulsing dot
 * - safe: dim, calm
 * - neutral: muted, informational
 */
export type StatusTone = "neutral" | "safe" | "active" | "warn" | "critical";

interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  label: string;
  /** Show the leading dot (default true). */
  dot?: boolean;
}

const TONE: Record<StatusTone, { wrap: string; dot: string }> = {
  neutral: {
    wrap: "border-white/12 bg-white/[.03] text-faint",
    dot: "bg-white/40",
  },
  safe: {
    wrap: "border-white/15 bg-white/[.04] text-muted",
    dot: "bg-white/55",
  },
  active: {
    wrap: "border-white/25 bg-white/[.06] text-ink",
    dot: "bg-white animate-pulse",
  },
  warn: {
    wrap: "border-white/35 bg-white/[.06] text-ink",
    dot: "bg-white ring-2 ring-white/30",
  },
  critical: {
    wrap: "border-white/55 bg-white/[.08] text-ink",
    dot: "bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]",
  },
};

export function StatusPill({
  tone = "neutral",
  label,
  dot = true,
  className,
  ...props
}: StatusPillProps) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "mono inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em]",
        t.wrap,
        className,
      )}
      {...props}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />
      )}
      {label}
    </span>
  );
}
