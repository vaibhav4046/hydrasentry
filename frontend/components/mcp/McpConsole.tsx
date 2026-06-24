"use client";

import { useState } from "react";
import { Loader2, SendHorizontal, Lock } from "lucide-react";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { GlowButton } from "@/components/noir/GlowButton";
import { StatusPill } from "@/components/noir/StatusPill";
import {
  mcpScanContext,
  mcpReplayAttack,
  mcpVerifySkill,
  mcpQuarantineMemory,
  mcpGenerateReport,
  mcpScheduleScan,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import type { McpToolResult } from "@/lib/types";

export interface McpCallRecord {
  tool: string;
  request: unknown;
  response: McpToolResult;
  ok: boolean;
  at: string;
}

interface ToolSpec {
  name: string;
  inputLabel: string;
  placeholder: string;
  requiresSecret: boolean;
  defaultValue: string;
}

// The tools the console can invoke, in manifest order. scan_context is the only
// read tool; the rest mutate and require the shared secret. list_findings is a
// read resource exposed on the page separately.
const TOOLS: ToolSpec[] = [
  {
    name: "scan_context",
    inputLabel: "scenario_id",
    placeholder: "memory_poisoning_refund",
    requiresSecret: false,
    defaultValue: "memory_poisoning_refund",
  },
  {
    name: "replay_attack",
    inputLabel: "scenario_id",
    placeholder: "memory_poisoning_refund",
    requiresSecret: true,
    defaultValue: "memory_poisoning_refund",
  },
  {
    name: "verify_skill",
    inputLabel: "skill content",
    placeholder: "Paste SKILL.md content",
    requiresSecret: true,
    defaultValue: "",
  },
  {
    name: "quarantine_memory",
    inputLabel: "chunk_id",
    placeholder: "mem_poison_047",
    requiresSecret: true,
    defaultValue: "mem_poison_047",
  },
  {
    name: "generate_report",
    inputLabel: "run_id",
    placeholder: "run_...",
    requiresSecret: true,
    defaultValue: "",
  },
  {
    name: "schedule_scan",
    inputLabel: "scan name",
    placeholder: "Nightly Memory Scan",
    requiresSecret: true,
    defaultValue: "Nightly Memory Scan",
  },
];

interface McpConsoleProps {
  secret: string;
  secretEnforced: boolean;
  onCall: (record: McpCallRecord) => void;
  className?: string;
}

// Request/response viewer. Pick a tool, supply its single input, optionally
// attach the X-MCP-Secret, and Send. The composed request and the raw JSON
// response render in mono panels. The parent owns the secret and the recent
// call log.
export function McpConsole({
  secret,
  secretEnforced,
  onCall,
  className,
}: McpConsoleProps) {
  const [toolName, setToolName] = useState(TOOLS[0].name);
  const [input, setInput] = useState(TOOLS[0].defaultValue);
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<McpCallRecord | null>(null);

  const tool = TOOLS.find((t) => t.name === toolName) ?? TOOLS[0];

  function selectTool(name: string) {
    setToolName(name);
    const next = TOOLS.find((t) => t.name === name);
    setInput(next?.defaultValue ?? "");
  }

  function buildRequest(): { body: unknown; secretSent?: string } {
    switch (tool.name) {
      case "scan_context":
        return { body: { scenario_id: input } };
      case "replay_attack":
        return { body: { scenario_id: input }, secretSent: secret || undefined };
      case "verify_skill":
        return { body: { content: input }, secretSent: secret || undefined };
      case "quarantine_memory":
        return { body: { chunk_id: input }, secretSent: secret || undefined };
      case "generate_report":
        return { body: { run_id: input }, secretSent: secret || undefined };
      case "schedule_scan":
        return { body: { name: input }, secretSent: secret || undefined };
      default:
        return { body: {} };
    }
  }

  async function send() {
    setPending(true);
    const used = secret || undefined;
    let response: McpToolResult;
    switch (tool.name) {
      case "scan_context":
        response = await unwrap(mcpScanContext(input));
        break;
      case "replay_attack":
        response = await unwrap(mcpReplayAttack(input, used));
        break;
      case "verify_skill":
        response = await unwrap(mcpVerifySkill(input, undefined, used));
        break;
      case "quarantine_memory":
        response = await unwrap(
          mcpQuarantineMemory(input, undefined, undefined, used),
        );
        break;
      case "generate_report":
        response = await unwrap(mcpGenerateReport(input, used));
        break;
      case "schedule_scan":
        response = await unwrap(mcpScheduleScan(input, used));
        break;
      default:
        response = { ok: false, error: "unknown tool" };
    }
    setPending(false);
    const record: McpCallRecord = {
      tool: tool.name,
      request: buildRequest().body,
      response,
      ok: Boolean(response.ok),
      at: new Date().toISOString().slice(11, 19),
    };
    setLast(record);
    onCall(record);
  }

  return (
    <GlassPanel className={cn("flex flex-col gap-4 p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="mono text-[11px] uppercase tracking-[0.16em] text-faint">
          request / response
        </div>
        {tool.requiresSecret && (
          <span className="mono inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-muted">
            <Lock className="h-3 w-3" strokeWidth={1.9} />
            write tool
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <select
          value={toolName}
          onChange={(e) => selectTool(e.target.value)}
          aria-label="MCP tool"
          className="mono rounded-xl border border-hairline-strong bg-white/[.04] px-3 py-2.5 text-[12.5px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {TOOLS.map((t) => (
            <option key={t.name} value={t.name} className="bg-panel">
              {t.name}
            </option>
          ))}
        </select>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tool.placeholder}
          aria-label={tool.inputLabel}
          className="mono rounded-xl border border-hairline-strong bg-white/[.04] px-3 py-2.5 text-[12.5px] text-ink outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-white/60"
        />
      </div>

      <div className="flex items-center gap-3">
        <GlowButton
          variant="primary"
          size="sm"
          onClick={() => void send()}
          disabled={pending || input.trim().length === 0}
          iconLeft={
            pending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
            ) : (
              <SendHorizontal className="h-4 w-4" strokeWidth={1.8} />
            )
          }
        >
          {pending ? "Sending" : "Send"}
        </GlowButton>
        {tool.requiresSecret && !secret && secretEnforced && (
          <span className="mono text-[11px] text-muted">
            secret required: expect unauthorized
          </span>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <JsonPanel
          title="request"
          value={{
            tool: tool.name,
            input: buildRequest().body,
            ...(tool.requiresSecret
              ? { "X-MCP-Secret": secret ? "(provided)" : "(none)" }
              : {}),
          }}
        />
        <JsonPanel
          title="response"
          value={last?.response ?? null}
          tone={last ? (last.ok ? "ok" : "fail") : "idle"}
        />
      </div>
    </GlassPanel>
  );
}

async function unwrap(
  promise: Promise<{ ok: true; data: McpToolResult } | { ok: false; error: string }>,
): Promise<McpToolResult> {
  const result = await promise;
  if (result.ok) return result.data;
  return { ok: false, error: result.error };
}

interface JsonPanelProps {
  title: string;
  value: unknown;
  tone?: "idle" | "ok" | "fail";
}

function JsonPanel({ title, value, tone = "idle" }: JsonPanelProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-black/40">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <span className="mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
          {title}
        </span>
        {tone === "ok" && <StatusPill tone="active" label="ok" />}
        {tone === "fail" && <StatusPill tone="critical" label="error" />}
      </div>
      <pre className="mono max-h-64 overflow-auto p-3 text-[11.5px] leading-relaxed text-ink/85">
        {value === null ? "// no response yet" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
