"use client";

/**
 * "Connect your agent" panel. Generic MCP-client instructions (no vendor names):
 * install the stdio MCP server `hydrasentry-mcp`, then drop the API key into the
 * MCP client config. Once wired, the agent's risky memories flow into this
 * dashboard as real incidents.
 */
import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

const INSTALL_CMD = "pip install hydrasentry-mcp";

function mcpConfig(): string {
  return [
    "{",
    '  "mcpServers": {',
    '    "hydrasentry": {',
    '      "command": "hydrasentry-mcp"',
    "    }",
    "  }",
    "}",
  ].join("\n");
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked; text stays selectable */
    }
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", color: C.faint }}>{label}</span>
        <button
          type="button"
          onClick={() => void copy()}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: 10 }}
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

export function ConnectAgentPanel() {
  return (
    <div className="cockpit-card" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <Terminal size={16} color={C.accent} />
        <h2 className="cockpit-display" style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>
          Connect your agent
        </h2>
      </div>
      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: C.muted, marginBottom: 12 }}>
        For teams shipping agents with persistent memory or RAG. A single planted
        memory can silently override your policy, and prompt scanners never see it
        because it lives in the retrieval layer, not the prompt. HydraSentry
        replays the same task on clean vs poisoned context, traces the taint
        through the graph, and BLOCKS the unsafe action through MCP before your
        agent fires, then certifies the block.
      </p>
      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: C.muted, marginBottom: 18 }}>
        No account, no sign-in, no key to mint. Install the stdio MCP server and
        point any MCP-compatible client at it. Once wired, every risky memory your
        agent retrieves is scored, certified, and lands in the incident console
        below.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <CodeBlock label="1 · INSTALL THE MCP SERVER" code={INSTALL_CMD} />
        <CodeBlock label="2 · ADD TO YOUR MCP CLIENT CONFIG" code={mcpConfig()} />
        <div style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.7, color: C.faint }}>
          3 · Restart your MCP client. Your agent&apos;s next risky retrieval is
          scanned and appears in the console.
        </div>
      </div>
    </div>
  );
}
