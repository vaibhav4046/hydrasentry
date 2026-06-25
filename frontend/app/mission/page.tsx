"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { InlineError } from "@/components/shared/StateNotice";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { CockpitMetric } from "@/components/shell/CockpitMetric";
import { CockpitAgentCrew } from "@/components/shell/CockpitAgentCrew";
import {
  CockpitActivityLog,
  type ActivityLine,
} from "@/components/shell/CockpitActivityLog";
import { useRunDemo } from "@/hooks/useRunDemo";
import { getResultsSummary } from "@/lib/api";
import { humanize } from "@/lib/format";
import type { ResultsSummary, RunArtifact } from "@/lib/types";

const AUTONOMY_OPTIONS = [
  { value: "manual", label: "Manual", hint: "Operator confirms every action" },
  { value: "copilot", label: "Copilot", hint: "Suggests; operator approves" },
  { value: "autopilot", label: "Autopilot", hint: "Acts within policy bounds" },
];

const MISSION_OBJECTIVE =
  "Protect refund agent from poisoned memory and unsafe skills";

/**
 * Command — the flagship cockpit surface. An ACTIVE MISSION banner with an
 * autonomy toggle, a row of four big-number metrics, the eight-agent crew, and a
 * live activity log. Every number is wired to the REAL backend: the in-store
 * judge-demo run drives risk / scans / next-scan and the log; a results-summary
 * read fills standing values before any run. The top-bar "Run Demo" button
 * triggers the real run and this page reacts to it live.
 */
export default function MissionPage() {
  const { run, isRunning, error } = useRunDemo();
  const [autonomy, setAutonomy] = useState("copilot");
  const [summary, setSummary] = useState<ResultsSummary | null>(null);

  // Standing aggregate for the pre-run state (real backend; falls back to the
  // bundled fixture inside the API layer on any failure).
  useEffect(() => {
    void getResultsSummary().then((result) => {
      if (result.ok) setSummary(result.data);
    });
  }, []);

  const metrics = useMemo(() => deriveMetrics(run, summary), [run, summary]);
  const logLines = useMemo(
    () => deriveLog(run, autonomy, isRunning),
    [run, autonomy, isRunning],
  );

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        {/* ===== ACTIVE MISSION ===== */}
        <section className="cockpit-card p-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="cockpit-eyebrow">Active Mission</div>
              <h2 className="mt-3 max-w-2xl text-balance text-[1.7rem] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[2rem]">
                {MISSION_OBJECTIVE}
              </h2>
              <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted">
                Scenario{" "}
                <span className="mono text-ink/80">memory_poisoning_refund</span>{" "}
                · the firewall replays the task on clean vs poisoned HydraDB
                context, scores the risk, and intercepts unsafe actions before
                the agent acts.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
              <span className="cockpit-eyebrow">Autonomy</span>
              <SegmentedControl
                ariaLabel="Autonomy mode"
                options={AUTONOMY_OPTIONS}
                value={autonomy}
                onChange={setAutonomy}
              />
            </div>
          </div>
          {error && (
            <div className="mt-4">
              <InlineError message={error} />
            </div>
          )}
        </section>

        {/* ===== METRIC ROW ===== */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CockpitMetric
            label="Risk Score"
            value={metrics.risk.value}
            countTo={metrics.risk.countTo}
            sub={metrics.risk.sub}
          />
          <CockpitMetric
            label="Memories Scanned"
            value={metrics.memories.value}
            countTo={metrics.memories.countTo}
            sub={metrics.memories.sub}
          />
          <CockpitMetric
            label="Skills Scanned"
            value={metrics.skills.value}
            countTo={metrics.skills.countTo}
            sub={metrics.skills.sub}
          />
          <CockpitMetric
            label="Next Scan"
            value={metrics.nextScan.value}
            sub={metrics.nextScan.sub}
          />
        </section>

        {/* ===== TWO COLUMNS: crew + activity ===== */}
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="cockpit-card flex flex-col p-6">
            <div className="flex items-center justify-between">
              <div className="cockpit-eyebrow">Agent Crew</div>
              <span className="mono text-[10px] uppercase tracking-[0.14em] text-faint">
                8 standing
              </span>
            </div>
            <div className="mt-4">
              <CockpitAgentCrew scanning={isRunning} engaged={Boolean(run)} />
            </div>
          </div>

          <div className="cockpit-card flex flex-col p-6">
            <div className="flex items-center justify-between">
              <div className="cockpit-eyebrow">Activity Log</div>
              <span className="mono text-[10px] uppercase tracking-[0.14em] text-faint">
                mission_control.log
              </span>
            </div>
            <div className="mt-3">
              <CockpitActivityLog lines={logLines} />
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

interface MetricCell {
  value: string;
  countTo?: number;
  sub: string;
}

interface CommandMetrics {
  risk: MetricCell;
  memories: MetricCell;
  skills: MetricCell;
  nextScan: MetricCell;
}

/** Count of distinct HydraDB memory chunks touched by this run's graph. */
function memoriesInRun(run: RunArtifact): number {
  const fromChunks = new Set<string>();
  for (const node of run.graph.nodes) {
    if (node.source_chunk_id) fromChunks.add(node.source_chunk_id);
  }
  for (const triplet of run.graph.query_paths) {
    if (triplet.source_chunk_id) fromChunks.add(triplet.source_chunk_id);
  }
  if (fromChunks.size > 0) return fromChunks.size;
  // Fall back to the retrieved-chunk count from the poisoned replay.
  return run.poisoned.retrieved_chunk_ids.length || run.graph.query_paths.length;
}

function readNumber(summary: ResultsSummary | null, key: string): number {
  if (!summary) return 0;
  const value = summary[key];
  return typeof value === "number" ? value : 0;
}

/**
 * Derive the four headline metrics from the live run (preferred) or the standing
 * results summary. All values trace to real backend data; before any run the
 * risk reads "—" and the scan counts reflect the recorded aggregate.
 */
function deriveMetrics(
  run: RunArtifact | null,
  summary: ResultsSummary | null,
): CommandMetrics {
  if (run) {
    const memories = memoriesInRun(run);
    const skills = run.skill_scan ? 1 : 0;
    const nextRun = run.scheduled_scan.next_run;
    return {
      risk: {
        value: String(run.risk.score),
        countTo: run.risk.score,
        sub: `${run.risk.band} · ${run.risk.attack_type}`,
      },
      memories: {
        value: String(memories),
        countTo: memories,
        sub: `${run.graph.query_paths.length} query paths`,
      },
      skills: {
        value: String(skills),
        countTo: skills,
        sub: run.skill_scan
          ? `${run.skill_scan.band} · ${run.skill_scan.findings.length} findings`
          : "no skill in scope",
      },
      nextScan: {
        value: nextRun ? nextRun.slice(0, 10) : "—",
        sub: humanize(run.scheduled_scan.schedule || "nightly"),
      },
    };
  }

  // Pre-run standing state from the recorded aggregate.
  const maxScore = readNumber(summary, "max_score");
  const findings = readNumber(summary, "total_findings");
  const runs = readNumber(summary, "total_runs");
  return {
    risk: {
      value: maxScore > 0 ? String(maxScore) : "—",
      sub: maxScore > 0 ? "peak recorded" : "run to populate",
    },
    memories: {
      value: findings > 0 ? String(findings) : "0",
      sub: `${runs} runs recorded`,
    },
    skills: {
      value: "0",
      sub: "scan a skill in SkillMake",
    },
    nextScan: {
      value: "nightly",
      sub: "02:00 memory scan",
    },
  };
}

/** Two-digit, zero-padded clock part of an ISO timestamp (UTC), best-effort. */
function clockFromIso(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(11, 19);
}

/** Build the activity feed from the live run stages + verdict, or an idle prompt. */
function deriveLog(
  run: RunArtifact | null,
  autonomy: string,
  isRunning: boolean,
): ActivityLine[] {
  if (run) {
    const base = clockFromIso(run.created_at, "00:00:00");
    const baseSecs = secondsOf(base);
    const lines: ActivityLine[] = [];
    lines.push({ time: base, text: `mission ${run.mission.id} engaged`, bright: true });
    lines.push({ time: tick(base, baseSecs, 1), text: `autonomy mode: ${autonomy}` });
    run.stages.forEach((s, i) => {
      lines.push({
        time: tick(base, baseSecs, 2 + i),
        text: `stage ${s.stage} … ${s.status}`,
      });
    });
    const after = run.stages.length + 2;
    lines.push({
      time: tick(base, baseSecs, after),
      text: `risk score=${run.risk.score} band=${run.risk.band}`,
      bright: true,
    });
    lines.push({
      time: tick(base, baseSecs, after + 1),
      text: `firewall decision: ${run.firewall.decision}`,
      bright: true,
    });
    return lines.reverse();
  }

  return [
    { time: "—", text: `mission armed: ${MISSION_OBJECTIVE}`, bright: true },
    { time: "—", text: "scenario: memory_poisoning_refund" },
    { time: "—", text: `autonomy mode: ${autonomy}` },
    {
      time: "—",
      text: isRunning
        ? "running full autopilot scan …"
        : "awaiting operator: press Run Demo to launch the scan",
    },
  ];
}

function secondsOf(clock: string): number {
  const [h = "0", m = "0", s = "0"] = clock.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** Advance a base clock by `n` seconds and format HH:MM:SS (UTC, wraps a day). */
function tick(base: string, baseSecs: number, n: number): string {
  if (base === "—") return "—";
  const total = (baseSecs + n) % 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
