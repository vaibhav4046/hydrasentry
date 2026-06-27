"use client";

/**
 * Signed-in user chip + sign-out, rendered in the console top bar. Shows the
 * email and a dropdown with the resolved tenant id and a sign-out control.
 */
import { useEffect, useRef, useState } from "react";
import { LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

export function UserMenu() {
  const { user, tenantId, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) return null;
  const email = user.email ?? "signed in";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 9,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.03)",
          color: C.silver,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12.5,
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "rgba(234,240,250,0.1)",
          }}
        >
          <UserIcon size={12} color={C.accent} />
        </span>
        <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {email}
        </span>
        <ChevronDown size={13} color={C.faint} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            minWidth: 240,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "linear-gradient(180deg,rgba(13,16,20,0.97),rgba(6,8,10,0.98))",
            backdropFilter: "blur(12px)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            zIndex: 40,
          }}
        >
          <div style={{ padding: "4px 8px 8px" }}>
            <div style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
              {email}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint, marginTop: 4 }}>
              tenant {tenantId ? `${tenantId.slice(0, 8)}…` : "syncing…"}
            </div>
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 8px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: C.silver,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12.5,
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <LogOut size={14} color={C.muted} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
