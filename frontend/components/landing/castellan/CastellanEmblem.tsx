/**
 * HydraSentry emblem + wordmark lockup for the homepage nav/footer. Matches the
 * reference renders (hero2/hero3.png): a small circular "memory node" emblem, a
 * bright core dot inside a faint orbit ring with a tick, next to the wordmark
 * where "Hydra" is muted silver and "Sentry" is white. Pure vector, monochrome
 * (silver/white only), sharp at any size. The source's CASTELLAN dot-mark is
 * reinterpreted as the HydraSentry emblem the reference renders show.
 */
interface CastellanEmblemProps {
  /** Pixel size of the round emblem; the wordmark scales alongside it. */
  size?: number;
  /** Hide the wordmark to render the emblem alone (tight spots). */
  markOnly?: boolean;
}

export function CastellanEmblem({
  size = 26,
  markOnly = false,
}: CastellanEmblemProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "9px",
        lineHeight: 1,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        role="img"
        aria-label="HydraSentry"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* faint orbit ring */}
        <circle
          cx="14"
          cy="14"
          r="11.5"
          fill="none"
          stroke="rgba(174,182,194,0.45)"
          strokeWidth="1"
        />
        {/* tilted inner ellipse, the "memory orbit" */}
        <ellipse
          cx="14"
          cy="14"
          rx="11"
          ry="4.4"
          fill="none"
          stroke="rgba(174,182,194,0.4)"
          strokeWidth="1"
          transform="rotate(-32 14 14)"
        />
        {/* bright core node */}
        <circle cx="14" cy="14" r="3" fill="#fff" />
        <circle cx="14" cy="14" r="5.2" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      </svg>
      {!markOnly && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            fontSize: "16.5px",
            letterSpacing: "-0.01em",
          }}
        >
          <span style={{ fontWeight: 500, color: "#AEB6C2" }}>Hydra</span>
          <span style={{ fontWeight: 700, color: "#fff" }}>Sentry</span>
        </span>
      )}
    </span>
  );
}
