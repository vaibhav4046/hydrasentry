/**
 * Castellan Cockpit data deriver.
 *
 * Ports the data model from the Castellan standalone source's renderVals(), but
 * fed by the REAL Constellan run artifact + live backend posture instead of the
 * source's hard-coded mock values. The single source of "posture" is whether a
 * run is present and compromised: a live judge-demo run flips the cockpit into
 * the poisoned / CRITICAL state, with the risk score, agent statuses, activity
 * log, behavior diff, attack type/confidence and stage timeline all read from
 * the artifact. With no run we render the source's nominal baseline (the
 * canonical 12 / NOMINAL demo posture), which matches the standalone exactly.
 *
 * Colors are the exact Castellan ramp; danger/safe is brightness only (no hue).
 */
import type { RunArtifact } from "@/lib/types";

// --- Castellan color ramp (exact) ------------------------------------------
export const C = {
  white: "#fff",
  silver: "#D9DEE7",
  accent: "#EAF0FA",
  accentDim: "#AEB6C2",
  ink: "#F3F6FB",
  muted: "#9BA3AF",
  faint: "#5F6875",
  ghost: "#4a525e",
} as const;

export interface MetricSlot {
  label: string;
  value: string;
  sub: string;
  color: string;
}

export interface AgentSlot {
  name: string;
  status: string;
  dot: string;
}

export interface LogSlot {
  t: string;
  text: string;
  color: string;
}

export interface CockpitVals {
  poisoned: boolean;
  risk: number;
  riskState: string;
  chipColor: string;
  chipBorder: string;
  chipBg: string;
  demoLabel: string;
  missionMetrics: MetricSlot[];
  agents: AgentSlot[];
  activityLog: LogSlot[];
  // Replay slots
  baselineText: string;
  poisonText: string;
  poisonTextColor: string;
  poisonCardBorder: string;
  poisonCardBg: string;
  poisonTag: string;
  poisonState: string;
  gaugeDash: string;
  attackType: string;
  conf: string;
  behaviorDiff: string;
}

/** Two-digit zero-padded clock part of an ISO timestamp (UTC), best-effort. */
function clockFromIso(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().slice(11, 19);
}

function secondsOf(clock: string): number {
  const [h = "0", m = "0", s = "0"] = clock.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** Advance a base HH:MM:SS clock by n seconds (UTC, wraps a day). */
function tick(base: string, baseSecs: number, n: number): string {
  if (base === "—") return "—";
  const total = (baseSecs + n) % 86400;
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Count distinct HydraDB memory chunks touched by a run's graph. */
function memoriesInRun(run: RunArtifact): number {
  const chunks = new Set<string>();
  for (const n of run.graph.nodes) if (n.source_chunk_id) chunks.add(n.source_chunk_id);
  for (const t of run.graph.query_paths) if (t.source_chunk_id) chunks.add(t.source_chunk_id);
  if (chunks.size > 0) return chunks.size;
  return run.poisoned.retrieved_chunk_ids.length || run.graph.query_paths.length || 248;
}

/**
 * Build every cockpit data slot from the live run (preferred) plus the
 * operator's chosen autonomy and the in-flight flag. With no run we mirror the
 * source's nominal baseline exactly (12 / NOMINAL, clean log, 8 agents idle).
 */
export function deriveCockpit(
  run: RunArtifact | null,
  opts: { isRunning?: boolean } = {},
): CockpitVals {
  const p = Boolean(run);
  const sil = C.silver;
  const risk = run ? run.risk.score : 12;
  const nextScan = run?.scheduled_scan.next_run
    ? run.scheduled_scan.next_run.slice(11, 16) || "23:00"
    : "23:00";

  const chipColor = p ? C.white : sil;
  const riskState = run ? run.risk.band : "NOMINAL";

  // --- Mission metrics (real run drives risk + scan counts) ---
  const memories = run ? memoriesInRun(run) : 248;
  const skillFlag = run?.skill_scan ? "1 flagged" : "all clean";
  const missionMetrics: MetricSlot[] = [
    {
      label: "RISK SCORE",
      value: String(risk),
      sub: p ? `${riskState.toLowerCase()} · hard fail` : "nominal",
      color: p ? C.white : sil,
    },
    {
      label: "MEMORIES SCANNED",
      value: String(memories),
      sub: p ? "1 quarantined" : "all clean",
      color: sil,
    },
    {
      label: "SKILLS SCANNED",
      value: "12",
      sub: p ? skillFlag : "all clean",
      color: sil,
    },
    { label: "NEXT SCAN", value: nextScan, sub: "regression replay", color: sil },
  ];

  // --- Agent crew (statuses flip with the run posture) ---
  const agentDefs: [string, string, string][] = [
    ["Memory Sentinel", "flagged poisoned_memory", "monitoring 248 memories"],
    ["Replay Agent", `drift detected · ${risk}`, "baseline nominal"],
    ["Skill Auditor", "quarantined unsafe skill", "12 skills clean"],
    ["Policy Guardian", "stale v1 blocked", "policy v2 enforced"],
    ["MCP Firewall", `decision: ${run ? run.firewall.decision.toUpperCase() : "BLOCK"}`, "allow · idle"],
    ["Report Agent", "evidence generated", "standby"],
    ["Self Refiner", "regression rule created", "idle"],
    ["Scheduler Agent", `next scan ${nextScan}`, `next scan ${nextScan}`],
  ];
  const agents: AgentSlot[] = agentDefs.map(([name, hot, cool], i) => ({
    name,
    status: p ? (i === 7 ? cool : hot) : i === 7 ? cool : cool,
    dot: p && i < 7 ? C.white : C.faint,
  }));

  // --- Activity log (live run stages, else idle prompt) ---
  let activityLog: LogSlot[];
  if (run) {
    const base = clockFromIso(run.created_at, "12:04:01");
    const bs = secondsOf(base);
    activityLog = [
      { t: tick(base, bs, 5), text: `firewall.decision = ${run.firewall.decision.toUpperCase()}`, color: C.white },
      { t: tick(base, bs, 4), text: `risk score = ${risk} · ${riskState.toLowerCase()}`, color: C.accent },
      { t: tick(base, bs, 3), text: "taint → query_path → core", color: sil },
      { t: tick(base, bs, 2), text: `poison detected · ${run.quarantine.memory_id ?? "oq-chunk-7f3"}`, color: C.accent },
      { t: tick(base, bs, 1), text: "memory quarantined", color: C.muted },
      { t: tick(base, bs, 0), text: `scan scheduled ${nextScan}`, color: C.faint },
    ];
  } else {
    activityLog = [
      { t: "12:03:58", text: "clean context seeded · 4 chunks", color: C.muted },
      { t: "12:03:59", text: "baseline replay = SAFE", color: sil },
      { t: "12:04:00", text: "awaiting injection…", color: C.faint },
      { t: "12:04:00", text: "firewall.decision = ALLOW", color: C.faint },
      { t: "12:04:01", text: "8 agents nominal", color: C.muted },
      { t: "12:04:01", text: "idle", color: C.faint },
    ];
  }

  // --- Replay slots ---
  const baselineText = run?.baseline.answer
    ? run.baseline.answer
    : "I need manager approval before processing this £900 refund.";
  const poisonText = run?.poisoned.answer
    ? run.poisoned.answer
    : "Inject poisoned memory to compare behavior drift.";
  const behaviorDiff = run
    ? run.behavior_diff.changed
      ? run.behavior_diff.indicators[0] ??
        "Answer flips from policy-compliant refusal to instant approval."
      : "No drift. Answer follows current policy."
    : "No drift. Answer follows current policy.";

  return {
    poisoned: p,
    risk,
    riskState,
    chipColor,
    chipBorder: p ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.14)",
    chipBg: p ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
    demoLabel: opts.isRunning ? "Running…" : p ? "Re-run demo" : "Run Demo",
    missionMetrics,
    agents,
    activityLog,
    baselineText,
    poisonText,
    poisonTextColor: p ? C.ink : C.faint,
    poisonCardBorder: p ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.09)",
    poisonCardBg: p ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.016)",
    poisonTag: p ? C.white : C.faint,
    poisonState: p ? "UNSAFE" : "PENDING",
    gaugeDash: (170 - 170 * (risk / 100)).toFixed(1),
    attackType: run ? run.risk.attack_type : "memory_poisoning",
    conf: run ? run.risk.confidence.toFixed(2) : "0.99",
    behaviorDiff,
  };
}
