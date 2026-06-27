"use client";

/**
 * MemoryCertificatePanel — the signed-document artifact for a Memory Integrity
 * Certificate (MIC). A premium, monochrome, sealed-document surface designed to
 * read like something you would frame: an engraved double frame, a guilloché
 * security wash, a microprinted rule line, an embossed wax seal, a two-column
 * field ledger with a deliberate SCALE jump on the verdict (Decision BLOCKED /
 * Risk 87 set in the display face, large, glowing), hairline rules between
 * fields, and a signature line. Danger reads as intensity (brighter ink, heavier
 * glow) on the verdict, never as hue.
 *
 * Reused in three places (see the brief): the hero product canvas / certificate
 * anchor, the Results Center, and the report modal. The exact field record comes
 * from lib/memoryCertificate (single source of truth) so all three render the
 * identical document. A `derived` certificate surfaces an honest "derived /
 * demo" provenance note rather than ever claiming a real HydraDB query path.
 *
 * BLANKING-PROOF ENTRANCE. The document is ALWAYS rendered fully opaque (no
 * opacity:0 initial). The "surface from the dark" entrance is a pure CSS
 * `@keyframes` (mic-rise) whose 100% keyframe IS the resting visible state, so
 * if animations are disabled (prefers-reduced-motion, or a headless capture that
 * never crosses an IntersectionObserver threshold) the certificate is still
 * fully legible — it simply skips the rise. This replaces the prior framer
 * whileInView entrance, which could leave the panel stuck at opacity:0 when the
 * in-view trigger did not fire. Nothing critical is ever hidden behind
 * opacity:0 and no text is gradient-clipped (solid ink throughout).
 */
import type { ReactNode } from "react";
import { ShieldCheck, FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  certificateRows,
  type MemoryCertificate,
} from "@/lib/memoryCertificate";

interface MemoryCertificatePanelProps {
  certificate: MemoryCertificate;
  /** Tighter padding/type for embedding inside the hero canvas or modal. */
  compact?: boolean;
  /** Optional action row (e.g. a "View report" / "Download" control). */
  action?: ReactNode;
  className?: string;
}

/** Rows promoted out of the ledger into the large "verdict" band at the top. */
const VERDICT_LABELS = new Set(["Risk Score", "Decision"]);

export function MemoryCertificatePanel({
  certificate,
  compact = false,
  action,
  className,
}: MemoryCertificatePanelProps) {
  const rows = certificateRows(certificate);
  const ledgerRows = rows.filter((r) => !VERDICT_LABELS.has(r.label));

  const riskValue = `${certificate.riskScore}`;
  const decision = certificate.decision;
  const isBlocked = decision.toUpperCase() === "BLOCKED";

  return (
    <article
      aria-label="Memory Integrity Certificate"
      className={cn(
        "mic-document relative overflow-hidden rounded-2xl",
        compact ? "p-6" : "p-7 sm:p-9",
        className,
      )}
      style={{
        background:
          "linear-gradient(168deg, rgba(19,22,28,0.94) 0%, rgba(11,13,17,0.96) 46%, rgba(6,8,11,0.98) 100%)",
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow:
          "0 60px 170px -50px rgba(0,0,0,0.9), 0 10px 30px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.02)",
      }}
    >
      {/* engraved double border, the classic certificate frame */}
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-xl"
        style={{
          inset: compact ? 9 : 13,
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      />
      {/* inner hairline, a second thin rule for the engraved-plate read */}
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-[10px]"
        style={{
          inset: compact ? 13 : 17,
          border: "1px solid rgba(255,255,255,0.045)",
        }}
      />
      {/* guilloché / printed-stock security wash + a faint top sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.55,
          background:
            "radial-gradient(130% 90% at 100% -4%, rgba(255,255,255,0.06), transparent 46%), radial-gradient(90% 80% at -6% 104%, rgba(255,255,255,0.04), transparent 52%)",
        }}
      />
      {/* a single bright specular line skimming the top edge (the lit lip) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.40), transparent)",
        }}
      />

      <div className="relative">
        {/* ---- masthead: seal + title ---- */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="mono text-[10px] uppercase tracking-[0.34em] text-faint">
              HydraSentry · Verified Artifact
            </span>
            <h3
              className={cn(
                "cockpit-display font-semibold leading-[1.04] text-ink",
                compact ? "text-[19px]" : "text-[clamp(22px,2.4vw,31px)]",
              )}
            >
              Memory Integrity Certificate
            </h3>
            <span className="mono text-[11px] tracking-[0.16em] text-muted">
              {certificate.certificateId}
            </span>
          </div>

          <Seal compact={compact} />
        </header>

        {/* microprint rule: a repeating-caps hairline that reads as security
            microtext from a distance and as a label up close. */}
        <div
          aria-hidden
          className="mono mic-microprint mt-6 select-none overflow-hidden whitespace-nowrap text-[6px] uppercase leading-none tracking-[0.5em] text-white/[0.14]"
        >
          {"HYDRASENTRY · MEMORY INTEGRITY · MCP FIREWALL · ".repeat(8)}
        </div>

        {/* ---- VERDICT band: the SCALE jump. Decision + Risk set large in the
            display face, glowing when the finding is a block. This is the line a
            judge photographs. ---- */}
        <div
          className="mt-5 grid grid-cols-[1.4fr_1fr] gap-4 rounded-xl border border-white/10 px-5 py-4"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex flex-col gap-1.5">
            <span className="mono text-[9.5px] uppercase tracking-[0.22em] text-faint">
              Firewall Decision
            </span>
            <span
              className={cn(
                "cockpit-display font-semibold leading-none",
                compact ? "text-[26px]" : "text-[clamp(28px,3vw,40px)]",
                isBlocked ? "text-ink" : "text-silver",
              )}
              style={
                isBlocked
                  ? { textShadow: "0 0 26px rgba(255,255,255,0.45)" }
                  : undefined
              }
            >
              {decision}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1.5 border-l border-white/[0.08] pl-4">
            <span className="mono text-[9.5px] uppercase tracking-[0.22em] text-faint">
              Risk · {certificate.riskBand}
            </span>
            <span className="flex items-baseline gap-1">
              <span
                className={cn(
                  "cockpit-display font-semibold leading-none tabular-nums text-ink",
                  compact ? "text-[26px]" : "text-[clamp(28px,3vw,40px)]",
                )}
                style={{ textShadow: "0 0 24px rgba(255,255,255,0.4)" }}
              >
                {riskValue}
              </span>
              <span className="cockpit-display text-[15px] font-medium text-muted">
                /100
              </span>
            </span>
          </div>
        </div>

        {/* perforation hairline */}
        <div
          aria-hidden
          className="my-5"
          style={{
            height: 1,
            background:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.24) 0 5px, transparent 5px 11px)",
          }}
        />

        {/* ---- field ledger ---- */}
        <dl
          className={cn(
            "grid gap-x-8 gap-y-0 sm:grid-cols-2",
            compact && "gap-x-6",
          )}
        >
          {ledgerRows.map((r) => (
            <div
              key={r.label}
              className="mic-ledger-row flex items-center justify-between gap-4 border-b border-white/[0.06] py-2.5"
            >
              <dt className="mono text-[10px] uppercase tracking-[0.16em] text-faint">
                {r.label}
              </dt>
              <dd
                className={cn(
                  "text-right text-[13px] font-medium tabular-nums",
                  r.hot ? "text-ink" : "text-silver",
                )}
                style={
                  r.hot
                    ? { textShadow: "0 0 18px rgba(255,255,255,0.35)" }
                    : undefined
                }
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* ---- signature line ---- */}
        <footer className="mt-7 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span
              aria-hidden
              className="block w-48"
              style={{
                height: 22,
                // an "ink" signature mark: a hand-drawn-ish stroke in pure white
                background:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='22'%3E%3Cpath d='M3 15 C 18 4, 28 20, 40 12 S 62 2, 78 13 96 18, 112 8 134 4, 150 14 168 16, 177 9' fill='none' stroke='%23ffffff' stroke-width='1.4' stroke-linecap='round' opacity='0.78'/%3E%3C/svg%3E\") left center / contain no-repeat",
              }}
            />
            <span
              aria-hidden
              className="block w-48 border-b border-white/30"
            />
            <span className="mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
              MCP Firewall · Authorized Signatory
            </span>
          </div>

          <div className="flex items-center gap-3">
            {certificate.derived && (
              <span
                className="mono rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-[9.5px] uppercase tracking-[0.14em] text-muted"
                title="Demo / derived scenario graph — not a live HydraDB query_paths result."
              >
                Derived scenario · demo data
              </span>
            )}
            {action}
          </div>
        </footer>
      </div>
    </article>
  );
}

/** The wax-seal glyph: an embossed disc with a notched/scalloped rim, concentric
 *  rings, a shield, and a soft white glow. The pulse ring is a pure CSS
 *  animation (no framer initial), so it never blanks under reduced motion. */
function Seal({ compact }: { compact: boolean }) {
  const size = compact ? 58 : 72;
  const ticks = 24;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* scalloped wax rim: short radial ticks around the disc */}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.18))" }}
      >
        <g stroke="rgba(255,255,255,0.32)" strokeWidth={1.4}>
          {Array.from({ length: ticks }).map((_, i) => {
            const a = (i / ticks) * Math.PI * 2;
            const r1 = 46;
            const r2 = 49.5;
            return (
              <line
                key={i}
                x1={50 + Math.cos(a) * r1}
                y1={50 + Math.sin(a) * r1}
                x2={50 + Math.cos(a) * r2}
                y2={50 + Math.sin(a) * r2}
              />
            );
          })}
        </g>
      </svg>
      {/* slow breathing ring (CSS only) */}
      <span className="mic-seal-pulse absolute inset-[6px] rounded-full" />
      {/* the embossed disc */}
      <span
        className="absolute inset-[9px] rounded-full"
        style={{
          border: "1px solid rgba(255,255,255,0.5)",
          boxShadow:
            "0 0 30px rgba(255,255,255,0.26), inset 0 0 16px rgba(255,255,255,0.14), inset 0 2px 4px rgba(255,255,255,0.18)",
          background:
            "radial-gradient(circle at 50% 34%, rgba(255,255,255,0.20), rgba(255,255,255,0.02) 72%)",
        }}
      />
      {/* inner ring (the seal's keyline) */}
      <span
        className="absolute inset-[15px] rounded-full"
        style={{ border: "1px solid rgba(255,255,255,0.28)" }}
      />
      <span className="absolute inset-0 grid place-items-center">
        <ShieldCheck
          className="text-ink"
          style={{ filter: "drop-shadow(0 0 9px rgba(255,255,255,0.45))" }}
          width={compact ? 21 : 25}
          height={compact ? 21 : 25}
          strokeWidth={1.6}
        />
      </span>
    </div>
  );
}

/** Convenience icon for a "View report" control mounted as the panel action. */
export function ReportGlyph() {
  return <FileText className="h-4 w-4" strokeWidth={1.8} />;
}
