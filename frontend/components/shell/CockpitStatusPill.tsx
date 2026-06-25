"use client";

import { useDemoStore } from "@/store/useDemoStore";
import { cn } from "@/lib/cn";

/**
 * Risk-driven status pill for the top bar. Before any run it reads "12 NOMINAL"
 * (the standing agent count); once a run lands it reflects the live risk band
 * (e.g. "87 HIGH"). Monochrome: severity is shown via brightness + dot weight +
 * label, never hue. A scanning run shows a pulsing dot.
 */
export function CockpitStatusPill({ className }: { className?: string }) {
  const run = useDemoStore((s) => s.currentRun);
  const isRunning = useDemoStore((s) => s.isRunning);

  let label = "12 NOMINAL";
  let bright = false;
  if (isRunning) {
    label = "SCANNING";
  } else if (run) {
    label = `${run.risk.score} ${run.risk.band}`;
    bright = run.risk.band === "HIGH" || run.risk.band === "CRITICAL";
  }

  return (
    <span
      className={cn(
        "mono inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em]",
        bright
          ? "border-white/45 bg-white/[.08] text-ink"
          : "border-white/15 bg-white/[.04] text-muted",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          isRunning
            ? "bg-white animate-pulse"
            : bright
              ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
              : "bg-white/55",
        )}
      />
      {label}
    </span>
  );
}
