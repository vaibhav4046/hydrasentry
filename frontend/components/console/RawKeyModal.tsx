"use client";

/**
 * Copy-once modal for a freshly-minted API key. The raw hs_live_ key is shown
 * exactly ONCE (the backend never returns it again) with a loud warning. Copy +
 * acknowledge are the only ways out — there is no silent dismiss that loses it.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, ShieldAlert, X } from "lucide-react";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

export function RawKeyModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: leave the key selectable in the field below.
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your new API key"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 130, display: "grid", placeItems: "center", padding: 16, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cockpit-card"
        style={{ position: "relative", width: "100%", maxWidth: 520, padding: 24 }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", color: C.faint, cursor: "pointer" }}
        >
          <X size={16} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <ShieldAlert size={18} color={C.accent} />
          <h2 className="cockpit-display" style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>
            Copy your API key now
          </h2>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: C.muted, marginBottom: 16 }}>
          This is the <span style={{ color: C.ink }}>only time</span> the full key is shown. It is
          stored only as a salted hash — we cannot show it again. If you lose it, revoke and create a new one.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(234,240,250,0.2)",
            background: "rgba(234,240,250,0.04)",
          }}
        >
          <code style={{ fontFamily: MONO, fontSize: 12.5, color: C.ink, wordBreak: "break-all", flex: 1 }}>
            {rawKey}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            className="hydra-button-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 8, fontSize: 12, flexShrink: 0, cursor: "pointer" }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="hydra-button-primary"
          style={{ marginTop: 18, width: "100%", padding: "11px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          I&apos;ve saved my key
        </button>
      </div>
    </div>,
    document.body,
  );
}
