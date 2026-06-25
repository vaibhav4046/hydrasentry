"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, KeyRound, Server } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { InlineError } from "@/components/shared/StateNotice";
import {
  CockpitCard,
  CockpitPill,
  CockpitSectionLabel,
} from "@/components/shell/CockpitCard";
import { McpConsole, type McpCallRecord } from "@/components/mcp/McpConsole";
import { getMcpManifest, getConfigStatus } from "@/lib/api";
import { cn } from "@/lib/cn";

interface ManifestTool {
  name: string;
  description: string;
}

interface ManifestView {
  name: string;
  version: string;
  description: string;
  tools: ManifestTool[];
}

// MCP Gateway. Shows the live MCP server identity and its tool catalog, a
// request/response console to invoke any tool, the shared-secret status, and a
// rolling log of recent calls. When the secret is unset the backend runs in
// demo mode (writes are not gated), which is surfaced honestly. Reskinned to
// the flat-cockpit system to match Command.
export default function McpPage() {
  const [manifest, setManifest] = useState<ManifestView | null>(null);
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [secretFingerprint, setSecretFingerprint] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [calls, setCalls] = useState<McpCallRecord[]>([]);

  useEffect(() => {
    let active = true;
    void getMcpManifest().then((result) => {
      if (!active) return;
      if (result.ok) {
        const data = result.data as unknown as ManifestView;
        setManifest(data);
      } else {
        setError(result.error);
      }
    });
    void getConfigStatus().then((result) => {
      if (!active || !result.ok) return;
      const raw = result.data.mcp_shared_secret;
      if (raw && typeof raw === "object") {
        const status = raw as { configured?: boolean; fingerprint?: string | null };
        setSecretConfigured(Boolean(status.configured));
        setSecretFingerprint(status.fingerprint ?? null);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function recordCall(record: McpCallRecord) {
    setCalls((prev) => [record, ...prev].slice(0, 8));
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-5">
        {error && <InlineError message={error} />}

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          {/* server identity */}
          <CockpitCard className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-hairline-strong bg-white/[.05]">
                <Server className="h-5 w-5 text-ink" strokeWidth={1.7} />
              </span>
              <div>
                <div className="cockpit-eyebrow">server</div>
                <div className="mt-1 text-lg font-semibold tracking-tight text-ink">
                  {manifest?.name ?? "hydrasentry-mcp"}
                </div>
              </div>
              <CockpitPill
                dot
                tone={manifest ? "bright" : "neutral"}
                label={manifest ? `v${manifest.version}` : "connecting"}
                className="ml-auto"
              />
            </div>
            <p className="text-sm leading-relaxed text-muted">
              {manifest?.description ??
                "HydraDB-native context-integrity harness for AI agents."}
            </p>
          </CockpitCard>

          {/* shared secret */}
          <CockpitCard className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted" strokeWidth={1.8} />
              <div className="cockpit-eyebrow">shared secret</div>
              <CockpitPill
                dot
                tone={secretConfigured ? "bright" : "neutral"}
                label={secretConfigured ? "enforced" : "demo mode"}
                className="ml-auto"
              />
            </div>
            {secretConfigured ? (
              <p className="mono rounded-lg border border-hairline bg-black/30 px-3 py-2 text-[11px] text-faint">
                {secretFingerprint ?? "configured"}
              </p>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-muted">
                No MCP_SHARED_SECRET is set, so write tools are not gated. This is
                demo mode. Supply a secret below to preview the authorized header.
              </p>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="cockpit-eyebrow">
                X-MCP-Secret (sent with write calls)
              </span>
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                type="password"
                placeholder="optional shared secret"
                className="mono rounded-lg border border-hairline bg-white/[.03] px-3 py-2.5 text-[12.5px] text-ink outline-none placeholder:text-faint focus-visible:border-hairline-strong focus-visible:ring-2 focus-visible:ring-white/30"
              />
            </label>
          </CockpitCard>
        </div>

        {/* tool catalog */}
        <CockpitCard className="flex flex-col gap-4 p-6">
          <CockpitSectionLabel meta="7 tools">Capabilities</CockpitSectionLabel>
          <p className="-mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
            Seven MCP tools expose the context-integrity harness. Write tools
            (replay, verify, quarantine, report, schedule) require the shared
            secret.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(manifest?.tools ?? FALLBACK_TOOLS).map((tool) => (
              <div
                key={tool.name}
                className="flex flex-col gap-1 rounded-lg border border-hairline bg-white/[.02] p-3.5"
              >
                <div className="mono flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted" strokeWidth={1.8} />
                  {tool.name}
                </div>
                <p className="text-[12px] leading-relaxed text-muted">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </CockpitCard>

        <McpConsole
          secret={secret}
          secretEnforced={secretConfigured}
          onCall={recordCall}
        />

        {/* recent calls */}
        <CockpitCard className="flex flex-col gap-3 p-5">
          <CockpitSectionLabel meta="mcp_calls.log">
            Recent MCP Calls
          </CockpitSectionLabel>
          {calls.length === 0 ? (
            <p className="mono text-[12px] text-faint">No calls yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {calls.map((call, i) => (
                <div
                  key={i}
                  className={cn(
                    "mono flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-[12px]",
                    call.ok
                      ? "border-l-white/25 bg-white/[.02] text-muted"
                      : "border-l-white bg-white/[.05] text-ink",
                  )}
                >
                  <span className="text-faint tabular-nums">{call.at}</span>
                  <span className="text-ink/85">{call.tool}</span>
                  <CockpitPill
                    dot
                    tone={call.ok ? "neutral" : "bright"}
                    label={call.ok ? "ok" : "error"}
                    className="ml-auto"
                  />
                </div>
              ))}
            </div>
          )}
        </CockpitCard>
      </div>
    </PageShell>
  );
}

const FALLBACK_TOOLS: ManifestTool[] = [
  { name: "scan_context", description: "Run a context-integrity scenario and return the risk result." },
  { name: "replay_attack", description: "Replay a poisoning attack scenario end to end (write)." },
  { name: "verify_skill", description: "Statically scan SkillMake content for unsafe instructions (write)." },
  { name: "quarantine_memory", description: "Quarantine a poisoned memory chunk in an owned tenant (write)." },
  { name: "generate_report", description: "Generate a Markdown finding report for a run (write)." },
  { name: "schedule_scan", description: "Schedule a simulated future scan by name (write)." },
  { name: "list_findings", description: "List recorded findings." },
];
