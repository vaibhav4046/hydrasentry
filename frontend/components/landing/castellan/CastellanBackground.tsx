/**
 * Castellan landing noir background — ported 1:1 from the design source's fixed
 * background layer. Radial silver glows + a masked grid + a slow conic "radar"
 * sweep + two drifting particles + a bottom vignette. Pure CSS (no canvas/WebGL)
 * so it matches hero4.png exactly and costs ~nothing. Uses the hsRadar / hsDrift
 * keyframes already defined in globals.css (Castellan ambient set).
 *
 * Rendered as a fixed, full-bleed, aria-hidden layer at z-0; the page content
 * sits above it. The global NoirBackground (root layout) is masked to center and
 * sits at -z-10, so this opaque-base layer is what reads on the homepage.
 */
export function CastellanBackground() {
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
          "radial-gradient(1200px 760px at 50% -6%, rgba(220,228,240,0.07), transparent 60%), radial-gradient(900px 600px at 86% 14%, rgba(255,255,255,0.04), transparent 55%), linear-gradient(180deg,#060709,#020304 74%)",
      }}
    >
      {/* masked grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
          backgroundSize: "62px 62px",
          maskImage:
            "radial-gradient(1000px 760px at 50% 14%, #000 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(1000px 760px at 50% 14%, #000 30%, transparent 80%)",
        }}
      />
      {/* conic radar sweep */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "1100px",
          height: "1100px",
          borderRadius: "50%",
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(220,228,240,0.045) 22deg, transparent 58deg)",
          animation: "hsRadar 30s linear infinite",
          maskImage: "radial-gradient(circle, #000 0%, transparent 60%)",
          WebkitMaskImage: "radial-gradient(circle, #000 0%, transparent 60%)",
        }}
      />
      {/* drifting particles */}
      <div
        style={{
          position: "absolute",
          width: "5px",
          height: "5px",
          left: "18%",
          top: "32%",
          borderRadius: "50%",
          background: "rgba(220,228,240,0.5)",
          filter: "blur(.4px)",
          animation: "hsDrift 19s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "4px",
          height: "4px",
          left: "74%",
          top: "24%",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.45)",
          animation: "hsDrift 25s ease-in-out infinite",
        }}
      />
      {/* bottom vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(62% 52% at 50% 0%, transparent 56%, rgba(2,3,4,0.72) 100%)",
        }}
      />
    </div>
  );
}
