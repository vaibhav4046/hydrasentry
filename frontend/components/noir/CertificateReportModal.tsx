"use client";

/**
 * CertificateReportModal — the "final report" surface opened by a
 * "View certificate" / "View report" control. A centered, scrimmed dialog that
 * presents the Memory Integrity Certificate as a sealed document, then the
 * evidence report markdown beneath it, with a markdown download.
 *
 * This is the third MIC mount point (alongside the hero canvas and the Results
 * Center). It reuses MemoryCertificatePanel so the document is identical to the
 * other mounts, and the existing safe markdown renderer for the report body (no
 * raw HTML is ever injected).
 *
 * Reduced motion: the global MotionConfig composes the enter/exit to instant;
 * nothing is hidden behind opacity:0 once open. Escape and scrim-click close it;
 * focus is moved to the close control on open.
 */
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import { X, Download } from "lucide-react";
import { cn } from "@/lib/cn";
import { EASE_OUT_EXPO } from "@/lib/motion";
import { MemoryCertificatePanel } from "./MemoryCertificatePanel";
import { renderReportMarkdown } from "./reportMarkdown";
import type { MemoryCertificate } from "@/lib/memoryCertificate";

interface CertificateReportModalProps {
  open: boolean;
  onClose: () => void;
  certificate: MemoryCertificate;
  /** Evidence report markdown for the body (canonical demo report by default). */
  markdown: string;
  /** Optional .md download handler. */
  onDownload?: () => void;
}

export function CertificateReportModal({
  open,
  onClose,
  certificate,
  markdown,
  onDownload,
}: CertificateReportModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const blocks = useMemo(() => renderReportMarkdown(markdown), [markdown]);

  // Escape-to-close + lock body scroll while open. Focus the close control.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/72 p-4 backdrop-blur-md sm:p-8"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Memory Integrity Certificate and evidence report"
        >
          <m.div
            initial={{ opacity: 0, y: 24, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.99 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-2xl"
          >
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                "absolute -top-2 right-0 z-10 -translate-y-full rounded-lg border border-hairline-strong bg-panel/80 p-2 text-muted backdrop-blur transition",
                "hover:border-white/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
              )}
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>

            <MemoryCertificatePanel certificate={certificate} />

            {/* evidence report body */}
            <section
              className="mt-4 rounded-2xl border border-hairline bg-panel/80 p-6 backdrop-blur-xl"
              aria-label="Evidence report"
            >
              <header className="mb-4 flex items-center justify-between gap-3">
                <h4 className="cockpit-display text-[15px] font-semibold text-ink">
                  Evidence report
                </h4>
                {onDownload && (
                  <button
                    type="button"
                    onClick={onDownload}
                    className={cn(
                      "hydra-button-secondary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                    )}
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Download report.md
                  </button>
                )}
              </header>
              {blocks.length > 0 ? (
                <div className="flex max-h-[42vh] flex-col gap-3 overflow-y-auto pr-2">
                  {blocks}
                </div>
              ) : (
                <p className="mono text-sm text-faint">No report available.</p>
              )}
            </section>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
