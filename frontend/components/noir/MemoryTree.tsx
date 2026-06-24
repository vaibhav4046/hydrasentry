"use client";

import { useMemo } from "react";
import { m, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/cn";
import { EASE_OUT_EXPO } from "@/lib/motion";

interface MemoryTreeProps {
  className?: string;
  /** Run the grow -> nodes -> tainted-path -> loop arc (default true). */
  animate?: boolean;
  /** Show the small mono risk accent near the tainted canopy (default true). */
  showRisk?: boolean;
}

/**
 * Cinematic monochrome "memory tree": a luminous white neural graph rendered as
 * a bioluminescent tree on black noir. A trunk rises from a glowing base and
 * fans into branches; node-dots pop in along them; one branch is the tainted
 * path that lights white-hot with a traveling dash and pulsing nodes; faint
 * particles drift behind a soft radial spotlight.
 *
 * Color law (matches the project): WHITE / silver / gray / opacity only. Danger
 * is expressed by intensity (brighter stroke, heavier width, pulse) — never hue.
 *
 * GPU-friendly: animates only opacity, transform, SVG pathLength, and
 * stroke-dashoffset, plus a sparing drop-shadow glow. No layout animation, no
 * per-frame JS. Honors prefers-reduced-motion by rendering the final composed
 * static tree. Geometry is hand-authored and deterministic (the only jitter is
 * a fixed seeded array) so SSR and CSR match with no hydration mismatch.
 */

// ---- deterministic geometry ------------------------------------------------
// viewBox is 360 wide x 460 tall; the tree grows upward from a base near y=430.

interface Branch {
  /** SVG cubic path, authored base -> tip so pathLength draws upward. */
  d: string;
  /** Stroke base opacity for the safe (untainted) limbs. */
  o: number;
  /** Stroke width in user units. */
  w: number;
  /** Reveal order bucket (lower draws first). */
  gen: number;
}

interface TreeNode {
  x: number;
  y: number;
  /** Dot radius. */
  r: number;
  /** Base opacity for safe nodes. */
  o: number;
  /** Pop-in order bucket. */
  gen: number;
}

// Trunk + safe branches. Hand-tuned so the canopy fans symmetrically.
const TRUNK: Branch = {
  d: "M180 430 C 180 380 179 348 180 312",
  o: 0.82,
  w: 3.4,
  gen: 0,
};

const SAFE_BRANCHES: Branch[] = [
  // primary fork left/right out of the trunk crown
  { d: "M180 312 C 168 286 150 270 128 250", o: 0.6, w: 2.4, gen: 1 },
  { d: "M180 312 C 192 286 210 270 232 250", o: 0.6, w: 2.4, gen: 1 },
  { d: "M180 318 C 178 290 176 262 176 232", o: 0.52, w: 2.1, gen: 1 },
  // secondary limbs (left side)
  { d: "M128 250 C 112 234 100 214 92 190", o: 0.42, w: 1.7, gen: 2 },
  { d: "M128 250 C 118 230 110 212 96 152", o: 0.4, w: 1.6, gen: 2 },
  { d: "M176 232 C 166 210 150 196 132 176", o: 0.4, w: 1.6, gen: 2 },
  // secondary limbs (right side)
  { d: "M232 250 C 248 234 260 214 268 190", o: 0.42, w: 1.7, gen: 2 },
  { d: "M232 250 C 242 230 252 212 268 156", o: 0.4, w: 1.6, gen: 2 },
  { d: "M176 232 C 188 210 206 196 224 176", o: 0.4, w: 1.6, gen: 2 },
  // fine twigs into the canopy
  { d: "M92 190 C 84 176 78 164 70 150", o: 0.3, w: 1.2, gen: 3 },
  { d: "M132 176 C 126 162 122 150 118 134", o: 0.3, w: 1.2, gen: 3 },
  { d: "M224 176 C 230 162 234 150 240 134", o: 0.3, w: 1.2, gen: 3 },
  { d: "M268 190 C 276 176 282 164 290 150", o: 0.3, w: 1.2, gen: 3 },
  { d: "M176 232 C 176 208 178 192 180 168", o: 0.32, w: 1.3, gen: 3 },
];

// Safe canopy node-dots (tips + junctions). Coords match branch endpoints.
const SAFE_NODES: TreeNode[] = [
  { x: 180, y: 312, r: 4.2, o: 0.9, gen: 1 },
  { x: 128, y: 250, r: 3.4, o: 0.7, gen: 2 },
  { x: 232, y: 250, r: 3.4, o: 0.7, gen: 2 },
  { x: 176, y: 232, r: 3.2, o: 0.66, gen: 2 },
  { x: 92, y: 190, r: 2.8, o: 0.6, gen: 3 },
  { x: 132, y: 176, r: 2.8, o: 0.6, gen: 3 },
  { x: 224, y: 176, r: 2.8, o: 0.6, gen: 3 },
  { x: 268, y: 190, r: 2.8, o: 0.6, gen: 3 },
  { x: 70, y: 150, r: 2.3, o: 0.52, gen: 4 },
  { x: 118, y: 134, r: 2.3, o: 0.52, gen: 4 },
  { x: 240, y: 134, r: 2.3, o: 0.52, gen: 4 },
  { x: 290, y: 150, r: 2.3, o: 0.52, gen: 4 },
  { x: 96, y: 152, r: 2.1, o: 0.48, gen: 4 },
  { x: 268, y: 156, r: 2.1, o: 0.48, gen: 4 },
  { x: 180, y: 168, r: 2.4, o: 0.55, gen: 4 },
];

// The tainted path: trunk crown -> a single branch chain ending in the canopy.
// Drawn brighter + heavier; a traveling dash runs along it; its nodes pulse.
const TAINT_BRANCHES: Branch[] = [
  { d: "M180 312 C 196 288 214 276 236 258", o: 1, w: 2.8, gen: 1 },
  { d: "M236 258 C 256 240 268 222 282 198", o: 1, w: 2.4, gen: 2 },
  { d: "M282 198 C 296 178 304 162 314 138", o: 1, w: 2, gen: 3 },
];
// Single continuous overlay path (for the traveling dash highlight).
const TAINT_TRAVEL_D =
  "M180 312 C 196 288 214 276 236 258 C 256 240 268 222 282 198 C 296 178 304 162 314 138";

// poison entry node (enters from off the right edge into the tainted chain)
const POISON_NODE: TreeNode = { x: 236, y: 258, r: 5, o: 1, gen: 1 };
const TAINT_NODES: TreeNode[] = [
  POISON_NODE,
  { x: 282, y: 198, r: 4, o: 1, gen: 2 },
  { x: 314, y: 138, r: 4.4, o: 1, gen: 3 },
];

// Fixed seeded background particles — no Math.random so SSR === CSR.
const PARTICLES: { cx: number; cy: number; r: number; base: number; dur: number }[] = [
  { cx: 64, cy: 96, r: 1.6, base: 0.5, dur: 8 },
  { cx: 300, cy: 84, r: 1.4, base: 0.45, dur: 10 },
  { cx: 120, cy: 60, r: 1.2, base: 0.4, dur: 9 },
  { cx: 250, cy: 116, r: 1.5, base: 0.5, dur: 11 },
  { cx: 44, cy: 210, r: 1.3, base: 0.4, dur: 12 },
  { cx: 330, cy: 240, r: 1.4, base: 0.42, dur: 9.5 },
  { cx: 196, cy: 48, r: 1.2, base: 0.38, dur: 13 },
  { cx: 92, cy: 300, r: 1.3, base: 0.36, dur: 10.5 },
];

const WHITE = "#ffffff";
const SILVER = "#D9DEE7";

// ---- motion variants -------------------------------------------------------

/** Master timeline: stagger generations of limbs, then nodes, then taint. */
const treeContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

/** Branch stroke draws in from the base upward. */
const branchDraw = (gen: number): Variants => ({
  hidden: { pathLength: 0, opacity: 0 },
  show: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.85, ease: EASE_OUT_EXPO, delay: gen * 0.28 },
      opacity: { duration: 0.3, delay: gen * 0.28 },
    },
  },
});

/** Node-dot pops in (soft) after its limb has drawn. */
const nodePop = (gen: number): Variants => ({
  hidden: { scale: 0, opacity: 0 },
  show: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: EASE_OUT_EXPO,
      delay: 0.55 + gen * 0.22,
    },
  },
});

const TAINT_REVEAL_DELAY = 1.7;

/** Tainted limb draws in white-hot, slightly after the safe tree settles. */
const taintDraw = (gen: number): Variants => ({
  hidden: { pathLength: 0, opacity: 0 },
  show: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        duration: 0.7,
        ease: EASE_OUT_EXPO,
        delay: TAINT_REVEAL_DELAY + gen * 0.22,
      },
      opacity: { duration: 0.3, delay: TAINT_REVEAL_DELAY + gen * 0.22 },
    },
  },
});

export function MemoryTree({
  className,
  animate = true,
  showRisk = true,
}: MemoryTreeProps) {
  const prefersReduced = useReducedMotion();
  // When reduced motion is requested, render the fully composed static tree.
  const isAnimated = animate && !prefersReduced;

  // Stable filter ids (component may mount more than once on a page).
  const ids = useMemo(
    () => ({
      spot: "mt-spot",
      coreGlow: "mt-core-glow",
      nodeGlow: "mt-node-glow",
      taintGlow: "mt-taint-glow",
    }),
    [],
  );

  const initial = isAnimated ? "hidden" : false;
  const animateProp = isAnimated ? "show" : undefined;

  return (
    <div
      className={cn("relative w-full select-none", className)}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 360 460"
        className="block h-auto w-full"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        role="presentation"
      >
        <defs>
          {/* soft radial spotlight behind the canopy */}
          <radialGradient id={ids.spot} cx="52%" cy="40%" r="58%">
            <stop offset="0%" stopColor={WHITE} stopOpacity="0.16" />
            <stop offset="42%" stopColor={WHITE} stopOpacity="0.05" />
            <stop offset="100%" stopColor={WHITE} stopOpacity="0" />
          </radialGradient>
          {/* glowing base gradient */}
          <radialGradient id={ids.coreGlow} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={WHITE} stopOpacity="0.55" />
            <stop offset="55%" stopColor={WHITE} stopOpacity="0.12" />
            <stop offset="100%" stopColor={WHITE} stopOpacity="0" />
          </radialGradient>
          <filter id={ids.nodeGlow} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={ids.taintGlow} x="-160%" y="-160%" width="420%" height="420%">
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* radial spotlight wash */}
        <rect x="0" y="0" width="360" height="460" fill={`url(#${ids.spot})`} />

        {/* drifting background particles */}
        <g>
          {PARTICLES.map((p, i) => (
            <m.circle
              key={`p-${i}`}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              fill={SILVER}
              initial={{ opacity: p.base }}
              animate={
                isAnimated
                  ? { opacity: [p.base * 0.4, p.base, p.base * 0.4] }
                  : { opacity: p.base }
              }
              transition={
                isAnimated
                  ? { duration: p.dur, repeat: Infinity, ease: "easeInOut" }
                  : undefined
              }
            />
          ))}
        </g>

        {/* glowing base puck the trunk rises from */}
        <ellipse
          cx="180"
          cy="430"
          rx="62"
          ry="20"
          fill={`url(#${ids.coreGlow})`}
        />
        <m.ellipse
          cx="180"
          cy="430"
          rx="30"
          ry="9"
          fill={WHITE}
          initial={{ opacity: isAnimated ? 0 : 0.85 }}
          animate={
            isAnimated
              ? { opacity: [0.55, 0.9, 0.55] }
              : { opacity: 0.85 }
          }
          transition={
            isAnimated
              ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
          style={{ filter: `url(#${ids.taintGlow})` }}
        />

        {/* ---- the tree: branches then nodes, staggered ---- */}
        <m.g
          variants={isAnimated ? treeContainer : undefined}
          initial={initial}
          animate={animateProp}
        >
          {/* trunk + safe limbs */}
          {[TRUNK, ...SAFE_BRANCHES].map((b, i) => (
            <m.path
              key={`b-${i}`}
              d={b.d}
              stroke={WHITE}
              strokeOpacity={b.o}
              strokeWidth={b.w}
              strokeLinecap="round"
              fill="none"
              variants={isAnimated ? branchDraw(b.gen) : undefined}
            />
          ))}

          {/* safe canopy nodes */}
          {SAFE_NODES.map((n, i) => (
            <m.circle
              key={`n-${i}`}
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={SILVER}
              fillOpacity={n.o}
              stroke={WHITE}
              strokeOpacity={Math.min(1, n.o + 0.2)}
              strokeWidth={0.8}
              style={{ filter: `url(#${ids.nodeGlow})`, transformBox: "fill-box", transformOrigin: "center" }}
              variants={isAnimated ? nodePop(n.gen) : undefined}
            />
          ))}
        </m.g>

        {/* ---- tainted path: white-hot, heavier, with traveling dash ---- */}
        <g style={{ filter: `url(#${ids.taintGlow})` }}>
          {TAINT_BRANCHES.map((b, i) => (
            <m.path
              key={`tb-${i}`}
              d={b.d}
              stroke={WHITE}
              strokeOpacity={b.o}
              strokeWidth={b.w}
              strokeLinecap="round"
              fill="none"
              initial={isAnimated ? "hidden" : false}
              animate={isAnimated ? "show" : undefined}
              variants={isAnimated ? taintDraw(b.gen) : undefined}
            />
          ))}

          {/* traveling dash running along the whole tainted chain */}
          {isAnimated && (
            <m.path
              d={TAINT_TRAVEL_D}
              stroke={WHITE}
              strokeOpacity={0.95}
              strokeWidth={1.6}
              strokeLinecap="round"
              fill="none"
              strokeDasharray="10 150"
              initial={{ strokeDashoffset: 160, opacity: 0 }}
              animate={{ strokeDashoffset: [160, -160], opacity: [0, 1, 1, 0] }}
              transition={{
                strokeDashoffset: {
                  duration: 2.4,
                  ease: "linear",
                  repeat: Infinity,
                  delay: TAINT_REVEAL_DELAY + 0.7,
                },
                opacity: {
                  duration: 2.4,
                  ease: "linear",
                  repeat: Infinity,
                  delay: TAINT_REVEAL_DELAY + 0.7,
                },
              }}
            />
          )}

          {/* poison entry: a dot sliding in from off the right edge */}
          <m.circle
            cx={POISON_NODE.x}
            cy={POISON_NODE.y}
            r={POISON_NODE.r}
            fill={WHITE}
            initial={
              isAnimated
                ? { opacity: 0, cx: 360, cy: 244 }
                : { opacity: 1 }
            }
            animate={
              isAnimated
                ? { opacity: 1, cx: POISON_NODE.x, cy: POISON_NODE.y }
                : { opacity: 1 }
            }
            transition={
              isAnimated
                ? {
                    duration: 0.7,
                    ease: EASE_OUT_EXPO,
                    delay: TAINT_REVEAL_DELAY - 0.35,
                  }
                : undefined
            }
          />

          {/* tainted nodes pulse white-hot */}
          {TAINT_NODES.map((n, i) => (
            <m.circle
              key={`tn-${i}`}
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={WHITE}
              initial={{ opacity: isAnimated ? 0 : 1 }}
              animate={
                isAnimated
                  ? { opacity: [0.6, 1, 0.6] }
                  : { opacity: 1 }
              }
              transition={
                isAnimated
                  ? {
                      duration: 1.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: TAINT_REVEAL_DELAY + 0.4 + i * 0.12,
                    }
                  : undefined
              }
            />
          ))}
        </g>

        {/* small mono risk accent near the tainted canopy */}
        {showRisk && (
          <m.g
            initial={isAnimated ? { opacity: 0, y: 6 } : { opacity: 1 }}
            animate={isAnimated ? { opacity: 1, y: 0 } : { opacity: 1 }}
            transition={
              isAnimated
                ? { duration: 0.6, ease: EASE_OUT_EXPO, delay: TAINT_REVEAL_DELAY + 1 }
                : undefined
            }
          >
            <text
              x="322"
              y="116"
              textAnchor="middle"
              className="mono"
              fontSize="22"
              fontWeight="600"
              fill={WHITE}
              letterSpacing="0.5"
              style={{ filter: `url(#${ids.taintGlow})` }}
            >
              87
            </text>
            <text
              x="322"
              y="130"
              textAnchor="middle"
              className="mono"
              fontSize="7"
              fill={SILVER}
              fillOpacity="0.7"
              letterSpacing="1.4"
            >
              RISK
            </text>
          </m.g>
        )}
      </svg>
    </div>
  );
}
