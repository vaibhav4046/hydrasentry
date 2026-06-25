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
import {
  CockpitCard,
  CockpitPill,
  CockpitSectionLabel,
} from "@/components/shell/CockpitCard";
import { GlowButton } from "@/components/noir/GlowButton";
import { ReportDrawer } from "@/components/noir/ReportDrawer";
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
// hazard action. Reskinned to the flat-cockpit system to match Command.
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
    <PageShell>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* ===== INPUT ===== */}
        <CockpitCard className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <CockpitSectionLabel>Input · SKILL.md</CockpitSectionLabel>
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
              "mono h-[360px] w-full resize-none rounded-lg border border-hairline bg-black/30 p-4 text-[12.5px] leading-relaxed text-ink",
              "outline-none placeholder:text-faint focus-visible:border-hairline-strong focus-visible:ring-2 focus-visible:ring-white/30",
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
        </CockpitCard>

        {/* ===== RESULT ===== */}
        <div className="flex flex-col gap-5">
          {!scan ? (
            <CockpitCard className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
              <ScanLine className="h-7 w-7 text-faint" strokeWidth={1.5} />
              <p className="max-w-xs text-sm leading-relaxed text-muted">
                Scan a skill to see its risk score, band, and the exact unsafe
                instructions with line numbers, category, and severity.
              </p>
            </CockpitCard>
          ) : (
            <>
              {/* risk readout — cockpit big-number/status */}
              <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                <CockpitCard className="flex flex-col justify-center p-5 sm:min-w-[150px]">
                  <div className="cockpit-eyebrow">Skill Risk</div>
                  <div className="mt-3 text-[2.6rem] font-semibold leading-none tracking-tight text-ink tabular-nums">
                    {scan.risk_score}
                  </div>
                  <div className="mt-3">
                    <CockpitPill
                      dot
                      tone={bandBright(scan.band) ? "bright" : "neutral"}
                      label={scan.band}
                    />
                  </div>
                </CockpitCard>
                <CockpitCard className="flex flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <CockpitPill label={`status ${scan.status}`} />
                    <CockpitPill
                      label={`${scan.findings.length} findings`}
                      tone={scan.findings.length > 0 ? "bright" : "neutral"}
                    />
                  </div>
                  <div>
                    <div className="cockpit-eyebrow">recommended fix</div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                      {scan.recommended_fix}
                    </p>
                  </div>
                </CockpitCard>
              </div>

              {/* unsafe instructions — mono lines w/ line numbers */}
              <CockpitCard className="flex flex-col gap-3 p-5">
                <CockpitSectionLabel meta={`${scan.findings.length} found`}>
                  Unsafe Instructions
                </CockpitSectionLabel>
                <ul className="flex flex-col gap-2">
                  {scan.findings.map((finding, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-lg border-l-2 border-l-white/70 bg-white/[.03] px-3 py-2"
                    >
                      <span className="mono mt-0.5 shrink-0 rounded border border-hairline px-1.5 py-0.5 text-[10px] text-muted">
                        L{finding.line_no}
                      </span>
                      <div className="min-w-0">
                        <p className="mono text-[12px] leading-relaxed text-ink/85">
                          {finding.text}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className="cockpit-eyebrow">
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
              </CockpitCard>

              {/* dispositions */}
              <CockpitCard className="flex flex-wrap items-center gap-3 p-5">
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
              </CockpitCard>
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
          downloadText(
            `skill-scan-${scan?.skill_hash ?? "report"}.md`,
            reportMarkdown,
          )
        }
      />
    </PageShell>
  );
}

/** Whether a band reads as notable/critical (brighter pill). Monochrome. */
function bandBright(band: string): boolean {
  return band === "CRITICAL" || band === "HIGH";
}

// Compose a small markdown report from a skill scan for the drawer + download.
function buildReport(scan: SkillScan): string {
  const findings = scan.findings
    .map((f) => `- **L${f.line_no}** (${f.category} / ${f.severity}): ${f.text}`)
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
