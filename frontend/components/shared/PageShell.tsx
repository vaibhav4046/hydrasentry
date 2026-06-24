"use client";

import type { ReactNode } from "react";
import { AppNav } from "@/components/shell/AppNav";
import { TopBar } from "@/components/shell/TopBar";
import type { StatusTone } from "@/components/noir/StatusPill";

interface PageShellProps {
  kicker?: string;
  title: string;
  statusLabel?: string;
  statusTone?: StatusTone;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Shared dashboard chrome: the AppNav icon rail plus a TopBar, with a scrolling
 * main region. Every dashboard page renders its content through this so the
 * rail, header, and padding stay identical across all eight surfaces.
 */
export function PageShell({
  kicker,
  title,
  statusLabel,
  statusTone,
  actions,
  children,
}: PageShellProps) {
  return (
    <div className="flex min-h-screen">
      <AppNav />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar
          kicker={kicker}
          title={title}
          statusLabel={statusLabel}
          statusTone={statusTone}
          actions={actions}
        />
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
