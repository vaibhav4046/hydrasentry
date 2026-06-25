"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2, Play, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { InlineError, EmptyState } from "@/components/shared/StateNotice";
import { ScenarioPicker } from "@/components/shared/ScenarioPicker";
import { StageTimeline } from "@/components/shared/StageTimeline";
import { ReplayCard } from "@/components/replay/ReplayCard";
import {
  CockpitCard,
  CockpitPill,
  CockpitSectionLabel,
} from "@/components/shell/CockpitCard";
import { GlowButton } from "@/components/noir/GlowButton";
import { ArtifactTreeGraph } from "@/components/noir/ArtifactTreeGraph";
import { MAX_STAGE } from "@/components/noir/artifactTreeData";
import { runScenario, runJudgeDemo } from "@/lib/api";
import { useDemoStore } from "@/store/useDemoStore";
import { formatPercent } from "@/lib/format";
import type { RunArtifact } from "@/lib/types";

const REFUND_SCENARIO = "memory_poisoning_refund";

// Replay. Picks a scenario, runs it, and shows the clean baseline answer beside
// the poisoned answer with an animated swap. The behavior diff, risk readout,
// attack type, confidence and pipeline timeline all read from the live run
// artifact. The refund scenario routes through the judge demo so the canon
// VIP-instant-refund attack always lands. Reskinned to the flat-cockpit system.
export default function ReplayPage() {
  const setRun = useDemoStore((s) => s.setRun);
  const storeRun = useDemoStore((s) => s.currentRun);
  const [scenarioId, setScenarioId] = useState(REFUND_SCENARIO);
  const [artifact, setArtifact] = useState<RunArtifact | null>(
    storeRun?.scenario_id === REFUND_SCENARIO ? storeRun : null,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setError(null);
    setIsRunning(true);
    const result =
      scenarioId === REFUND_SCENARIO
        ? await runJudgeDemo()
        : await runScenario(scenarioId);
    setIsRunning(false);
    if (result.ok) {
      setArtifact(result.data);
      setRun(result.data);
      return;
    }
    setError(result.error);
  }

  const indicators = artifact?.behavior_diff.indicators ?? [];

  return (
    <PageShell>
      <div className="flex flex-col gap-5">
        {/* ===== scenario picker + run ===== */}
        <CockpitCard className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex w-full max-w-md flex-col gap-2">
            <span className="cockpit-eyebrow">scenario</span>
            <ScenarioPicker
              value={scenarioId}
              onChange={(id) => setScenarioId(id)}
            />
          </label>
          <GlowButton
            variant="primary"
            onClick={() => void handleRun()}
            disabled={isRunning}
            iconLeft={
              isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
              ) : (
                <Play className="h-4 w-4" strokeWidth={1.9} />
              )
            }
          >
            {isRunning ? "Replaying" : "Run replay"}
          </GlowButton>
        </CockpitCard>

        {!artifact ? (
          <>
            <EmptyState
              title="No replay yet"
              description="Run a replay to compare how the agent answers on clean context versus poisoned context, side by side."
            />
            {error && <InlineError message={error} />}
          </>
        ) : (
          <>
            {error && <InlineError message={error} />}
            {/* baseline vs poisoned */}
            <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
              <AnimatePresence mode="wait">
                <ReplayCard
                  key={`baseline-${artifact.run_id}`}
                  variant="baseline"
                  result={artifact.baseline}
                />
              </AnimatePresence>
              <div className="hidden items-center justify-center lg:flex">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-hairline-strong bg-white/[.05]">
                  <ArrowRight className="h-5 w-5 text-muted" strokeWidth={1.8} />
                </span>
              </div>
              <AnimatePresence mode="wait">
                <ReplayCard
                  key={`poisoned-${artifact.run_id}`}
                  variant="poisoned"
                  result={artifact.poisoned}
                />
              </AnimatePresence>
            </div>

            <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
              {/* risk readout — cockpit big number + path tree */}
              <CockpitCard className="flex w-full flex-col gap-4 p-6 lg:max-w-sm">
                <div>
                  <div className="cockpit-eyebrow">Risk Score</div>
                  <div className="mt-3 text-[2.6rem] font-semibold leading-none tracking-tight text-ink tabular-nums">
                    {artifact.risk.score}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CockpitPill dot tone="bright" label={artifact.risk.band} />
                  <CockpitPill label={artifact.risk.attack_type} />
                  <CockpitPill
                    label={`conf ${formatPercent(artifact.risk.confidence)}`}
                  />
                </div>
                <div className="relative w-full overflow-hidden rounded-lg border border-hairline bg-deep/40 p-1.5">
                  <ArtifactTreeGraph
                    stage={MAX_STAGE}
                    graph={artifact.graph}
                    className="mx-auto max-w-[360px]"
                  />
                </div>
                <p className="mono text-center text-[10.5px] leading-relaxed text-faint">
                  How the poison reached the agent: tainted memory overrides the
                  refund policy on the white-hot path.
                </p>
              </CockpitCard>

              <div className="grid gap-4 sm:grid-cols-2">
                <CockpitCard className="flex flex-col gap-3 p-5">
                  <CockpitSectionLabel>Behavior Diff</CockpitSectionLabel>
                  <ul className="flex flex-col gap-2">
                    {indicators.map((indicator, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-[13px] leading-relaxed text-muted"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                        <span className="text-ink/85">{indicator}</span>
                      </li>
                    ))}
                  </ul>
                </CockpitCard>

                <CockpitCard className="flex flex-col gap-3 p-5">
                  <CockpitSectionLabel>Stage Timeline</CockpitSectionLabel>
                  <StageTimeline stages={artifact.stages} />
                </CockpitCard>
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
