"use client";

/**
 * Fixed, GPU-cheap noir backdrop: a faint grid, a radial spotlight, a soft
 * white core glow, faint SVG graph lines, and a few slowly drifting dots.
 * Purely decorative (aria-hidden), no external image required. Mount once in
 * the root layout behind everything (it is fixed and -z-10).
 */
import { m } from "framer-motion";

const DRIFT_DOTS = [
  { cx: 800, cy: 320, r: 5, base: 0.9, dur: 7 },
  { cx: 1070, cy: 72, r: 3, base: 0.6, dur: 9 },
  { cx: 390, cy: 92, r: 3, base: 0.55, dur: 8 },
  { cx: 1235, cy: 178, r: 3, base: 0.5, dur: 11 },
  { cx: 340, cy: 765, r: 3, base: 0.5, dur: 10 },
  { cx: 790, cy: 690, r: 4, base: 0.65, dur: 12 },
];

export function NoirBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-base"
    >
      {/* grid */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(circle at 58% 36%, black, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(circle at 58% 36%, black, transparent 78%)",
        }}
      />
      {/* radial spotlight */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 58% 38%, rgba(255,255,255,.16), rgba(255,255,255,.04) 32%, transparent 58%)",
        }}
      />
      {/* soft white core */}
      <div className="absolute left-1/2 top-1/2 h-[720px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />
      {/* faint graph lines + drifting dots */}
      <svg
        className="absolute inset-0 h-full w-full opacity-45"
        viewBox="0 0 1400 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M790 690C760 560 760 440 800 320C842 196 942 126 1070 72"
          stroke="white"
          strokeOpacity=".28"
        />
        <path
          d="M800 320C650 282 520 205 390 92"
          stroke="white"
          strokeOpacity=".18"
        />
        <path
          d="M805 350C960 338 1090 292 1235 178"
          stroke="white"
          strokeOpacity=".16"
        />
        <path
          d="M780 510C620 540 480 610 340 765"
          stroke="white"
          strokeOpacity=".13"
        />
        {DRIFT_DOTS.map((d, i) => (
          <m.circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            fill="white"
            initial={{ opacity: d.base }}
            animate={{ opacity: [d.base * 0.5, d.base, d.base * 0.5] }}
            transition={{
              duration: d.dur,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>
      {/* bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-base to-transparent" />
    </div>
  );
}
