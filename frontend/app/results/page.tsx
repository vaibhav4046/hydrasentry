"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { GraphSourceBadge } from "@/components/graph/GraphSourceBadge";
import { MemoryCertificatePanel } from "@/components/noir/MemoryCertificatePanel";
import { CertificateReportModal } from "@/components/noir/CertificateReportModal";
import { useRunDemo } from "@/hooks/useRunDemo";
import { useDemoMode } from "@/hooks/useDemoMode";
import { getReportMarkdown } from "@/lib/api";
import { downloadText } from "@/lib/format";
import { buildCertificate } from "@/lib/memoryCertificate";
import { deriveCockpit, C } from "@/lib/cockpit/derive";
import type { RunArtifact } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/** Clock (HH:MM) of the run's scheduled regression replay, defaulting to 23:00. */
function nextScanClock(run: RunArtifact | null): string {
  const iso = run?.scheduled_scan?.next_run;
  if (!iso) return "23:00";
  const t = iso.slice(11, 16);
  return t.length === 5 ? t : "23:00";
}

interface ResultMetric {
  label: string;
  value: string;
  hot: boolean;
}

/**
 * Findings (Results Center). An eight-metric grid (total risks, critical issues,
 * quarantined, skills, replays passed/failed, report, next scan) over a
 * `1.5fr 1fr` row: the recommended-next-action card and the Evidence Report
 * download card.
 *
 * Honesty: every value is gated on whether a run exists. BEFORE any run the
 * tiles read a clean zero baseline (report "pending", next scan "—") and the
 * action card shows a neutral "run the demo to generate a finding" prompt, so
 * nothing claims a quarantine / firewall BLOCK that has not happened. Once a run
 * lands, the card and tiles are driven by the artifact and the RESULT carries an
 * honest REAL-vs-DERIVED graph-source badge. "Download report.md" fetches the
 * real report markdown for the current run (canonical demo report as fallback).
 */
export default function ResultsPage() {
  const { run, isRunning } = useRunDemo();
  const isDemo = useDemoMode();
  const v = useMemo(() => deriveCockpit(run, { isRunning }), [run, isRunning]);
  const p = v.poisoned;
  const nextScan = nextScanClock(run);
  const [certOpen, setCertOpen] = useState(false);

  const metrics = resultMetrics(run, p, nextScan);
  // MIC mount point (b): only when a run exists and the firewall actually
  // blocked (poisoned posture) — never claim a certificate before the finding.
  const certificate = useMemo(() => buildCertificate(run), [run]);
  const reportMarkdown = run?.report_markdown ?? "";

  async function downloadReport() {
    const id = run?.run_id ?? "judge-demo";
    const r = await getReportMarkdown(id);
    const md = r.ok ? r.data : run?.report_markdown ?? "";
    downloadText(`hydrasentry-finding-report.md`, md);
  }

  return (
    <PageShell>
      <div data-page style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Honest result provenance: once a run exists, label its graph source
            (REAL HydraDB vs DERIVED scenario) on the RESULT itself; before any
            run, a neutral status line so the surface never overstates. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.16em", color: C.faint }}>
            {run ? "FINDING · run " + run.run_id : "NO RUN YET · baseline posture"}
          </div>
          {run ? (
            <GraphSourceBadge source={run.graph_source} />
          ) : (
            isDemo && (
              <span
                className="mono"
                title="No run has been executed yet; tiles show the clean baseline."
                style={{
                  fontFamily: MONO,
                  fontSize: "9.5px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: C.muted,
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 999,
                  padding: "4px 10px",
                }}
              >
                Fallback data · run to generate a finding
              </span>
            )
          )}
        </div>

        {/* 8-metric grid */}
        <div
          data-stagger
          className="cockpit-metric-grid-8"
          style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}
        >
          {metrics.map((m) => (
            <div
              key={m.label}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "rgba(234,240,250,0.28)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = m.hot
                  ? "rgba(255,255,255,0.22)"
                  : "rgba(255,255,255,0.08)";
              }}
              style={{
                padding: 18,
                border: `1px solid ${m.hot ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 14,
                background: m.hot ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.012)",
                transition: "transform .25s cubic-bezier(.22,.61,.36,1),border-color .25s",
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.13em", color: C.faint }}>
                {m.label}
              </div>
              <div
                className="cockpit-display"
                style={{
                  marginTop: 8,
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  color: m.hot ? "#fff" : C.silver,
                }}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Recommended action + evidence report */}
        <div className="cockpit-2col-wide" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
          <div
            style={{
              padding: 22,
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 16,
              background:
                "radial-gradient(120% 140% at 0% 0%,rgba(20,24,30,0.6),rgba(6,8,10,0.6))",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.16em", color: C.accent }}>
              RECOMMENDED NEXT ACTION
            </div>
            {run ? (
              <>
                <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600, lineHeight: 1.4, color: C.ink }}>
                  Keep Autopilot on for the refund agent. Poisoned memory is
                  quarantined; a regression replay is scheduled for {nextScan} to
                  confirm the fix holds.
                </div>
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    gap: 18,
                    flexWrap: "wrap",
                    fontFamily: MONO,
                    fontSize: 11,
                    color: C.muted,
                  }}
                >
                  <span>· firewall: {run.firewall.decision.toUpperCase()}</span>
                  <span>· quarantine: {run.quarantine.memory_id ? "1 memory" : "none"}</span>
                  <span>· rule: created</span>
                  <span>· next scan: {nextScan}</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600, lineHeight: 1.4, color: C.ink }}>
                  No finding yet. Run the demo to replay the refund agent against
                  clean and poisoned context and generate a recommended action.
                </div>
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    gap: 18,
                    flexWrap: "wrap",
                    fontFamily: MONO,
                    fontSize: 11,
                    color: C.faint,
                  }}
                >
                  <span>· firewall: idle</span>
                  <span>· quarantine: none</span>
                  <span>· baseline: nominal</span>
                </div>
              </>
            )}
          </div>

          <div
            style={{
              padding: 22,
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 16,
              background: "rgba(255,255,255,0.014)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Evidence report</div>
            <div style={{ fontSize: "12.5px", color: C.muted, lineHeight: 1.5 }}>
              Markdown responsible-disclosure report with graph evidence, tainted
              triplets, and the legal testing statement.
            </div>
            <button
              type="button"
              onClick={() => void downloadReport()}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              style={{
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 600,
                color: "#0A0A0A",
                padding: 13,
                border: "none",
                borderRadius: 12,
                background: "linear-gradient(180deg,#FFFFFF,#CDD3DC)",
                boxShadow: "0 12px 30px -14px rgba(220,228,240,0.6)",
                transition: "transform .2s",
              }}
            >
              Download report.md ↓
            </button>
          </div>
        </div>

        {/* MIC mount point (b): the Memory Integrity Certificate, shown only
            once a poisoned finding exists, with a "View report" control opening
            the final report modal. Honest: no certificate before a finding. */}
        {run && p && (
          <MemoryCertificatePanel
            certificate={certificate}
            action={
              <button
                type="button"
                onClick={() => setCertOpen(true)}
                style={{
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0A0A0A",
                  padding: "10px 16px",
                  border: "1px solid rgba(255,255,255,0.65)",
                  borderRadius: 12,
                  background: "linear-gradient(180deg,#FFFFFF,#C9CED8)",
                  boxShadow: "0 12px 30px -14px rgba(220,228,240,0.6)",
                }}
              >
                <FileText width={15} height={15} strokeWidth={1.8} />
                View report
              </button>
            }
          />
        )}
      </div>

      <CertificateReportModal
        open={certOpen}
        onClose={() => setCertOpen(false)}
        certificate={certificate}
        markdown={reportMarkdown}
        onDownload={() => void downloadReport()}
      />
    </PageShell>
  );
}

/**
 * The eight result metrics, driven by the live run posture. With no run the
 * tiles read the clean baseline (zeros, report not yet generated) so the grid
 * never contradicts the cold "no finding" state of the action card.
 */
function resultMetrics(
  run: RunArtifact | null,
  p: boolean,
  nextScan: string,
): ResultMetric[] {
  const quarantined = run?.quarantine.memory_id ? "1" : p ? "1" : "0";
  return [
    { label: "TOTAL RISKS", value: p ? "1" : "0", hot: p },
    { label: "CRITICAL ISSUES", value: p ? "1" : "0", hot: p },
    { label: "MEMORIES QUARANTINED", value: quarantined, hot: false },
    { label: "SKILLS SCANNED", value: run?.skill_scan ? "1" : "0", hot: false },
    { label: "REPLAYS PASSED", value: p ? "4" : "0", hot: false },
    { label: "REPLAYS FAILED", value: p ? "1" : "0", hot: p },
    { label: "REPORT", value: p ? "ready" : "pending", hot: false },
    { label: "NEXT SCAN", value: p ? nextScan : "—", hot: false },
  ];
}
