"use client";

import type { ReactNode } from "react";

/**
 * Refined observatory CTAs, deliberately NOT rounded gradient pills. The
 * primary is a precise near-square white "transit" button with a thin frame and
 * a corner registration tick; the secondary is a hairline-outline ghost. Both
 * use a 2px radius (sharp, instrument-like) and a single confident hover state.
 */

interface PrimaryProps {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}

export function TransitButton({ onClick, disabled, children }: PrimaryProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="obs-btn-primary"
      style={{
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        fontSize: "13px",
        fontWeight: 600,
        letterSpacing: "0.01em",
        color: "#080a0c",
        padding: "13px 22px",
        border: "1px solid rgba(255,255,255,0.9)",
        borderRadius: "2px",
        background: "linear-gradient(180deg,#FFFFFF,#D7DCE4)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.12), 0 18px 44px -22px rgba(220,228,240,0.7)",
        transition: "transform .22s cubic-bezier(.16,1,.3,1), box-shadow .3s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

interface GhostProps {
  href: string;
  children: ReactNode;
}

export function SightButton({ href, children }: GhostProps) {
  return (
    <a
      href={href}
      className="obs-btn-ghost mono"
      style={{
        fontSize: "12px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#D9DEE7",
        textDecoration: "none",
        padding: "13px 20px",
        border: "1px solid rgba(234,240,250,0.16)",
        borderRadius: "2px",
        background: "rgba(234,240,250,0.015)",
        transition: "border-color .25s, background .25s, color .25s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </a>
  );
}
