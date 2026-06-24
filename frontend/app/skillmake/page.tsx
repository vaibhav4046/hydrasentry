"use client";

import { useState } from "react";
import {
  Loader2,
  ScanLine,
  FlaskConical,
  Check,
  X,
  ShieldOff,
  FileText,
} from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { InlineError } from "@/components/shared/StateNotice";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { GlowButton } from "@/components/noir/GlowButton";
import { StatusPill, type StatusTone } from "@/components/noir/StatusPill";
import { RiskGauge } from "@/components/noir/RiskGauge";
import { ReportDrawer } from "@/components/noir/ReportDrawer";
import { SectionHeader } from "@/components/noir/SectionHeader";
import { UNSAFE_DEMO_SKILL } from "@/components/skillmake/demoSkill";
import { scanSkill } from "@/lib/api";
import { downloadText } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { SkillScan } from "@/lib/types";

type Disposition = "approved" | "rejected" | "quarantined" | null;

// SkillMake Verifier. Paste a SKILL.md (or load the known unsafe demo) and scan
// it for unsafe instructions. The scan returns a hash, risk score/band, and
// per-line findings with category and severity. Operators can approve, reject,
// or quarantine; the demo skill comes back CRITICAL and quarantine is the
// hazard action.
export default function SkillMakePage() {
  const [content, setContent] = useState("");
  const [scan, setScan] = useState<SkillScan | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disposition, setDisposition] = useState<Disposition>(null);
  const [reportOpen, setReportOpen] = useState(false);

  async function handleScan() {
    setError(null);
    setDisposition(null);
    setIsScanning(true);
    const result = await scanSkill(content);
    setIsScanning(false);
    if (result.ok) {
      setScan(result.data);
      return;
    }
    setError(result.error);
  }

  function loadDemo() {
    setContent(UNSAFE_DEMO_SKILL);
    setScan(null);
    setDisposition(null);
  }

  const reportMarkdown = scan ? buildReport(scan) : "";

  return (
    <PageShell
      kicker="SKILLMAKE VERIFIER"
      title="Skill Scanner"
      statusLabel={scan ? `${scan.band} risk` : "ready"}
      statusTone={scan ? bandTone(scan.band) : "neutral"}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <GlassPanel className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <SectionHeader kicker="INPUT" title="SKILL.md" />
            <GlowButton variant="ghost" size="sm" onClick={loadDemo}>
              <FlaskConical className="h-4 w-4" strokeWidth={1.8} />
              Load unsafe demo skill
            </GlowButton>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            placeholder="Paste SKILL.md frontmatter and body here..."
            className={cn(
              "mono h-[360px] w-full resize-none rounded-xl border border-hairline-strong bg-black/35 p-4 text-[12.5px] leading-relaxed text-ink",
              "outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-white/60",
            )}
          />
          <div className="flex items-center justify-between gap-3">
            <GlowButton
              variant="primary"
              onClick={() => void handleScan()}
              disabled={isScanning || content.trim().length === 0}
              iconLeft={
                isScanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                ) : (
                  <ScanLine className="h-4 w-4" strokeWidth={1.9} />
                )
              }
            >
              {isScanning ? "Scanning" : "Scan skill"}
            </GlowButton>
            {scan && (
              <span className="mono text-[11px] text-faint">
                hash {scan.skill_hash}
              </span>
            )}
          </div>
          {error && <InlineError message={error} />}
        </GlassPanel>

        <div className="flex flex-col gap-4">
          {!scan ? (
            <GlassPanel className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
              <ScanLine className="h-7 w-7 text-faint" strokeWidth={1.5} />
              <p className="max-w-xs text-sm leading-relaxed text-muted">
                Scan a skill to see its risk score, band, and the exact unsafe
                instructions with line numbers, category, and severity.
              </p>
            </GlassPanel>
          ) : (
            <>
              <GlassPanel className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center sm:gap-6">
                <RiskGauge
                  score={scan.risk_score}
                  band={scan.band}
                  size={170}
                  label="SKILL RISK"
                />
                <div className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={bandTone(scan.band)} label={scan.band} />
                    <StatusPill tone="neutral" label={`status ${scan.status}`} />
                  </div>
                  <div>
                    <div className="mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
                      recommended fix
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">
                      {scan.recommended_fix}
                    </p>
                  </div>
                </div>
              </GlassPanel>

              <GlassPanel className="flex flex-col gap-3 p-5">
                <div className="mono text-[11px] uppercase tracking-[0.16em] text-faint">
                  unsafe instructions ({scan.findings.length})
                </div>
                <ul className="flex flex-col gap-2">
                  {scan.findings.map((finding, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-lg border-l-2 border-l-white/70 bg-white/[.04] px-3 py-2"
                    >
                      <span className="mono mt-0.5 shrink-0 rounded border border-hairline px-1.5 py-0.5 text-[10px] text-muted">
                        L{finding.line_no}
                      </span>
                      <div className="min-w-0">
                        <p className="mono text-[12px] leading-relaxed text-ink/85">
                          {finding.text}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="mono text-[10px] uppercase tracking-[0.12em] text-faint">
                            {finding.category}
                          </span>
                          <span className="mono text-[10px] uppercase tracking-[0.12em] text-ink">
                            {finding.severity}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </GlassPanel>

              <GlassPanel className="flex flex-wrap items-center gap-3 p-5">
                <GlowButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setDisposition("approved")}
                  iconLeft={<Check className="h-4 w-4" strokeWidth={1.8} />}
                >
                  Approve
                </GlowButton>
                <GlowButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setDisposition("rejected")}
                  iconLeft={<X className="h-4 w-4" strokeWidth={1.8} />}
                >
                  Reject
                </GlowButton>
                <GlowButton
                  variant="danger"
                  size="sm"
                  onClick={() => setDisposition("quarantined")}
                  iconLeft={<ShieldOff className="h-4 w-4" strokeWidth={1.8} />}
                >
                  Quarantine
                </GlowButton>
                <GlowButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setReportOpen(true)}
                  iconLeft={<FileText className="h-4 w-4" strokeWidth={1.8} />}
                >
                  View report
                </GlowButton>
                {disposition && (
                  <span className="mono ml-auto text-[12px] text-ink">
                    skill {disposition}
                  </span>
                )}
              </GlassPanel>
            </>
          )}
        </div>
      </div>

      <ReportDrawer
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        markdown={reportMarkdown}
        title="Skill Scan Report"
        onDownload={() =>
          downloadText(`skill-scan-${scan?.skill_hash ?? "report"}.md`, reportMarkdown)
        }
      />
    </PageShell>
  );
}

function bandTone(band: string): StatusTone {
  if (band === "CRITICAL") return "critical";
  if (band === "HIGH") return "warn";
  if (band === "MEDIUM") return "safe";
  return "neutral";
}

// Compose a small markdown report from a skill scan for the drawer + download.
function buildReport(scan: SkillScan): string {
  const findings = scan.findings
    .map(
      (f) =>
        `- **L${f.line_no}** (${f.category} / ${f.severity}): ${f.text}`,
    )
    .join("\n");
  return [
    `# SkillMake Scan Report`,
    ``,
    `**Skill:** ${scan.name}`,
    `**Hash:** \`${scan.skill_hash}\``,
    `**Risk score:** ${scan.risk_score}/100 (${scan.band})`,
    `**Status:** ${scan.status}`,
    ``,
    `## Unsafe instructions`,
    findings || "- none",
    ``,
    `## Recommended fix`,
    scan.recommended_fix,
  ].join("\n");
}
