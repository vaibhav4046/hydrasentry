/**
 * Small presentation helpers shared across dashboard pages: number/percent/date
 * formatting and a browser file download for report markdown (Blob + anchor).
 */

/** Render a 0..1 confidence (or already-percentage) as a whole-percent string. */
export function formatPercent(value: number): string {
  const pct = value <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

/** Format an ISO timestamp as a compact, locale-stable UTC string. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "·";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

/** Trigger a client-side download of text content as a file. */
export function downloadText(
  filename: string,
  content: string,
  mime = "text/markdown",
): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Title-case a snake_case or kebab-case identifier for display. */
export function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
