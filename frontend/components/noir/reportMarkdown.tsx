"use client";

/**
 * Minimal, safe markdown -> React renderer shared by ReportDrawer and the
 * CertificateReportModal. Supports headings, bold, inline code, bullet lists,
 * horizontal rules and paragraphs. No raw HTML is ever injected, so report
 * content cannot smuggle markup (XSS-safe by construction).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface InlineProps {
  text: string;
}

/** Render inline bold (**x**) and code (`x`) spans safely as React nodes. */
export function Inline({ text }: InlineProps) {
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
export function renderReportMarkdown(md: string): ReactNode[] {
  if (!md) return [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
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
