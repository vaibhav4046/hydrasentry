"use client";

import type { ReactNode } from "react";
import { useRunDemo } from "@/hooks/useRunDemo";
import { CommandPalette, openPalette } from "./CommandPalette";
import { deriveCockpit, C } from "@/lib/cockpit/derive";

interface CockpitTopBarProps {
  /** Page title, e.g. "Command". */
  title: string;
  /** Mono breadcrumb, e.g. "HYDRASENTRY / OPERATIONS". */
  crumb: string;
  /** Optional extra page actions (rendered before the Run Demo button). */
  actions?: ReactNode;
  /** Opens the mobile sidebar drawer. */
  onMenu?: () => void;
}

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/**
 * Castellan top bar (ported 1:1): a mono breadcrumb over the page title, a
 * command-search input with a ⌘K chip, a live posture pill (STANDBY → LIVE once
 * a real run loads), a live risk chip whose
 * value/color is driven by the REAL run (12/NOMINAL idle → e.g. 87/CRITICAL
 * after the judge demo), and the white→silver gradient Run Demo button that
 * triggers the real run through the shared store. Sticky, hairline bottom
 * border, blur(16px).
 */
export function CockpitTopBar({ title, crumb, actions, onMenu }: CockpitTopBarProps) {
  const { run, isRunning, trigger } = useRunDemo();
  const v = deriveCockpit(run, { isRunning });

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 28px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(4,5,6,0.72)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="cockpit-menu-btn"
        style={{
          flex: "none",
          display: "none",
          width: 36,
          height: 36,
          placeItems: "center",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.09)",
          background: "rgba(255,255,255,0.02)",
          color: C.faint,
          cursor: "pointer",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {/* Breadcrumb + title */}
      <div style={{ flex: "none", minWidth: 0, maxWidth: "42%" }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.16em",
            color: C.faint,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {crumb}
        </div>
        <div
          className="cockpit-display"
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: C.ink,
          }}
        >
          {title}
        </div>
      </div>

      {/* Center search: opens the command palette (also Ctrl/Cmd+K) */}
      <button
        type="button"
        onClick={() => openPalette()}
        aria-label="Open command palette"
        aria-keyshortcuts="Control+K"
        className="cockpit-search-box"
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 10,
          background: "rgba(255,255,255,0.02)",
          maxWidth: 340,
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="1.9" strokeLinecap="round" style={{ flex: "none" }}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.2-4.2" />
        </svg>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            color: C.faint,
            fontSize: "12.5px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Search runs, skills, pages
        </span>
        <span
          style={{
            flex: "none",
            fontFamily: MONO,
            fontSize: 9,
            color: C.faint,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 5,
            padding: "1px 5px",
          }}
        >
          ⌘K
        </span>
      </button>

      {/* Right cluster */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10 }}>
        {actions}
        <span
          title={
            v.poisoned
              ? "A real run is loaded; tiles reflect the live /runs/real outcome."
              : "Live operations. Trigger a run to populate the cockpit from the real backend."
          }
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.12em",
            color: v.poisoned ? C.ink : C.muted,
            border: `1px solid ${v.poisoned ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 8,
            padding: "8px 11px",
          }}
        >
          {v.poisoned ? "LIVE" : "STANDBY"}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "7px 12px",
            border: `1px solid ${v.chipBorder}`,
            borderRadius: 999,
            background: v.chipBg,
            transition: "all .5s",
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: v.chipColor }}>
            {v.risk}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: v.chipColor }}>
            {v.riskState}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void trigger()}
          disabled={isRunning}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
          }}
          style={{
            cursor: isRunning ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            color: "#0A0A0A",
            padding: "10px 18px",
            border: "none",
            borderRadius: 11,
            background: "linear-gradient(180deg,#FFFFFF,#CDD3DC)",
            boxShadow: "0 8px 22px -10px rgba(220,228,240,0.55)",
            transition: "transform .2s",
            opacity: isRunning ? 0.7 : 1,
          }}
        >
          {v.demoLabel}
        </button>
      </div>

      <CommandPalette />
    </header>
  );
}
