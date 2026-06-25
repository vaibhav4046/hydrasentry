import { cn } from "@/lib/cn";

/**
 * Public variant API. `full`/`compact` are the canonical names; the legacy
 * `wordmark`/`mark` aliases are kept so existing call sites keep working.
 *   full | wordmark  -> the complete "CONSTELLAN" logotype
 *   compact | mark   -> the "HS" monogram lockup (icon rail / tight spots)
 */
type LogoVariant = "full" | "compact" | "wordmark" | "mark";

interface MonochromeLogoProps {
  variant?: LogoVariant;
  className?: string;
  /** Pixel height of the rendered mark; width scales to the lockup aspect. */
  height?: number;
}

// Monochrome law (no hue): white ink, silver, near-black. Pulled from the same
// tokens as globals.css so the mark sits correctly on the noir surface.
const INK = "#F5F7FA"; // primary white
const SILVER = "#9CA3AF"; // muted silver
const HAIR = "rgba(156,163,175,0.55)"; // hairline silver (the "connecting" stroke)

// Deterministic geometry per variant. textLength locks the glyph run width so
// the node-dot + hairline underline align identically on every platform/font —
// the lockup is razor-sharp at nav (~20px) through 4K because it is pure vector.
const FULL = { vw: 232, vh: 32, aspect: 232 / 32 };
const COMPACT = { vw: 60, vh: 32, aspect: 60 / 32 };

/**
 * Constellan brand logotype — a sleek, intentional monochrome wordmark.
 *
 * Treatment: all-caps, tight optical tracking, two-tone weight — "HYDRA" set in
 * silver at a lighter weight, "SENTRY" in white at a heavier weight, so the eye
 * lands on the security half of the name. One graph-identity detail, kept
 * minimal and crisp: a hairline "connecting" underline runs beneath HYDRA into a
 * single white node-dot at the HYDRA|SENTRY seam — a node + edge echoing the
 * context graph the product secures. Restraint over flash; sharp at any size.
 */
export function MonochromeLogo({
  variant = "full",
  className,
  height = 32,
}: MonochromeLogoProps) {
  const compact = variant === "compact" || variant === "mark";
  const cfg = compact ? COMPACT : FULL;
  const width = Math.round(cfg.aspect * height);

  return (
    <svg
      viewBox={`0 0 ${cfg.vw} ${cfg.vh}`}
      width={width}
      height={height}
      role="img"
      aria-label="Constellan"
      className={cn("block select-none overflow-visible", className)}
      shapeRendering="geometricPrecision"
      style={{
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {compact ? <CompactLockup /> : <FullLockup />}
    </svg>
  );
}

// ---- full logotype ----------------------------------------------------------
function FullLockup() {
  // Baseline + metrics tuned to FULL.vh = 32. The two text runs are positioned
  // so SENTRY begins exactly where HYDRA's locked textLength ends.
  const baseY = 22;
  const hydraX = 2;
  const hydraLen = 104; // locked render width of "HYDRA"
  const seamX = hydraX + hydraLen; // node-dot + SENTRY start
  return (
    <g>
      {/* hairline "edge" beneath HYDRA — the graph connector */}
      <line
        x1={hydraX + 1}
        y1={27.5}
        x2={seamX - 4}
        y2={27.5}
        stroke={HAIR}
        strokeWidth={1}
        strokeLinecap="round"
      />
      {/* HYDRA — silver, lighter weight, tight tracking */}
      <text
        x={hydraX}
        y={baseY}
        textLength={hydraLen}
        lengthAdjust="spacingAndGlyphs"
        fill={SILVER}
        fontSize={23}
        fontWeight={500}
        letterSpacing="0.5"
        style={{ fontVariantLigatures: "none" }}
      >
        HYDRA
      </text>
      {/* node-dot at the seam — the single graph glyph (white, crisp) */}
      <circle cx={seamX + 1.5} cy={25} r={2.4} fill={INK} />
      {/* SENTRY — white, heavier weight, tighter tracking */}
      <text
        x={seamX + 7}
        y={baseY}
        textLength={112}
        lengthAdjust="spacingAndGlyphs"
        fill={INK}
        fontSize={23}
        fontWeight={750}
        letterSpacing="-0.2"
        style={{ fontVariantLigatures: "none" }}
      >
        SENTRY
      </text>
    </g>
  );
}

// ---- compact monogram -------------------------------------------------------
// "HS" lockup: H silver, S white, the same node-dot bridging them. Reads as the
// wordmark's initials, not a generic glyph.
function CompactLockup() {
  return (
    <g>
      <line
        x1={3}
        y1={27}
        x2={50}
        y2={27}
        stroke={HAIR}
        strokeWidth={1}
        strokeLinecap="round"
      />
      <text
        x={2}
        y={24}
        fill={SILVER}
        fontSize={27}
        fontWeight={500}
        letterSpacing="0"
        style={{ fontVariantLigatures: "none" }}
      >
        H
      </text>
      <circle cx={27.5} cy={20} r={2.6} fill={INK} />
      <text
        x={31}
        y={24}
        fill={INK}
        fontSize={27}
        fontWeight={750}
        letterSpacing="-0.3"
        style={{ fontVariantLigatures: "none" }}
      >
        S
      </text>
    </g>
  );
}
