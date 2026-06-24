"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Radar, ArrowRight, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { InlineError } from "@/components/shared/StateNotice";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { ScenarioPicker } from "@/components/shared/ScenarioPicker";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { GlowButton } from "@/components/noir/GlowButton";
import { StatusPill } from "@/components/noir/StatusPill";
import { MetricCard } from "@/components/noir/MetricCard";
import { RiskGauge } from "@/components/noir/RiskGauge";
import { TerminalLog } from "@/components/noir/TerminalLog";
import { AgentCrew } from "@/components/noir/AgentCrew";
import { SectionHeader } from "@/components/noir/SectionHeader";
import { useRunDemo } from "@/hooks/useRunDemo";
import type { ScenarioSummary } from "@/lib/types";

const AUTONOMY_OPTIONS = [
  { value: "manual", label: "Manual", hint: "Operator confirms every action" },
  { value: "copilot", label: "Copilot", hint: "Suggests; operator approves" },
  { value: "autopilot", label: "Autopilot", hint: "Acts within policy bounds" },
];

const MISSION_OBJECTIVE =
  "Protect refund agent from poisoned memory and unsafe skills";

// Mission Control. Sets active mission, scenario and autonomy posture, then
// launches a full autopilot scan (the judge demo). The run risk, findings and
// pipeline stages flow into the gauge, metrics and activity log.
export default function MissionPage() {
  const { run, isRunning, error, trigger } = useRunDemo();
  const [scenarioId, setScenarioId] = useState("memory_poisoning_refund");
  const [scenario, setScenario] = useState<ScenarioSummary | undefined>();
  const [autonomy, setAutonomy] = useState("copilot");
  const [justRan, setJustRan] = useState(false);

  async function handleRun() {
    setJustRan(false);
    const result = await trigger();
    if (result) setJustRan(true);
  }

  const logLines = useMemo(() => {
    if (run) {
      const stageLines = run.stages.map(
        (s) => `stage ${s.stage} ... ${s.status}`,
      );
      return [
        `mission ${run.mission.id} engaged`,
        `autonomy mode: ${autonomy}`,
        ...stageLines,
        `risk score=${run.risk.score} band=${run.risk.band}`,
        `firewall decision: ${run.firewall.decision}`,
      ];
    }
    return [
      `mission armed: ${MISSION_OBJECTIVE}`,
      `scenario: ${scenarioId}`,
      `autonomy mode: ${autonomy}`,
      "awaiting operator: run full autopilot scan",
    ];
  }, [run, autonomy, scenarioId]);

  const nextScan = run?.scheduled_scan.next_run?.slice(0, 10) ?? "2026-06-25";
  const scenarioObjective =
    typeof scenario?.objective === "string" ? scenario.objective : "";

  return (
    <PageShell
      kicker="MISSION CONTROL"
      title="Active Mission"
      statusLabel={isRunning ? "scanning" : run ? "scan complete" : "armed"}
      statusTone={isRunning ? "warn" : run ? "active" : "neutral"}
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <GlassPanel strong className="flex flex-col gap-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hairline-strong bg-white/[.06]">
                  <Radar className="h-5 w-5 text-ink" strokeWidth={1.7} />
                </span>
                <div>
                  <div className="mono text-[11px] uppercase tracking-[0.18em] text-faint">
                    objective
                  </div>
                  <h2 className="mt-1 max-w-md text-xl font-semibold leading-snug tracking-tight text-ink">
                    {MISSION_OBJECTIVE}
                  </h2>
                </div>
              </div>
              <StatusPill tone="active" label="live" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="mono text-[11px] uppercase tracking-[0.16em] text-faint">
                  scenario
                </span>
                <ScenarioPicker
                  value={scenarioId}
                  onChange={(id, s) => {
                    setScenarioId(id);
                    setScenario(s);
                  }}
                />
              </label>
              <div className="flex flex-col gap-2">
                <span className="mono text-[11px] uppercase tracking-[0.16em] text-faint">
                  autonomy mode
                </span>
                <SegmentedControl
                  ariaLabel="Autonomy mode"
                  options={AUTONOMY_OPTIONS}
                  value={autonomy}
                  onChange={setAutonomy}
                />
              </div>
            </div>

            {scenarioObjective && (
              <p className="text-sm leading-relaxed text-muted">
                {scenarioObjective}
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center">
              <GlowButton
                variant="primary"
                size="lg"
                onClick={() => void handleRun()}
                disabled={isRunning}
                iconLeft={
                  isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                  ) : (
                    <Radar className="h-4 w-4" strokeWidth={1.9} />
                  )
                }
              >
                {isRunning ? "Running pipeline" : "Run Full Autopilot Scan"}
              </GlowButton>
              {justRan && run && (
                <Link href="/results" className="inline-flex">
                  <GlowButton variant="secondary" size="lg">
                    View results
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </GlowButton>
                </Link>
              )}
            </div>
            {justRan && run && (
              <div className="mono flex items-center gap-2 text-[12px] text-ink">
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                scan complete: risk {run.risk.score} ({run.risk.band}), decision{" "}
                {run.firewall.decision}
              </div>
            )}
            {error && <InlineError message={error} />}
          </GlassPanel>

          <GlassPanel className="flex flex-col items-center justify-center gap-2 p-6">
            <RiskGauge
              score={run?.risk.score ?? 0}
              band={run?.risk.band}
              size={210}
            />
            <div className="mono text-center text-[11px] text-faint">
              {run ? "latest run" : "no run yet; score will appear here"}
            </div>
          </GlassPanel>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Memories scanned" value="124" countTo={124} />
          <MetricCard label="Skills scanned" value="8" countTo={8} />
          <MetricCard
            label="Risk band"
            value={run?.risk.band ?? "n/a"}
            sub={run ? `score ${run.risk.score}/100` : "run to populate"}
          />
          <MetricCard label="Next scan" value={nextScan} sub="nightly memory scan" />
        </div>

        <GlassPanel className="flex flex-col gap-5 p-6">
          <SectionHeader
            kicker="STANDING POSTURE"
            title="Agent crew"
            description="Eight specialized agents continuously watch context integrity, replay attacks, and turn findings into regression rules."
          />
          <AgentCrew />
        </GlassPanel>

        <div>
          <div className="mono mb-3 text-[11px] uppercase tracking-[0.18em] text-faint">
            activity log
          </div>
          <TerminalLog
            title="mission_control.log"
            lines={logLines}
            replayOnView={false}
          />
        </div>
      </div>
    </PageShell>
  );
}
