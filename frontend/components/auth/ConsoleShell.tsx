"use client";

/**
 * Console chrome wrapper. Reuses the cockpit PageShell (sidebar + top bar) and
 * injects the optional, non-blocking AccountControl into the top-bar actions.
 *
 * NO LOGIN WALL: this shell never hard-gates content. Every /console/* page is
 * viewable signed-out — it shows the shared public DEMO tenant's REAL rows,
 * honestly labelled, with sign-in demoted to an optional "see your own tenant"
 * CTA in the top bar (AccountControl). Pages that have a genuinely per-user
 * action (minting an API key) gate ONLY that action in-page, never the whole
 * surface. The `requireUser` prop is retained for source compatibility but is no
 * longer used to block — there is nothing left to wall off.
 */
import type { ReactNode } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { AccountControl } from "./AccountControl";

interface ConsoleShellProps {
  /**
   * Deprecated. Previously hard-gated the page behind a sign-in card. Kept so the
   * existing call sites type-check; it no longer blocks any content (pages own
   * their per-action gating now).
   */
  requireUser?: boolean;
  children: ReactNode;
}

export function ConsoleShell({ children }: ConsoleShellProps) {
  return <PageShell actions={<AccountControl />}>{children}</PageShell>;
}
