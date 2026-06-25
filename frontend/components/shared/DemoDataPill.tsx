"use client";

import { Database } from "lucide-react";
import { useDemoMode } from "@/hooks/useDemoMode";
import { cn } from "@/lib/cn";

interface DemoDataPillProps {
  className?: string;
  /** "inline" sits in a row; "fixed" floats bottom-right over the page. */
  variant?: "inline" | "fixed";
}

/**
 * Subtle, honest indicator shown only when the app is serving BUNDLED DEMO DATA
 * because no backend was reachable (see lib/demoMode.ts). Monochrome, low-key —
 * it states the truth ("demo data, connect a backend for live runs") without
 * pretending the backend is live and without alarming. Renders nothing while a
 * live backend is in use, and nothing on the server (SSR snapshot is false), so
 * there is no hydration mismatch.
 */
export function DemoDataPill({ className, variant = "inline" }: DemoDataPillProps) {
  const isDemo = useDemoMode();
  if (!isDemo) return null;

  return (
    <span
      role="status"
      title="No backend is reachable, so Constellan is showing bundled demo data captured from a demo-mode run. Connect a backend for live runs."
      className={cn(
        "mono inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-white/[.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted backdrop-blur-md",
        variant === "fixed" &&
          "fixed bottom-4 right-4 z-50 shadow-[0_8px_30px_rgba(0,0,0,0.5)]",
        className,
      )}
    >
      <Database className="h-3 w-3" strokeWidth={1.8} />
      Demo data · connect a backend for live runs
    </span>
  );
}
