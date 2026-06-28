"use client";

/**
 * The public /docs body: install path, connect-your-agent steps + MCP client
 * config, the 7 MCP tools, bring-your-own-key with provider links, usage, and
 * the public API endpoints. Everything is real and copy-ready; the snippets are
 * the exact commands and config a visitor runs to wire their own agent.
 *
 * Pure presentational client component (it owns no data, only the per-block copy
 * state inside CopyBlock). Tokens come from the cockpit palette so the docs read
 * as one system with the rest of the product.
 */
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { CopyBlock } from "./CopyBlock";
import { BYO_PROVIDERS } from "@/lib/byoKey";
import { BACKEND_URL } from "@/lib/api";
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

/** The seven tools the MCP firewall exposes (mirrors backend mcp_gateway.py). */
const MCP_TOOLS: { name: string; kind: "read" | "write"; desc: string }[] = [
  { name: "scan_context", kind: "read", desc: "Run a context-integrity scenario and return the risk result." },
  { name: "replay_attack", kind: "write", desc: "Replay a poisoning attack scenario end to end." },
  { name: "verify_skill", kind: "write", desc: "Statically scan a SkillMake SKILL.md for unsafe instructions." },
  { name: "quarantine_memory", kind: "write", desc: "Quarantine a poisoned memory chunk in an owned tenant." },
  { name: "generate_report", kind: "write", desc: "Generate a Markdown finding report for a run." },
  { name: "schedule_scan", kind: "write", desc: "Schedule a simulated future regression scan by name." },
  { name: "list_findings", kind: "read", desc: "List recorded findings." },
];

/** The public API endpoints a visitor can call directly. */
const API_ENDPOINTS: { method: string; path: string; desc: string }[] = [
  { method: "POST", path: "/runs/judge-demo", desc: "The canonical poisoned-memory run. Returns the 87 / HIGH / BLOCK artifact." },
  { method: "POST", path: "/runs/real", desc: "A genuine run: live model baseline vs poisoned answers + a computed risk score and band." },
  { method: "POST", path: "/graph/real-query", desc: "A live HydraDB query_paths traversal of the poisoned tenant; returns the real graph." },
  { method: "GET", path: "/standards/asi06", desc: "The self-verified OWASP ASI06 (Memory Poisoning) control mapping." },
  { method: "GET", path: "/mcp/manifest", desc: "The MCP server manifest: the seven tools and the resources they expose." },
];

export function DocsContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <DocsIntro />
      <Section id="install" n="01" title="Install">
        <p style={pStyle}>
          HydraSentry ships as a stdio MCP server. Install it from PyPI with pip
          (Python 3.11+):
        </p>
        <CopyBlock label="INSTALL THE MCP SERVER" code={INSTALL_CMD} />
      </Section>

      <Section id="connect" n="02" title="Connect your agent">
        <p style={pStyle}>
          Point any MCP-compatible client (Claude Desktop, Cursor, your own
          runtime) at the installed server by adding it to your MCP client
          config. No account, no sign-in, no key to mint.
        </p>
        <CopyBlock label="ADD TO YOUR MCP CLIENT CONFIG" code={MCP_CONFIG} />
        <p style={{ ...pStyle, marginTop: 14 }}>
          Restart your MCP client. From then on, every risky memory your agent
          retrieves is scored, certified, and lands in the public incident
          console. Open the{" "}
          <Link href="/console" style={linkStyle}>
            console
          </Link>{" "}
          to watch findings arrive.
        </p>
      </Section>

      <Section id="tools" n="03" title="The 7 MCP tools">
        <p style={pStyle}>
          The gateway exposes a fixed surface of seven tools. The read tools run
          unauthenticated; the write tools require the shared MCP secret, so a
          poisoned skill can never quarantine memory or schedule scans on its
          own. This is the firewall: the unsafe action is gated before your agent
          can fire it.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MCP_TOOLS.map((t) => (
            <div
              key={t.name}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "baseline",
                padding: "11px 14px",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                background: "rgba(255,255,255,0.012)",
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.silver, minWidth: 158 }}>
                {t.name}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 8.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: t.kind === "write" ? C.accent : C.faint,
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 999,
                  padding: "2px 7px",
                  whiteSpace: "nowrap",
                }}
              >
                {t.kind}
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: C.muted }}>{t.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="byo-key" n="04" title="Bring your own model key (optional)">
        <p style={pStyle}>
          By default, real runs use the platform model. To run against your own
          model and key instead, open{" "}
          <Link href="/settings" style={linkStyle}>
            Settings
          </Link>{" "}
          and paste a provider key. It is stored only in your browser&apos;s
          localStorage and sent per-request on a run; it is never persisted on
          our backend. Grab a key from your provider:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {BYO_PROVIDERS.map((p) => (
            <a
              key={p.id}
              href={p.getKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 14px",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                background: "rgba(255,255,255,0.012)",
                textDecoration: "none",
                color: C.silver,
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{p.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>Get your key</span>
              </span>
              <ExternalLink size={14} color={C.muted} />
            </a>
          ))}
        </div>
      </Section>

      <Section id="usage" n="05" title="Usage">
        <p style={pStyle}>
          The fastest way to see HydraSentry work is the live attack on the{" "}
          <Link href="/" style={linkStyle}>
            homepage
          </Link>
          : it replays the same task on clean vs poisoned context, traces the
          taint through the memory graph, blocks the unsafe action through MCP,
          and seals the block into a Memory Integrity Certificate. Then explore
          the cockpit:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 7 }}>
          <UsageItem href="/graph" label="Context Graph" desc="run a live HydraDB query_paths traversal and inspect the tainted path" />
          <UsageItem href="/mcp" label="MCP Gateway" desc="call the seven tools and watch the firewall gate the write tools" />
          <UsageItem href="/standards" label="OWASP ASI Top-10" desc="the self-verified coverage map, recomputed against the running code" />
          <UsageItem href="/results" label="Results Center" desc="the finding, the certificate, and the downloadable evidence report" />
        </ul>
      </Section>

      <Section id="api" n="06" title="Public API">
        <p style={pStyle}>
          Every value-path surface is backed by a public endpoint you can call
          directly. The live backend base URL is:
        </p>
        <CopyBlock label="BACKEND BASE URL" code={BACKEND_URL} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {API_ENDPOINTS.map((e) => (
            <div
              key={e.path}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "baseline",
                padding: "11px 14px",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                background: "rgba(255,255,255,0.012)",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  color: e.method === "POST" ? C.accent : C.faint,
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 4,
                  padding: "2px 6px",
                  minWidth: 44,
                  textAlign: "center",
                }}
              >
                {e.method}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.silver, minWidth: 188 }}>{e.path}</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: C.muted, flex: 1 }}>{e.desc}</span>
            </div>
          ))}
        </div>
        <p style={{ ...pStyle, marginTop: 14 }}>
          The full MCP tool surface is also reachable over HTTP under{" "}
          <span style={{ fontFamily: MONO, color: C.silver }}>/mcp/*</span> (one
          route per tool); the write tools require the{" "}
          <span style={{ fontFamily: MONO, color: C.silver }}>X-MCP-Secret</span>{" "}
          header.
        </p>
      </Section>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingTop: 8,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          className="obs-btn-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: "#080a0c",
            padding: "10px 16px",
            border: "1px solid rgba(255,255,255,0.9)",
            borderRadius: 2,
            background: "linear-gradient(180deg,#FFFFFF,#D7DCE4)",
            textDecoration: "none",
          }}
        >
          Run the live attack
          <ArrowRight size={15} />
        </Link>
        <Link
          href="/console"
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: C.silver,
            textDecoration: "none",
            padding: "10px 14px",
            border: "1px solid rgba(234,240,250,0.14)",
            borderRadius: 2,
          }}
        >
          Open the console
        </Link>
      </div>
    </div>
  );
}

function DocsIntro() {
  return (
    <div>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.faint,
        }}
      >
        Documentation
      </span>
      <h1
        className="obs-display"
        style={{ margin: "10px 0 12px", fontSize: "clamp(30px,4vw,46px)", fontWeight: 600, color: C.ink, letterSpacing: "-0.02em" }}
      >
        Install, connect, and run HydraSentry
      </h1>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: C.muted, maxWidth: 680 }}>
        HydraSentry secures the memory layer before your agent acts. Install the
        MCP server, point your client at it, optionally bring your own model key,
        and every risky retrieval is scored, blocked, and certified. Everything
        below is real and copy-ready.
      </p>
    </div>
  );
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: 90 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, letterSpacing: "0.1em" }}>{n}</span>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: C.accent, letterSpacing: "-0.01em" }}>{title}</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}

function UsageItem({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <li style={{ fontSize: 13, lineHeight: 1.55, color: C.muted }}>
      <Link href={href} style={linkStyle}>
        {label}
      </Link>{" "}
      - {desc}
    </li>
  );
}

const pStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13.5,
  lineHeight: 1.65,
  color: C.muted,
  maxWidth: 720,
};

const linkStyle: React.CSSProperties = {
  color: C.accent,
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
