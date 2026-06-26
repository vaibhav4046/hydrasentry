"use client";

/**
 * HeroCertificateSection — MIC mount point (a): the homepage product canvas /
 * certificate anchor that the hero CTA2 "View Memory Certificate" scrolls to.
 *
 * It renders the Memory Integrity Certificate as a sealed document inline, plus
 * a "View report" control that opens the final report modal (mount point c).
 * The certificate is built from the shared single-source-of-truth record,
 * overlaid with the live run artifact when one exists (so a real backend's
 * canonical numbers win); otherwise it shows the deterministic canonical MIC.
 *
 * Honesty: when the artifact is derived/demo (not a real HydraDB query_paths
 * run), the panel surfaces a "derived scenario · demo data" note. The report
 * markdown is the run's report (canonical demo report as the offline default).
 */
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDemoStore } from "@/store/useDemoStore";
import { buildCertificate } from "@/lib/memoryCertificate";
import { getReportMarkdown } from "@/lib/api";
import { demoRun } from "@/lib/demoData";
import { downloadText } from "@/lib/format";
import { MemoryCertificatePanel } from "./MemoryCertificatePanel";
import { CertificateReportModal } from "./CertificateReportModal";

interface HeroCertificateSectionProps {
  anchorId: string;
}

export function HeroCertificateSection({ anchorId }: HeroCertificateSectionProps) {
  const run = useDemoStore((s) => s.currentRun);
  const [open, setOpen] = useState(false);

  const certificate = useMemo(() => buildCertificate(run), [run]);
  // Offline-safe report body: the live run's report markdown, or the canonical
  // demo report so the modal always has evidence content.
  const markdown = useMemo(
    () => run?.report_markdown ?? demoRun().report_markdown,
    [run],
  );

  async function downloadReport() {
    const id = run?.run_id ?? "judge-demo";
    const r = await getReportMarkdown(id);
    const md = r.ok ? r.data : markdown;
    downloadText("hydrasentry-finding-report.md", md);
  }

  return (
    <section
      id={anchorId}
      aria-labelledby={`${anchorId}-heading`}
      className="scroll-mt-24 py-16 sm:py-20"
    >
      <div className="mb-8 flex flex-col gap-3">
        <span className="mono text-[10px] uppercase tracking-[0.26em] text-faint">
          Verified Artifact · Signed Document
        </span>
        <h2
          id={`${anchorId}-heading`}
          className="obs-display max-w-[20ch] text-[clamp(26px,3.4vw,42px)] font-semibold leading-[1.04] tracking-[-0.025em] text-ink"
        >
          Every blocked attack ships a Memory Integrity Certificate.
        </h2>
        <p className="max-w-[58ch] text-[15px] leading-relaxed text-muted">
          When the firewall severs a poisoned action, HydraSentry seals the
          evidence into a portable certificate: the tainted node, the chunk it
          came from, the firewall decision, and the regression rule that keeps it
          from recurring.
        </p>
      </div>

      <MemoryCertificatePanel
        certificate={certificate}
        action={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "hydra-button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold tracking-tight",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-base",
            )}
          >
            <FileText className="h-4 w-4" strokeWidth={1.8} />
            View report
          </button>
        }
      />

      <CertificateReportModal
        open={open}
        onClose={() => setOpen(false)}
        certificate={certificate}
        markdown={markdown}
        onDownload={() => void downloadReport()}
      />
    </section>
  );
}
