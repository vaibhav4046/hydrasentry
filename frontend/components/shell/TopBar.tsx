"use client";

import type { ReactNode } from "react";
import { StatusPill, type StatusTone } from "@/components/noir/StatusPill";
import { cn } from "@/lib/cn";

interface TopBarProps {
  title: string;
  /** Optional mono kicker shown above/aside the title. */
  kicker?: string;
  /** Backend/connection status pill. */
  statusLabel?: string;
  statusTone?: StatusTone;
  /** Right-aligned actions (buttons, etc.). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Dashboard top bar: page title + optional kicker on the left, a status pill,
 * and a slot for page actions on the right. Pairs with AppNav to form the
 * shared dashboard chrome the next agent reuses across all eight pages.
 */
export function TopBar({
  title,
  kicker,
  statusLabel,
  statusTone = "active",
  actions,
  className,
}: TopBarProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-4 border-b border-hairline bg-deep/40 px-6 py-3.5 backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex flex-col">
        {kicker && (
          <span className="mono text-[10.5px] uppercase tracking-[0.2em] text-faint">
            {kicker}
          </span>
        )}
        <h1 className="text-lg font-semibold tracking-tight text-ink">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        {statusLabel && <StatusPill tone={statusTone} label={statusLabel} />}
        {actions}
      </div>
    </header>
  );
}
