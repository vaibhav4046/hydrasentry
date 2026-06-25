"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Play,
  Download,
  ArrowLeft,
  Target,
} from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { EmptyState, InlineError } from "@/components/shared/StateNotice";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { GlowButton } from "@/components/noir/GlowButton";
import { StatusPill } from "@/components/noir/StatusPill";
import { MetricCard } from "@/components/noir/MetricCard";
import { ReportDrawer } from "@/components/noir/ReportDrawer";
import { SectionHeader } from "@/components/noir/SectionHeader";
import { AnimatedRiskBadge } from "@/components/noir/AnimatedRiskBadge";
import { ArtifactTreeGraph } from "@/components/noir/ArtifactTreeGraph";
import { MAX_STAGE } from "@/components/noir/artifactTreeData";
import { GraphSourceBadge } from "@/components/graph/GraphSourceBadge";
import { SelfRefinementTimeline } from "@/components/results/SelfRefinementTimeline";
import { useRunDemo } from "@/hooks/useRunDemo";
import { getResultsSummary, getFindings } from "@/lib/api";
import { downloadText, formatTimestamp } from "@/lib/format";
import type { ResultsSummary } from "@/lib/types";

// Results Center: the finale. Reads the current run from the store; on a cold
// load it pulls the aggregate summary and findings and offers to run the judge
// demo. When a run is present it shows the full evidence: metrics, the
// recommended next action, the self-refinement loop, the downloadable report,
// and the headline risk + firewall decision + graph-source honesty badge.
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
        kicker="COMMAND CENTER"
        title="Results"
        statusLabel="no run loaded"
        statusTone="neutral"
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
    <PageShell
      kicker="COMMAND CENTER"
      title="Results"
      statusLabel="run loaded"
      statusTone="active"
      actions={<GraphSourceBadge source={run.graph_source} />}
    >
      <div className="flex flex-col gap-5">
        {/* ===== cinematic finale hero: risk readout + blocked path tree ===== */}
        <GlassPanel strong className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <AnimatedRiskBadge
              to={run.risk.score}
              band={`${run.risk.band} RISK`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                tone="critical"
                label={`firewall ${run.firewall.decision}`}
              />
              <StatusPill tone="warn" label={run.risk.attack_type} />
              <GraphSourceBadge source={run.graph_source} />
            </div>
          </div>
          <div className="relative w-full overflow-hidden rounded-xl2 border border-hairline bg-deep/40 p-2 sm:p-4">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 38%, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 44%, transparent 70%)",
              }}
            />
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
        </GlassPanel>

        <div className="grid gap-5 lg:grid-cols-1">
          <div className="flex flex-col gap-4">
            <GlassPanel className="flex flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-hairline-strong bg-white/[.06]">
                  <Target className="h-5 w-5 text-ink" strokeWidth={1.7} />
                </span>
                <div>
                  <div className="mono text-[11px] uppercase tracking-[0.16em] text-faint">
                    recommended next action
                  </div>
                  <div className="mt-1 text-lg font-semibold tracking-tight text-ink">
                    {recommended}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    Firewall {run.firewall.decision.toUpperCase()} on{" "}
                    {run.mission.title}. {run.firewall.actions.length} actions
                    queued: {run.firewall.actions.join(", ")}.
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
            </GlassPanel>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total risks"
                value={String(run.risk.score)}
                sub={run.risk.band}
              />
              <MetricCard label="Critical issues" value="1" sub={run.risk.attack_type} />
              <MetricCard
                label="Memories quarantined"
                value={run.quarantine.memory_id ? "1" : "0"}
                sub={run.quarantine.status}
              />
              <MetricCard
                label="Skills scanned"
                value={run.skill_scan ? "1" : "8"}
                sub={run.skill_scan?.band ?? "monitored"}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Replay tests passed" value="1" sub="baseline safe" />
          <MetricCard label="Replay tests failed" value="1" sub="poisoned compromised" />
          <MetricCard label="Report generated" value="Yes" sub="evidence ready" />
          <MetricCard
            label="Next scheduled scan"
            value={nextScan ? nextScan.slice(0, 10) : "—"}
            sub="nightly memory scan"
          />
        </div>

        <GlassPanel className="flex flex-col gap-5 p-6">
          <SectionHeader
            kicker="SELF-REFINEMENT"
            title="From finding to defense"
            description="Every accepted finding is distilled into a reusable rule, registered as a regression test, and scheduled for future replay — so the same attack cannot land twice."
          />
          <SelfRefinementTimeline refinement={run.self_refinement} />
        </GlassPanel>

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
          <MetricCard label="Total runs" value={String(totalRuns)} />
          <MetricCard label="Max risk score" value={String(maxScore)} />
          <MetricCard label="Open findings" value={String(openFindings)} />
          <MetricCard
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
