/**
 * Observatory background — the void of deep space. Deliberately restrained (the
 * "one light source" rule): a near-black vertical gradient, a faint equatorial
 * coordinate grid masked toward the upper centre, and a bottom vignette. No
 * conic radar sweep, no glowing blob, no drifting particles — all celestial
 * motion lives inside the star-chart canvas, so this layer is static, cheap, and
 * lets the chart and the type carry the page. Fixed, full-bleed, aria-hidden,
 * z-0; the page content sits above it.
 */
export function ObservatoryBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background:
          "radial-gradient(1100px 720px at 62% -4%, rgba(234,240,250,0.05), transparent 58%), linear-gradient(180deg,#06070a,#020304 72%)",
      }}
    >
      {/* faint equatorial coordinate grid, masked toward the upper-right plate */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(234,240,250,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(234,240,250,0.018) 1px,transparent 1px)",
          backgroundSize: "78px 78px",
          maskImage:
            "radial-gradient(1000px 760px at 64% 12%, #000 24%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(1000px 760px at 64% 12%, #000 24%, transparent 78%)",
        }}
      />
      {/* a single faint meridian arc sweeping the upper field */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <circle
          cx="1040"
          cy="120"
          r="640"
          fill="none"
          stroke="rgba(234,240,250,0.035)"
          strokeWidth="1"
        />
        <circle
          cx="1040"
          cy="120"
          r="480"
          fill="none"
          stroke="rgba(234,240,250,0.028)"
          strokeWidth="1"
        />
      </svg>
      {/* bottom vignette so foreground type keeps contrast */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(70% 56% at 60% 2%, transparent 54%, rgba(2,3,4,0.74) 100%)",
        }}
      />
    </div>
  );
}
