"use client";

/**
 * Workspace switcher for the command rail. The demo runs against a single owned
 * tenant (hydrasentry-owned-test), so this is an HONEST dropdown rather than a
 * fake multi-tenant switcher: clicking the card opens a real menu that shows the
 * active workspace (checked) and its tenant/sub context. It is a working
 * affordance (opens, closes on outside-click / Escape, keyboard reachable), not
 * a dead chevron. If more workspaces ever exist they slot straight into WORKSPACES.
 */
import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

interface Workspace {
  id: string;
  label: string;
  tenant: string;
  sub: string;
}

const WORKSPACES: Workspace[] = [
  {
    id: "refund-agent",
    label: "Refund Agent",
    tenant: "hydrasentry-owned-test",
    sub: "support_agent",
  },
];

export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(WORKSPACES[0].id);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = WORKSPACES.find((w) => w.id === activeId) ?? WORKSPACES[0];

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "9px 10px",
          border: `1px solid ${open ? "rgba(234,240,250,0.22)" : "rgba(255,255,255,0.09)"}`,
          borderRadius: 11,
          background: open ? "rgba(234,240,250,0.04)" : "rgba(255,255,255,0.02)",
          transition: "border-color .2s, background .2s",
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            flex: "none",
            borderRadius: 8,
            background: "linear-gradient(135deg,#252b33,#0b0d11)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "grid",
            placeItems: "center",
            fontFamily: MONO,
            fontSize: 11,
            color: C.accent,
          }}
        >
          {active.label.charAt(0)}
        </span>
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.15,
            textAlign: "left",
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: "12.5px", fontWeight: 600, color: C.ink }}>{active.label}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: C.faint }}>workspace · prod</span>
        </span>
        <svg
          style={{
            marginLeft: "auto",
            flex: "none",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .2s",
          }}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={C.faint}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 10l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          data-workspace-menu
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 20,
            padding: 6,
            border: "1px solid rgba(234,240,250,0.14)",
            borderRadius: 12,
            background: "linear-gradient(180deg,rgba(14,17,22,0.98),rgba(6,8,10,0.98))",
            boxShadow: "0 18px 40px -18px rgba(0,0,0,0.8)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: "8.5px",
              letterSpacing: "0.2em",
              color: C.ghost,
              padding: "6px 8px 4px",
            }}
          >
            WORKSPACE
          </div>
          {WORKSPACES.map((w) => {
            const on = w.id === activeId;
            return (
              <button
                key={w.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  setActiveId(w.id);
                  setOpen(false);
                }}
                style={{
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 8px",
                  borderRadius: 9,
                  border: "1px solid transparent",
                  background: on ? "rgba(234,240,250,0.07)" : "transparent",
                  transition: "background .15s",
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: C.ink }}>{w.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.faint }}>
                    {w.tenant} · {w.sub}
                  </span>
                </span>
                {on && (
                  <svg
                    style={{ marginLeft: "auto", flex: "none" }}
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={C.accent}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
          <div
            style={{
              fontFamily: MONO,
              fontSize: 9,
              color: C.ghost,
              padding: "6px 8px 4px",
              lineHeight: 1.5,
            }}
          >
            Single owned tenant in this demo.
          </div>
        </div>
      )}
    </div>
  );
}
