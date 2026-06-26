"use client";

import { useMemo } from "react";
import { AnimatePresence, m } from "framer-motion";
import { X, Download } from "lucide-react";
import { GlowButton } from "./GlowButton";
import { cn } from "@/lib/cn";
import { renderReportMarkdown } from "./reportMarkdown";

interface ReportDrawerProps {
  open: boolean;
  onClose: () => void;
  markdown: string;
  title?: string;
  /** Optional download handler (e.g. save .md). */
  onDownload?: () => void;
  className?: string;
}

/**
 * Right-side slide-in drawer that renders an evidence report (markdown) with a
 * scrim. Uses AnimatePresence for enter/exit. Ships a minimal, safe markdown
 * renderer (headings, bold, code, lists, hr, paragraphs), no raw HTML is ever
 * injected, so report content cannot inject markup.
 */
export function ReportDrawer({
  open,
  onClose,
  markdown,
  title = "Evidence Report",
  onDownload,
  className,
}: ReportDrawerProps) {
  const blocks = useMemo(() => renderReportMarkdown(markdown), [markdown]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <m.aside
            role="dialog"
            aria-label={title}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-hairline bg-panel/95 backdrop-blur-2xl",
              className,
            )}
          >
            <header className="flex items-center justify-between gap-3 border-b border-hairline px-6 py-4">
              <h2 className="text-base font-semibold tracking-tight text-ink">
                {title}
              </h2>
              <div className="flex items-center gap-2">
                {onDownload && (
                  <GlowButton variant="ghost" size="sm" onClick={onDownload}>
                    <Download className="h-4 w-4" strokeWidth={1.8} /> Markdown
                  </GlowButton>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close report"
                  className="rounded-lg border border-hairline p-1.5 text-muted transition hover:border-hairline-strong hover:text-ink"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {blocks.length > 0 ? (
                <div className="flex flex-col gap-3">{blocks}</div>
              ) : (
                <p className="mono text-sm text-faint">No report available.</p>
              )}
            </div>
          </m.aside>
        </>
      )}
    </AnimatePresence>
  );
}
