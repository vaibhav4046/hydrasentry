"use client";

/**
 * Console chrome wrapper. Reuses the cockpit PageShell (sidebar + top bar).
 *
 * NO LOGIN, NO SIGN-IN: sign-in / magic-link / mint-key have been removed from
 * the product. Every /console/* page is fully usable with zero login and shows
 * the shared public DEMO tenant's REAL rows, honestly labelled. There is no
 * account control in the top bar anymore.
 */
import type { ReactNode } from "react";
import { PageShell } from "@/components/shared/PageShell";

interface ConsoleShellProps {
  /**
   * Deprecated no-op. Previously hard-gated the page behind a sign-in card; the
   * product no longer has sign-in, so this is retained only for source
   * compatibility and blocks nothing.
   */
  requireUser?: boolean;
  children: ReactNode;
}

export function ConsoleShell({ children }: ConsoleShellProps) {
  return <PageShell>{children}</PageShell>;
}
