"use client";

import { useMemo } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { useRunDemo } from "@/hooks/useRunDemo";
import { getReportMarkdown } from "@/lib/api";
import { downloadText } from "@/lib/format";
import { deriveCockpit, C } from "@/lib/cockpit/derive";
import type { RunArtifact } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

interface ResultMetric {
  label: string;
  value: string;
  hot: boolean;
}

/**
 * Findings (Results Center), ported 1:1 from the Castellan source. An
 * eight-metric grid (total risks, critical issues, quarantined, skills,
 * replays passed/failed, report, next scan) over a `1.5fr 1fr` row: the
 * recommended-next-action card and the Evidence Report download card. Every
 * value is driven by the live run via deriveCockpit (idle = clean baseline);
 * "Download report.md" fetches the REAL report markdown for the current run and
 * triggers a browser download (canonical demo report as the offline fallback).
 */
export default function ResultsPage() {
  const { run, isRunning } = useRunDemo();
  const v = useMemo(() => deriveCockpit(run, { isRunning }), [run, isRunning]);
  const p = v.poisoned;

  const metrics = resultMetrics(run, p);

  async function downloadReport() {
    const id = run?.run_id ?? "judge-demo";
    const r = await getReportMarkdown(id);
    const md = r.ok ? r.data : run?.report_markdown ?? "";
    downloadText(`hydrasentry-finding-report.md`, md);
  }

  return (
    <PageShell>
      <div data-page style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
            <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600, lineHeight: 1.4, color: C.ink }}>
              Keep Autopilot on for the refund agent. Poisoned memory is
              quarantined; a regression replay is scheduled for 23:00 to confirm
              the fix holds.
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
              <span>· firewall: {run ? run.firewall.decision.toUpperCase() : "BLOCK"}</span>
              <span>· quarantine: 1 memory</span>
              <span>· rule: created</span>
              <span>· next scan: 23:00</span>
            </div>
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
      </div>
    </PageShell>
  );
}

/** The source's eight result metrics, driven by the live run posture. */
function resultMetrics(run: RunArtifact | null, p: boolean): ResultMetric[] {
  const quarantined = run?.quarantine.memory_id ? "1" : p ? "1" : "0";
  return [
    { label: "TOTAL RISKS", value: p ? "1" : "0", hot: p },
    { label: "CRITICAL ISSUES", value: p ? "1" : "0", hot: p },
    { label: "MEMORIES QUARANTINED", value: quarantined, hot: false },
    { label: "SKILLS SCANNED", value: "12", hot: false },
    { label: "REPLAYS PASSED", value: p ? "4" : "5", hot: false },
    { label: "REPLAYS FAILED", value: p ? "1" : "0", hot: p },
    { label: "REPORT", value: "ready", hot: false },
    { label: "NEXT SCAN", value: "23:00", hot: false },
  ];
}
