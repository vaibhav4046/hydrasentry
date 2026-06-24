"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { cn } from "@/lib/cn";

interface InlineErrorProps {
  message: string;
  className?: string;
}

/** Compact inline error row for failed fetches. Monochrome, never crashes. */
export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <div
      className={cn(
        "mono flex items-center gap-2 rounded-lg border border-hairline-strong bg-white/[.04] px-3 py-2 text-[12px] text-ink",
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
      <span className="text-muted">
        {message}. Is the backend running on :8000?
      </span>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

/** Centered empty/cold-load panel with an optional CTA. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <GlassPanel
      className={cn(
        "flex flex-col items-center gap-4 p-12 text-center",
        className,
      )}
    >
      <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action}
    </GlassPanel>
  );
}
