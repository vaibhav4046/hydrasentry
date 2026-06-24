"use client";

import { useMemo } from "react";
import { AnimatePresence, m } from "framer-motion";
import { X, Download } from "lucide-react";
import { GlowButton } from "./GlowButton";
import { cn } from "@/lib/cn";

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
 * renderer (headings, bold, code, lists, hr, paragraphs) — no raw HTML is ever
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
  const blocks = useMemo(() => renderMarkdown(markdown), [markdown]);

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

interface InlineProps {
  text: string;
}

/** Render inline bold (**x**) and code (`x`) spans safely as React nodes. */
function Inline({ text }: InlineProps) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="mono rounded bg-white/[.07] px-1.5 py-0.5 text-[0.85em] text-ink"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** Minimal block-level markdown to React. Intentionally small + safe. */
function renderMarkdown(md: string): React.ReactNode[] {
  if (!md) return [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length === 0) return;
    const items = [...list];
    out.push(
      <ul
        key={`ul-${key++}`}
        className="ml-5 list-disc space-y-1 text-[13.5px] leading-relaxed text-muted"
      >
        {items.map((item, i) => (
          <li key={i}>
            <Inline text={item} />
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushList();
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flushList();
      out.push(<hr key={`hr-${key++}`} className="border-hairline" />);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const content = heading[2];
      const sizes = [
        "text-xl font-semibold text-ink",
        "text-lg font-semibold text-ink",
        "text-base font-semibold text-ink",
        "text-sm font-semibold text-ink",
      ];
      out.push(
        <p key={`h-${key++}`} className={cn("mt-2", sizes[level - 1])}>
          <Inline text={content} />
        </p>,
      );
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      list.push(li[1]);
      continue;
    }
    flushList();
    out.push(
      <p key={`p-${key++}`} className="text-[13.5px] leading-relaxed text-muted">
        <Inline text={line} />
      </p>,
    );
  }
  flushList();
  return out;
}
