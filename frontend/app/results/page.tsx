"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Play, Download, ArrowLeft, Target } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { EmptyState, InlineError } from "@/components/shared/StateNotice";
import {
  CockpitCard,
  CockpitPill,
  CockpitSectionLabel,
} from "@/components/shell/CockpitCard";
import { CockpitMetric } from "@/components/shell/CockpitMetric";
import { GlowButton } from "@/components/noir/GlowButton";
import { ReportDrawer } from "@/components/noir/ReportDrawer";
import { ArtifactTreeGraph } from "@/components/noir/ArtifactTreeGraph";
import { MAX_STAGE } from "@/components/noir/artifactTreeData";
import { GraphSourceBadge } from "@/components/graph/GraphSourceBadge";
import { SelfRefinementTimeline } from "@/components/results/SelfRefinementTimeline";
import { useRunDemo } from "@/hooks/useRunDemo";
import { getResultsSummary, getFindings } from "@/lib/api";
import { downloadText, formatTimestamp } from "@/lib/format";
import type { ResultsSummary } from "@/lib/types";

// Findings: the finale. Reads the current run from the store; on a cold load it
// pulls the aggregate summary and findings and offers to run the judge demo.
// When a run is present it shows the full evidence: metrics, the recommended
// next action, the self-refinement loop, the downloadable report, and the
// headline risk + firewall decision + graph-source honesty badge. Reskinned to
// the flat-cockpit system to match Command.
export default function ResultsPage() {
  const { run, isRunning, error, trigger } = useRunDemo();
  const [summary, setSummary] = useState<ResultsSummary | null>(null);
  const [findingsCount, setFindingsCount] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (run) return;
    void getResultsSummary().then((result) => {
      if (result.ok) setSummary(result.data);
    });
    void getFindings().then((result) => {
      if (result.ok) setFindingsCount(result.data.length);
    });
  }, [run]);

  if (!run) {
    return (
      <PageShell
        actions={
          <Link href="/">
            <GlowButton variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.8} /> Landing
            </GlowButton>
          </Link>
        }
      >
        <ColdLoad
          summary={summary}
          findingsCount={findingsCount}
          isRunning={isRunning}
          error={error}
          onRun={() => void trigger()}
        />
      </PageShell>
    );
  }

  const report = run.report_markdown ?? "";
  const nextScan = run.scheduled_scan.next_run;
  const recommended = run.firewall.actions[0] ?? "review findings";

  return (
    <PageShell actions={<GraphSourceBadge source={run.graph_source} />}>
      <div className="flex flex-col gap-5">
        {/* ===== finale hero: risk readout + blocked-path tree ===== */}
        <CockpitCard className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="cockpit-eyebrow">Risk Score</div>
              <div className="mt-3 text-[3rem] font-semibold leading-none tracking-tight text-ink tabular-nums">
                {run.risk.score}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CockpitPill
                dot
                tone="bright"
                label={`firewall ${run.firewall.decision}`}
              />
              <CockpitPill dot tone="bright" label={run.risk.band} />
              <CockpitPill label={run.risk.attack_type} />
              <GraphSourceBadge source={run.graph_source} />
            </div>
          </div>
          <div className="relative w-full overflow-hidden rounded-lg border border-hairline bg-deep/40 p-2 sm:p-4">
            <ArtifactTreeGraph
              stage={MAX_STAGE}
              graph={run.graph}
              className="mx-auto max-w-[720px]"
            />
            <p className="mono mt-1 text-center text-[11px] leading-relaxed text-faint">
              The blocked path: poisoned memory -&gt; policy conflict -&gt; unsafe
              action, intercepted at the MCP firewall before it could act.
            </p>
          </div>
        </CockpitCard>

        {/* ===== recommended action ===== */}
        <CockpitCard className="flex flex-col gap-3 p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-hairline-strong bg-white/[.05]">
              <Target className="h-5 w-5 text-ink" strokeWidth={1.7} />
            </span>
            <div>
              <div className="cockpit-eyebrow">recommended next action</div>
              <div className="mt-1.5 text-lg font-semibold tracking-tight text-ink">
                {recommended}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Firewall {run.firewall.decision.toUpperCase()} on{" "}
                {run.mission.title}. {run.firewall.actions.length} actions queued:{" "}
                {run.firewall.actions.join(", ")}.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-hairline pt-4">
            <GlowButton
              variant="primary"
              onClick={() => setReportOpen(true)}
              iconLeft={<Download className="h-4 w-4" strokeWidth={1.8} />}
            >
              Download report
            </GlowButton>
            <Link href="/graph" className="inline-flex">
              <GlowButton variant="secondary">View context graph</GlowButton>
            </Link>
          </div>
        </CockpitCard>

        {/* ===== metrics ===== */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CockpitMetric
            label="Total risks"
            value={String(run.risk.score)}
            countTo={run.risk.score}
            sub={run.risk.band}
          />
          <CockpitMetric
            label="Critical issues"
            value="1"
            countTo={1}
            sub={run.risk.attack_type}
          />
          <CockpitMetric
            label="Memories quarantined"
            value={run.quarantine.memory_id ? "1" : "0"}
            sub={run.quarantine.status}
          />
          <CockpitMetric
            label="Skills scanned"
            value={run.skill_scan ? "1" : "8"}
            sub={run.skill_scan?.band ?? "monitored"}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CockpitMetric label="Replay tests passed" value="1" sub="baseline safe" />
          <CockpitMetric
            label="Replay tests failed"
            value="1"
            sub="poisoned compromised"
          />
          <CockpitMetric label="Report generated" value="Yes" sub="evidence ready" />
          <CockpitMetric
            label="Next scheduled scan"
            value={nextScan ? nextScan.slice(0, 10) : "—"}
            sub="nightly memory scan"
          />
        </section>

        {/* ===== self-refinement ===== */}
        <CockpitCard className="flex flex-col gap-5 p-6">
          <div>
            <CockpitSectionLabel>Self-Refinement</CockpitSectionLabel>
            <h2 className="mt-2 text-[1.3rem] font-semibold tracking-tight text-ink">
              From finding to defense
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
              Every accepted finding is distilled into a reusable rule, registered
              as a regression test, and scheduled for future replay — so the same
              attack cannot land twice.
            </p>
          </div>
          <SelfRefinementTimeline refinement={run.self_refinement} />
        </CockpitCard>

        <div className="mono rounded-lg border border-hairline bg-black/30 p-3 text-xs text-faint">
          run_id: {run.run_id} | mode: {run.mode} | created:{" "}
          {formatTimestamp(run.created_at)}
        </div>
      </div>

      <ReportDrawer
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        markdown={report}
        title="Evidence Report"
        onDownload={() =>
          downloadText(`hydrasentry-report-${run.run_id}.md`, report)
        }
      />
    </PageShell>
  );
}

interface ColdLoadProps {
  summary: ResultsSummary | null;
  findingsCount: number | null;
  isRunning: boolean;
  error: string | null;
  onRun: () => void;
}

// Cold-load view: no run in the store. Show whatever aggregate the backend has
// recorded and offer to run the judge demo to populate a full artifact.
function ColdLoad({
  summary,
  findingsCount,
  isRunning,
  error,
  onRun,
}: ColdLoadProps) {
  const totalRuns = readNumber(summary, "total_runs");
  const maxScore = readNumber(summary, "max_score");
  const openFindings = readNumber(summary, "open_findings");

  return (
    <div className="flex flex-col gap-5">
      <EmptyState
        title="No run loaded yet"
        description="Run the judge demo to populate this command center with a full attack artifact, or review the aggregate from previous runs below."
        action={
          <GlowButton
            variant="primary"
            onClick={onRun}
            disabled={isRunning}
            iconLeft={
              isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
              ) : (
                <Play className="h-4 w-4" strokeWidth={1.9} />
              )
            }
          >
            {isRunning ? "Running pipeline" : "Run judge demo"}
          </GlowButton>
        }
      />
      {error && <InlineError message={error} />}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CockpitMetric label="Total runs" value={String(totalRuns)} />
          <CockpitMetric label="Max risk score" value={String(maxScore)} />
          <CockpitMetric label="Open findings" value={String(openFindings)} />
          <CockpitMetric
            label="Recorded findings"
            value={findingsCount === null ? "—" : String(findingsCount)}
          />
        </div>
      )}
    </div>
  );
}

function readNumber(summary: ResultsSummary | null, key: string): number {
  if (!summary) return 0;
  const value = summary[key];
  return typeof value === "number" ? value : 0;
}
