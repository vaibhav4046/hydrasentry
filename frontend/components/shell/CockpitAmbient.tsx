/**
 * Castellan Cockpit ambient backdrop — ported 1:1 from the standalone source.
 *
 * Layers, bottom -> top:
 *   1. layered radial + linear base gradient (cool silver-blue noir)
 *   2. faint 58px grid, radially masked toward the top-right
 *   3. a slow conic "radar" sweep (hsRadar, 38s linear)
 *   4. two blurred aurora blobs (hsAurora, 26s / 32s)
 *   5. three drifting dots (hsDrift, 22s / 29s / 35s)
 *   6. a soft top vignette
 *
 * Purely decorative (aria-hidden), absolute inside the cockpit shell (which is
 * position:relative), behind the sidebar/main. Monochrome only. All motion is
 * compositor-friendly (transform) and pauses under prefers-reduced-motion via
 * the global media query in globals.css.
 */
export function CockpitAmbient() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* 1: layered base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 720px at 80% -12%, rgba(220,228,240,0.06), transparent 60%), radial-gradient(900px 700px at 4% 112%, rgba(190,205,235,0.045), transparent 60%), linear-gradient(180deg,#070809,#020304 74%)",
        }}
      />

      {/* 2: faint grid, masked toward the upper-right */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.016) 1px,transparent 1px)",
          backgroundSize: "58px 58px",
          maskImage:
            "radial-gradient(1300px 820px at 72% 0%, #000 28%, transparent 82%)",
          WebkitMaskImage:
            "radial-gradient(1300px 820px at 72% 0%, #000 28%, transparent 82%)",
        }}
      />

      {/* 3: conic radar sweep */}
      <div
        className="absolute"
        style={{
          top: "-22%",
          right: "-8%",
          width: "920px",
          height: "920px",
          borderRadius: "50%",
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(220,228,240,0.05) 26deg, transparent 66deg)",
          animation: "hsRadar 38s linear infinite",
          maskImage: "radial-gradient(circle,#000,transparent 62%)",
          WebkitMaskImage: "radial-gradient(circle,#000,transparent 62%)",
        }}
      />

      {/* 4: two aurora blobs */}
      <div
        className="absolute"
        style={{
          left: "-12%",
          top: "34%",
          width: "640px",
          height: "640px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(150,172,214,0.07), transparent 62%)",
          filter: "blur(22px)",
          animation: "hsAurora 26s ease-in-out infinite",
        }}
      />
      <div
        className="absolute"
        style={{
          right: "14%",
          top: "60%",
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(214,224,240,0.05), transparent 60%)",
          filter: "blur(18px)",
          animation: "hsAurora 32s ease-in-out infinite reverse",
        }}
      />

      {/* 5: three drifting dots */}
      <div
        className="absolute"
        style={{
          width: "5px",
          height: "5px",
          left: "34%",
          top: "22%",
          borderRadius: "50%",
          background: "rgba(220,228,240,0.5)",
          animation: "hsDrift 22s ease-in-out infinite",
        }}
      />
      <div
        className="absolute"
        style={{
          width: "4px",
          height: "4px",
          left: "62%",
          top: "58%",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.4)",
          animation: "hsDrift 29s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute"
        style={{
          width: "3px",
          height: "3px",
          left: "50%",
          top: "80%",
          borderRadius: "50%",
          background: "rgba(220,228,240,0.35)",
          animation: "hsDrift 35s ease-in-out infinite",
        }}
      />

      {/* 6: soft top vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(72% 60% at 50% 0%, transparent 60%, rgba(2,3,4,0.5) 100%)",
        }}
      />
    </div>
  );
}
