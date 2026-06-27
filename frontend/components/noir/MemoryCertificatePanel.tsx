"use client";

/**
 * MemoryCertificatePanel — the signed-document artifact for a Memory Integrity
 * Certificate (MIC). A premium, monochrome, sealed-document surface: a wax-seal
 * glyph, an embossed title, a two-column field ledger, a perforation hairline,
 * and a signature line. Danger reads as intensity (brighter ink, heavier glow)
 * on the Risk Score / Decision rows, never as hue.
 *
 * Reused in three places (see the brief): the hero product canvas / certificate
 * anchor, the Results Center, and the report modal. The exact field record comes
 * from lib/memoryCertificate (single source of truth) so all three render the
 * identical document. A `derived` certificate surfaces an honest "derived /
 * demo" provenance note rather than ever claiming a real HydraDB query path.
 *
 * Reduced motion: the seal ring and glow are static; no field is hidden behind
 * opacity:0 and no text is gradient-clipped (solid ink throughout), so the whole
 * document is fully legible without motion.
 */
import type { ReactNode } from "react";
import { m } from "framer-motion";
import { ShieldCheck, FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import { EASE_OUT_EXPO } from "@/lib/motion";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
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

export function MemoryCertificatePanel({
  certificate,
  compact = false,
  action,
  className,
}: MemoryCertificatePanelProps) {
  // Hydration-safe: the Seal below renders a pulsing ring element only when motion
  // is allowed, so the raw useReducedMotion() (false on the server, true on the
  // client's first render under Reduced Motion) made the SSR and client markup
  // differ in element presence and threw React hydration error #418. The safe hook
  // emits the same value (false) on the server and first client render, then
  // settles to the live preference on the next commit.
  const prefersReduced = useReducedMotionSafe();
  const rows = certificateRows(certificate);

  return (
    <m.article
      initial={prefersReduced ? false : { opacity: 0, y: 18, filter: "blur(8px)" }}
      whileInView={prefersReduced ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
      aria-label="Memory Integrity Certificate"
      className={cn(
        "relative overflow-hidden rounded-2xl",
        compact ? "p-6" : "p-7 sm:p-9",
        className,
      )}
      style={{
        background:
          "linear-gradient(165deg, rgba(17,20,26,0.92), rgba(8,10,13,0.96))",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow:
          "0 40px 120px -40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.02)",
      }}
    >
      {/* engraved double border, the classic certificate frame */}
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-xl"
        style={{
          inset: compact ? 10 : 14,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      />
      {/* faint guilloché wash so the surface reads as printed stock */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background:
            "radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.05), transparent 45%), radial-gradient(90% 80% at 0% 100%, rgba(255,255,255,0.035), transparent 50%)",
        }}
      />

      <div className="relative">
        {/* ---- masthead: seal + title ---- */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="mono text-[10px] uppercase tracking-[0.32em] text-faint">
              HydraSentry · Verified Artifact
            </span>
            <h3
              className={cn(
                "cockpit-display font-semibold leading-tight text-ink",
                compact ? "text-[19px]" : "text-[clamp(22px,2.4vw,30px)]",
              )}
            >
              Memory Integrity Certificate
            </h3>
            <span className="mono text-[11px] tracking-[0.14em] text-muted">
              {certificate.certificateId}
            </span>
          </div>

          <Seal reduced={Boolean(prefersReduced)} compact={compact} />
        </header>

        {/* perforation hairline */}
        <div
          aria-hidden
          className="my-6"
          style={{
            height: 1,
            background:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 6px, transparent 6px 12px)",
          }}
        />

        {/* ---- field ledger ---- */}
        <dl
          className={cn(
            "grid gap-x-8 gap-y-0 sm:grid-cols-2",
            compact && "gap-x-6",
          )}
        >
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-2.5"
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
          <div className="flex flex-col gap-1">
            <span
              className="block w-44 border-b border-white/30 pb-1"
              aria-hidden
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
    </m.article>
  );
}

/** The wax-seal glyph: concentric rings + shield, soft white glow. */
function Seal({ reduced, compact }: { reduced: boolean; compact: boolean }) {
  const size = compact ? 56 : 68;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {!reduced && (
        <m.span
          className="absolute inset-0 rounded-full"
          style={{ border: "1px solid rgba(255,255,255,0.28)" }}
          animate={{ opacity: [0.3, 0.65, 0.3], scale: [1, 1.08, 1] }}
          transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity }}
        />
      )}
      <span
        className="absolute inset-[3px] rounded-full"
        style={{
          border: "1px solid rgba(255,255,255,0.45)",
          boxShadow:
            "0 0 28px rgba(255,255,255,0.24), inset 0 0 14px rgba(255,255,255,0.12)",
          background:
            "radial-gradient(circle at 50% 38%, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 70%)",
        }}
      />
      <span className="absolute inset-0 grid place-items-center">
        <ShieldCheck
          className="text-ink"
          style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.4))" }}
          width={compact ? 22 : 26}
          height={compact ? 22 : 26}
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
