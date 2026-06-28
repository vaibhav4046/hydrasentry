"use client";

/**
 * Homepage install / connect band.
 *
 * Lets a visitor wire HydraSentry immediately without leaving the landing page:
 * install the stdio MCP server, drop it into their MCP client config, and (if
 * they want their own model) bring a key in Settings. Real, copy-ready, and it
 * links into the full /docs page. Mirrors the /docs install + connect steps so
 * the two never drift.
 */
import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";
import { CopyBlock } from "@/components/docs/CopyBlock";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

const INSTALL_CMD = "pip install hydrasentry-mcp";

const MCP_CONFIG = [
  "{",
  '  "mcpServers": {',
  '    "hydrasentry": {',
  '      "command": "hydrasentry-mcp"',
  "    }",
  "  }",
  "}",
].join("\n");

export function ObservatoryInstall() {
  return (
    <section
      id="install"
      style={{
        position: "relative",
        zIndex: 2,
        padding: "clamp(48px,7vw,96px) 0",
        scrollMarginTop: 80,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span aria-hidden style={{ height: 1, width: 28, background: "rgba(217,222,231,0.4)" }} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: C.muted,
          }}
        >
          Install · Connect
        </span>
      </div>

      <h2
        className="obs-display"
        style={{
          margin: "0 0 10px",
          fontSize: "clamp(26px,3.4vw,40px)",
          fontWeight: 600,
          color: C.ink,
          letterSpacing: "-0.02em",
          maxWidth: "18ch",
        }}
      >
        Wire your agent in two steps.
      </h2>
      <p style={{ margin: "0 0 28px", fontSize: 14.5, lineHeight: 1.65, color: C.muted, maxWidth: 620 }}>
        HydraSentry is a stdio MCP server. Install it, point any MCP-compatible
        client at it, and every risky memory your agent retrieves is scored,
        blocked, and certified. No account, no sign-in.
      </p>

      <div
        className="obs-install-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}
      >
        <div className="cockpit-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <Step n="1" title="Install the MCP server" />
          <CopyBlock label="TERMINAL" code={INSTALL_CMD} />
        </div>
        <div className="cockpit-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <Step n="2" title="Add it to your MCP client config" />
          <CopyBlock label="MCP CLIENT CONFIG" code={MCP_CONFIG} />
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: C.muted, display: "flex", alignItems: "center", gap: 8 }}>
          <Terminal size={14} color={C.faint} />
          Want your own model? Bring a key in{" "}
          <Link href="/settings" style={{ color: C.accent, textDecoration: "underline", textUnderlineOffset: 2 }}>
            Settings
          </Link>{" "}
          (optional).
        </p>
        <Link
          href="/docs"
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: C.silver,
            textDecoration: "none",
            padding: "9px 14px",
            border: "1px solid rgba(234,240,250,0.16)",
            borderRadius: 2,
          }}
        >
          Read the docs
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

function Step({ n, title }: { n: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 10,
          color: "#080a0c",
          background: "linear-gradient(180deg,#FFFFFF,#D7DCE4)",
          borderRadius: "50%",
          width: 20,
          height: 20,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
        }}
      >
        {n}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{title}</span>
    </div>
  );
}
