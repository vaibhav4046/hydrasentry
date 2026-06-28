"use client";

/**
 * A labelled, copy-to-clipboard code block for the public /docs page.
 *
 * Monochrome, mono-font, matches the cockpit code-block style. The copy
 * button writes the exact code to the clipboard and shows a transient "copied"
 * confirmation; if the clipboard API is blocked, the text stays selectable so
 * the snippet is never trapped.
 */
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

interface CopyBlockProps {
  label: string;
  code: string;
}

export function CopyBlock({ label, code }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked; the text stays selectable */
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9.5,
            letterSpacing: "0.12em",
            color: C.faint,
          }}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "transparent",
            border: "none",
            color: C.muted,
            cursor: "pointer",
            fontFamily: MONO,
            fontSize: 10,
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.09)",
          background: "rgba(0,0,0,0.35)",
          fontFamily: MONO,
          fontSize: 11.5,
          lineHeight: 1.7,
          color: C.silver,
          overflowX: "auto",
          whiteSpace: "pre",
        }}
      >
        {code}
      </pre>
    </div>
  );
}
