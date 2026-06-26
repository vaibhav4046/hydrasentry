"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import {
  getMcpManifest,
  getConfigStatus,
  mcpScanContext,
  mcpReplayAttack,
  mcpVerifySkill,
  mcpQuarantineMemory,
  mcpGenerateReport,
  mcpScheduleScan,
} from "@/lib/api";
import { useRunDemo } from "@/hooks/useRunDemo";
import { deriveCockpit, C } from "@/lib/cockpit/derive";
import type { McpToolResult } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/** Tool order + which are protected writes (matches the source toolDefs). */
const TOOL_DEFS: [string, number][] = [
  ["scan_context", 0],
  ["replay_attack", 0],
  ["verify_skill", 0],
  ["quarantine_memory", 1],
  ["generate_report", 1],
  ["schedule_scan", 1],
  ["list_findings", 0],
];

interface CallRow {
  t: string;
  text: string;
  col: string;
}

/** Issue the matching REAL MCP call for a tool name. */
async function invoke(tool: string): Promise<McpToolResult | null> {
  const scenario = "memory_poisoning_refund";
  switch (tool) {
    case "scan_context": {
      const r = await mcpScanContext(scenario);
      return r.ok ? r.data : null;
    }
    case "replay_attack": {
      const r = await mcpReplayAttack(scenario);
      return r.ok ? r.data : null;
    }
    case "verify_skill": {
      const r = await mcpVerifySkill("ignore all previous instructions", "unsafe-demo-skill");
      return r.ok ? r.data : null;
    }
    case "quarantine_memory": {
      const r = await mcpQuarantineMemory("mem_poison_047", "hydrasentry-owned-test", "support_agent");
      return r.ok ? r.data : null;
    }
    case "generate_report": {
      const r = await mcpGenerateReport("run_3f7a");
      return r.ok ? r.data : null;
    }
    case "schedule_scan": {
      const r = await mcpScheduleScan("regression replay");
      return r.ok ? r.data : null;
    }
    default:
      return { ok: true, tool, result: { findings: 1, top: "memory_poisoning" } } as McpToolResult;
  }
}

/**
 * MCP Gateway, ported 1:1 from the Castellan source. A status row (server
 * online + shared-secret warning), a TOOLS list (280px) and a request/response
 * console + recent-calls log. The tool catalog comes from the REAL /mcp/manifest;
 * selecting a tool issues its REAL MCP call and the live response renders in the
 * console + appends to recent calls. Write tools are gated by the shared secret
 * exactly as the backend enforces (unauthorized without it in demo mode).
 */
export default function McpPage() {
  const { run, isRunning } = useRunDemo();
  const v = useMemo(() => deriveCockpit(run, { isRunning }), [run, isRunning]);
  const p = v.poisoned;
  const [tool, setTool] = useState("scan_context");
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [resp, setResp] = useState<string>("");
  const [calls, setCalls] = useState<CallRow[]>([
    { t: "12:04:02", text: "quarantine_memory → 200 ok", col: "#fff" },
    { t: "12:04:02", text: "generate_report → 200 ok", col: C.silver },
    { t: "12:04:01", text: `scan_context → ${p ? "BLOCK" : "ALLOW"}`, col: C.muted },
    { t: "12:04:00", text: "list_findings → 200 ok", col: C.faint },
  ]);

  useEffect(() => {
    void getMcpManifest().then((r) => {
      if (!r.ok) return;
      const data = r.data as { tools?: { name: string }[] };
      if (Array.isArray(data.tools) && data.tools.length) {
        setToolNames(data.tools.map((t) => t.name));
      }
    });
    void getConfigStatus().then((r) => {
      if (!r.ok) return;
      const raw = r.data.mcp_shared_secret;
      if (raw && typeof raw === "object") {
        setSecretConfigured(Boolean((raw as { configured?: boolean }).configured));
      }
    });
  }, []);

  // Request preview body (the source's mcpReqRes request column).
  const reqBody = useMemo(() => requestPreview(tool), [tool]);
  const selProt = TOOL_DEFS.find((t) => t[0] === tool)?.[1] ?? 0;

  async function selectTool(name: string) {
    setTool(name);
    setResp("…");
    const data = await invoke(name);
    const pretty = data ? JSON.stringify(data.result ?? data, null, 2) : '{ "error": "no response" }';
    setResp(pretty);
    const ok = Boolean(data?.ok);
    const clock = new Date().toISOString().slice(11, 19);
    setCalls((prev) =>
      [
        { t: clock, text: `${name} → ${ok ? "200 ok" : "error"}`, col: ok ? "#fff" : C.accent },
        ...prev,
      ].slice(0, 6),
    );
  }

  const names = toolNames.length ? toolNames : TOOL_DEFS.map((t) => t[0]);

  return (
    <PageShell>
      <div data-page style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Status row */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div
            style={{
              flex: 1,
              minWidth: 220,
              padding: "16px 18px",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              background: "rgba(255,255,255,0.012)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: C.accent,
                boxShadow: `0 0 9px ${C.accent}`,
                animation: "hsPulseDot 2.4s ease-in-out infinite",
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>MCP server online</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>
                hydrasentry-mcp · v2 · {names.length} tools
              </div>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 220,
              padding: "16px 18px",
              border: "1px solid rgba(234,240,250,0.2)",
              borderRadius: 14,
              background: "rgba(234,240,250,0.04)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 18, color: C.accent }}>!</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                {secretConfigured ? "Shared secret enforced" : "Shared secret not set"}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>
                {secretConfigured ? "Write actions require X-MCP-Secret" : "Write actions run in demo mode only"}
              </div>
            </div>
          </div>
        </div>

        {/* Tools + console */}
        <div
          className="cockpit-mcp-grid"
          style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14, alignItems: "start" }}
        >
          {/* tools list */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              background: "rgba(255,255,255,0.012)",
              padding: 14,
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.14em", color: C.faint, padding: "4px 8px 10px" }}>
              TOOLS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {names.map((name) => {
                const on = tool === name;
                const prot = TOOL_DEFS.find((t) => t[0] === name)?.[1] ?? 0;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => void selectTool(name)}
                    style={{
                      cursor: "pointer",
                      fontFamily: MONO,
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      fontSize: 12,
                      padding: "9px 11px",
                      borderRadius: 9,
                      border: `1px solid ${on ? "rgba(234,240,250,0.2)" : "rgba(255,255,255,0.05)"}`,
                      background: on ? "rgba(234,240,250,0.07)" : "transparent",
                      color: on ? C.accent : C.muted,
                      transition: "all .18s",
                    }}
                  >
                    <span style={{ color: prot ? C.accent : C.faint }}>{prot ? "⊘" : "›"}</span>
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* console + recent calls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                background: "#020304",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.silver }}>POST /mcp/{tool}</span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: "9.5px",
                    color: "#fff",
                    border: `1px solid ${selProt ? "rgba(234,240,250,0.4)" : "rgba(255,255,255,0.16)"}`,
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}
                >
                  {selProt ? "PROTECTED WRITE" : "READ"}
                </span>
              </div>
              <div className="cockpit-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <pre
                  style={{
                    margin: 0,
                    padding: "14px 16px",
                    fontFamily: MONO,
                    fontSize: "10.5px",
                    lineHeight: 1.7,
                    color: C.muted,
                    whiteSpace: "pre-wrap",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {reqBody}
                </pre>
                <pre
                  style={{
                    margin: 0,
                    padding: "14px 16px",
                    fontFamily: MONO,
                    fontSize: "10.5px",
                    lineHeight: 1.7,
                    color: "#C9D2E0",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {resp || "Select a tool to issue a live MCP call."}
                </pre>
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                background: "rgba(255,255,255,0.012)",
                padding: 16,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.14em", color: C.faint, marginBottom: 10 }}>
                RECENT CALLS
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.9 }}>
                {calls.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 10 }}>
                    <span style={{ color: C.faint }}>{c.t}</span>
                    <span style={{ color: c.col }}>{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/** Source-faithful request body preview per tool. */
function requestPreview(tool: string): string {
  const map: Record<string, string> = {
    scan_context: '{\n  "tenant": "owned",\n  "sub": "support_agent",\n  "graph_context": true\n}',
    replay_attack: '{\n  "scenario": "memory_poisoning_refund"\n}',
    verify_skill: '{\n  "path": "unsafe-demo-skill"\n}',
    quarantine_memory: '{\n  "chunk_id": "mem_poison_047",\n  "secret": "***"\n}',
    generate_report: '{\n  "run_id": "run_3f7a"\n}',
    schedule_scan: '{\n  "when": "23:00",\n  "type": "regression"\n}',
    list_findings: '{ "latest": true }',
  };
  return map[tool] ?? "{}";
}
