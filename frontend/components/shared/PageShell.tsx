"use client";

import type { ReactNode } from "react";
import { CockpitShell } from "@/components/shell/CockpitShell";
import type { StatusTone } from "@/components/noir/StatusPill";

interface PageShellProps {
  /**
   * Legacy mono kicker from the old top bar. Retained for source compatibility
   * with the eight pages; the cockpit derives the section label from the route,
   * so this is no longer rendered in the chrome.
   */
  kicker?: string;
  /**
   * Legacy page title from the old top bar. The cockpit derives the page title
   * from the route (so the breadcrumb title matches the sidebar nav label), so
   * this prop is accepted for compatibility but no longer rendered.
   */
  title?: string;
  /** Legacy status props — superseded by the cockpit's live status pill. */
  statusLabel?: string;
  statusTone?: StatusTone;
  /** Right-aligned top-bar actions (rendered left of the Run Demo button). */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Shared dashboard chrome. Now a thin adapter over the Castellan CockpitShell:
 * the fixed left command rail + cockpit top bar wrap every dashboard surface so
 * the sidebar, breadcrumb, search, and status/Run-Demo cluster stay identical
 * across all eight routes. Legacy kicker/title/status props are accepted for
 * source compatibility but the cockpit owns those affordances now: the section
 * and page title come from the route so they always match the sidebar nav, and
 * `actions` still flow into the top bar.
 */
export function PageShell({ actions, children }: PageShellProps) {
  return <CockpitShell actions={actions}>{children}</CockpitShell>;
}
