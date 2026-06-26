"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { m, useInView } from "framer-motion";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { SectionMarker } from "./SectionMarker";
import { sectionContainer, mastheadLine, EASE_OUT_EXPO } from "@/lib/motion";
import {
  TRANSIT_STATIONS,
  INTERCEPT_INDEX,
  type TransitStation,
} from "./transitStations";

/**
 * Observation log, the transit of a poisoned memory.
 *
 * Replaces the old tall vertical timeline with a COMPACT, animated "transit"
 * diagram (roughly one viewport, no long scroll): the poisoned memory crosses
 * the HydraSentry pipeline like a body transiting a sensor meridian. Nine real
 * stations sit on a single responsive SVG track.
 *
 *   wide  (>= 640px): a serpentine meridian, row 1 left->right, U-turn, row 2
 *                     right->left, so it reads as a precise horizontal pass.
 *   narrow (< 640px): a vertical meridian, a single column the marker descends,
 *                     so labels stay legible on phones (no crushed serpentine).
 *
 * Animation (plays once on scroll-into-view, then a calm idle shimmer):
 *  - a luminous poison marker travels the track (GPU offset-distance),
 *  - each station lights as the marker passes; the tainted segment glows behind
 *    it; the marker turns white-hot through the poisoned stages,
 *  - it is INTERCEPTED / STOPPED at the MCP firewall (a shield + sever beat),
 *  - then Quarantine and Report resolve.
 * Monochrome only (danger = brightness + the halt + dashed motion, never hue).
 * prefers-reduced-motion renders the fully composed static diagram.
 */

const TRANSIT_S = 3.6; // total transit-to-halt duration (seconds)
const ROW1 = TRANSIT_STATIONS.slice(0, 5);
const ROW2 = TRANSIT_STATIONS.slice(5); // 4 stations

interface Placed extends TransitStation {
  x: number;
  y: number;
  idx: number;
  /** caption / label placement relative to the node */
  side: "above" | "below" | "right";
}

interface Layout {
  vbW: number;
  vbH: number;
  trackD: string;
  placed: Placed[];
  /** path fraction (%) where the marker halts at the firewall */
  haltPct: number;
  firewall: Placed;
  mode: "wide" | "narrow";
  /** firewall meridian endpoints (the sensor line) */
  gate: { x1: number; y1: number; x2: number; y2: number };
}

// ---- wide serpentine layout ------------------------------------------------
function wideLayout(): Layout {
  const vbW = 1000;
  const vbH = 340;
  const row1Y = 96;
  const row2Y = 244;
  const marginX = 70;
  const turnR = 74;
  const trackW = vbW - marginX * 2;

  const row1X = (i: number) => marginX + (trackW * i) / (ROW1.length - 1);
  const row2X = (i: number) => vbW - marginX - (trackW * i) / (ROW2.length - 1);

  const placed: Placed[] = [
    ...ROW1.map((s, i) => ({ ...s, x: row1X(i), y: row1Y, idx: i, side: "above" as const })),
    ...ROW2.map((s, i) => ({ ...s, x: row2X(i), y: row2Y, idx: i + 5, side: "below" as const })),
  ];

  const trackD = [
    `M ${marginX} ${row1Y}`,
    `L ${vbW - marginX} ${row1Y}`,
    `A ${turnR} ${turnR} 0 0 1 ${vbW - marginX} ${row2Y}`,
    `L ${marginX} ${row2Y}`,
  ].join(" ");

  const rowLen = vbW - marginX * 2;
  const arcLen = Math.PI * turnR;
  const totalLen = rowLen + arcLen + rowLen;
  const interceptFrac = 1 / (ROW2.length - 1); // station 07 = first gap on row 2
  const interceptDist = rowLen + arcLen + rowLen * interceptFrac;
  const haltPct = (interceptDist / totalLen) * 100;

  const firewall = placed[INTERCEPT_INDEX];
  return {
    vbW, vbH, trackD, placed, haltPct, firewall, mode: "wide",
    gate: { x1: firewall.x, y1: row1Y - 58, x2: firewall.x, y2: row2Y + 58 },
  };
}

// ---- narrow vertical layout (phones) --------------------------------------
function narrowLayout(): Layout {
  // viewBox width kept close to the rendered column width so SVG text renders
  // near 1:1 (legible) while captions (<= ~30 chars) still fit to the right.
  const vbW = 366;
  const topY = 34;
  const gap = 82;
  const n = TRANSIT_STATIONS.length;
  const vbH = topY + gap * (n - 1) + 34;
  const trackX = 32; // meridian sits left; labels to the right

  const placed: Placed[] = TRANSIT_STATIONS.map((s, i) => ({
    ...s,
    x: trackX,
    y: topY + gap * i,
    idx: i,
    side: "right" as const,
  }));

  const trackD = `M ${trackX} ${topY} L ${trackX} ${topY + gap * (n - 1)}`;
  const totalLen = gap * (n - 1);
  const interceptDist = gap * INTERCEPT_INDEX;
  const haltPct = (interceptDist / totalLen) * 100;

  const firewall = placed[INTERCEPT_INDEX];
  return {
    vbW, vbH, trackD, placed, haltPct, firewall, mode: "narrow",
    gate: { x1: trackX - 26, y1: firewall.y, x2: vbW - 12, y2: firewall.y },
  };
}

// ---- phase -> brightness tokens (monochrome) ------------------------------
function nodeTone(phase: TransitStation["phase"]): {
  fill: string; ring: string; glow: string; label: string;
} {
  switch (phase) {
    case "poison":
      return { fill: "#C9D2E0", ring: "rgba(201,210,224,0.5)", glow: "rgba(201,210,224,0.9)", label: "#EAF0FA" };
    case "compromised":
      return { fill: "#FFFFFF", ring: "rgba(255,255,255,0.6)", glow: "rgba(255,255,255,1)", label: "#FFFFFF" };
    case "intercept":
      return { fill: "#FFFFFF", ring: "rgba(255,255,255,0.7)", glow: "rgba(255,255,255,1)", label: "#FFFFFF" };
    case "resolve":
      return { fill: "#EAF0FA", ring: "rgba(234,240,250,0.45)", glow: "rgba(234,240,250,0.85)", label: "#EAF0FA" };
    default:
      return { fill: "#7B8492", ring: "rgba(123,132,146,0.4)", glow: "rgba(123,132,146,0.6)", label: "#C9D2E0" };
  }
}

// Per-station light-up delay, paced to the marker (so each lights as it passes).
function lightDelay(L: Layout, idx: number): number {
  const haltFrac = L.haltPct / 100;
  if (idx <= INTERCEPT_INDEX) {
    const p = L.placed[idx];
    // path-distance fraction of this node along the track
    let distFrac: number;
    if (L.mode === "narrow") {
      distFrac = idx === 0 ? 0 : idx / INTERCEPT_INDEX * haltFrac;
    } else {
      const marginX = 70, turnR = 74, row1Y = 96;
      const rowLen = L.vbW - marginX * 2;
      const arcLen = Math.PI * turnR;
      const total = rowLen + arcLen + rowLen;
      distFrac = p.y === row1Y
        ? (p.x - marginX) / total
        : (rowLen + arcLen + (L.vbW - marginX - p.x)) / total;
    }
    return 0.25 + distFrac * (TRANSIT_S * haltFrac);
  }
  return TRANSIT_S * haltFrac + 0.55 + (idx - INTERCEPT_INDEX) * 0.32;
}

export function ObservationLog() {
  const ref = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  // Hydration-safe: false on SSR + first paint (matches server markup), then the
  // real preference after mount. Prevents React #418 when Reduced Motion is on,
  // since `play` below feeds framer-motion variants that set initial style attrs.
  const reduce = useReducedMotionSafe();
  const inView = useInView(ref, { once: true, margin: "-110px" });

  // Responsive layout: pick serpentine (wide) vs vertical (narrow). Driven by a
  // media query so it is reliable across emulation/resize and SSR-safe.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 700px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Hash-load-safe reveal: if /#flow lands this section already in view (or
  // reduced motion is on), show it on the first commit instead of waiting for
  // the IntersectionObserver, which can miss an already-in-view element after a
  // scroll-into-view and leave the whole section at opacity:0 (blank).
  const [mountedInView, setMountedInView] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < vh && r.bottom > 0) setMountedInView(true);
  }, []);

  const L = useMemo(() => (narrow ? narrowLayout() : wideLayout()), [narrow]);
  const reveal = reduce || inView || mountedInView;
  const play = reduce || mountedInView ? "done" : inView ? "run" : "idle";

  return (
    <m.section
      ref={sectionRef}
      id="flow"
      style={{ padding: "60px 0 40px" }}
      variants={sectionContainer}
      initial={false}
      animate={reveal ? "show" : "hidden"}
    >
      <div
        className="obs-flow-head"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "28px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: "30ch" }}>
          <SectionMarker index="01" label="HOW IT WORKS" />
          <m.h2
            variants={mastheadLine}
            className="obs-display"
            style={{
              marginTop: "18px",
              fontSize: "clamp(28px,3.8vw,46px)",
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
              fontWeight: 600,
              color: "#F3F6FB",
            }}
          >
            How a{" "}
            <em style={{ fontStyle: "normal", fontWeight: 400, color: "#EAF0FA" }}>
              poisoned memory
            </em>{" "}
            reaches the agent
          </m.h2>
        </div>
        <m.p
          variants={mastheadLine}
          style={{ maxWidth: "40ch", fontSize: "13.5px", lineHeight: 1.62, color: "#8B94A1" }}
        >
          Prompt scanners tell you something failed. HydraSentry shows how
          poisoned context reached the agent, nine recorded steps along the exact
          graph path, one blocked at the firewall.
        </m.p>
      </div>

      <m.div
        ref={ref}
        variants={mastheadLine}
        className="obs-transit"
        style={{
          position: "relative",
          marginTop: "34px",
          borderTop: "1px solid rgba(234,240,250,0.08)",
          paddingTop: "26px",
        }}
      >
        <TransitLegend play={play} mode={L.mode} />
        <svg
          key={L.mode}
          viewBox={`0 0 ${L.vbW} ${L.vbH}`}
          className="obs-transit-svg"
          role="img"
          aria-label="How a poisoned memory moves through the HydraSentry pipeline: seed clean context, baseline replay (safe), inject poison, poisoned replay (compromised), score risk 87 high, extract the tainted query_paths graph, block at the MCP firewall, quarantine, and export the evidence report."
          style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        >
          {/* base track (dim hairline) */}
          <path d={L.trackD} fill="none" stroke="rgba(234,240,250,0.12)" strokeWidth={1.4} strokeLinecap="round" />

          {/* tainted-path glow: a brighter overlay revealed behind the marker,
              halting at the firewall. */}
          <m.path
            d={L.trackD}
            fill="none"
            stroke={L.mode === "wide" ? "url(#transitGlow)" : "url(#transitGlowV)"}
            strokeWidth={2.2}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            initial={{ strokeDashoffset: 1, opacity: 0 }}
            animate={
              play === "done"
                ? { strokeDashoffset: 1 - L.haltPct / 100, opacity: 0.85 }
                : play === "run"
                  ? { strokeDashoffset: [1, 1 - L.haltPct / 100], opacity: [0, 0.95, 0.85] }
                  : { strokeDashoffset: 1, opacity: 0 }
            }
            transition={
              play === "run"
                ? { duration: TRANSIT_S * (L.haltPct / 100), ease: EASE_OUT_EXPO, delay: 0.2 }
                : { duration: 0.01 }
            }
            style={{ filter: "drop-shadow(0 0 6px rgba(234,240,250,0.45))" }}
          />

          {/* perpetual idle shimmer along the tainted path (after the run). */}
          {play !== "done" && (
            <m.path
              d={L.trackD}
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={2.2}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="0.05 0.95"
              initial={{ strokeDashoffset: 1, opacity: 0 }}
              animate={
                play === "run"
                  ? { strokeDashoffset: [1, 1 - L.haltPct / 100], opacity: [0, 0.5, 0.16] }
                  : { opacity: 0 }
              }
              transition={
                play === "run"
                  ? {
                      strokeDashoffset: { duration: 2.4, ease: "easeInOut", repeat: Infinity, delay: TRANSIT_S + 0.3 },
                      opacity: { duration: 2.4, ease: "easeInOut", repeat: Infinity, delay: TRANSIT_S + 0.3 },
                    }
                  : { duration: 0.3 }
              }
            />
          )}

          {/* the firewall meridian + sever beat */}
          <FirewallGate L={L} play={play} />

          {/* stations */}
          {L.placed.map((s) => (
            <Station key={s.n} s={s} L={L} play={play} />
          ))}

          {/* the travelling poison marker rides the track via offset-path and
              halts at the firewall, then a final sever flash. */}
          {play !== "done" && (
            <foreignObject x={-16} y={-16} width={32} height={32} style={{ overflow: "visible" }}>
              <m.div
                className="obs-transit-marker"
                aria-hidden
                initial={{ offsetDistance: "0%", opacity: 0 }}
                animate={
                  play === "run"
                    ? {
                        offsetDistance: ["0%", `${L.haltPct}%`, `${L.haltPct}%`],
                        opacity: [0, 1, 1, 1],
                        scale: [0.6, 1, 1.15, 0.2],
                      }
                    : { opacity: 0 }
                }
                transition={
                  play === "run"
                    ? {
                        offsetDistance: { duration: TRANSIT_S * (L.haltPct / 100), ease: [0.32, 0, 0.2, 1], delay: 0.2, times: [0, 0.92, 1] },
                        opacity: { duration: TRANSIT_S, delay: 0.2, times: [0, 0.06, 0.95, 1] },
                        scale: { duration: TRANSIT_S * (L.haltPct / 100) + 0.35, delay: 0.2, times: [0, 0.5, 0.9, 1] },
                      }
                    : { duration: 0.3 }
                }
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 50% 50%, #ffffff 0%, #ffffff 35%, rgba(234,240,250,0.65) 60%, rgba(234,240,250,0) 78%)",
                  boxShadow: "0 0 12px 3px rgba(255,255,255,0.85), 0 0 26px 6px rgba(234,240,250,0.5)",
                  offsetPath: `path("${L.trackD}")`,
                  offsetRotate: "0deg",
                }}
              />
            </foreignObject>
          )}

          <defs>
            <linearGradient id="transitGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(123,132,146,0.5)" />
              <stop offset="45%" stopColor="rgba(201,210,224,0.85)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.95)" />
            </linearGradient>
            <linearGradient id="transitGlowV" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(123,132,146,0.5)" />
              <stop offset="55%" stopColor="rgba(201,210,224,0.85)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.95)" />
            </linearGradient>
          </defs>
        </svg>
      </m.div>
    </m.section>
  );
}

// ---- a single station: node + mono index + title + one-line caption -------
function Station({ s, L, play }: { s: Placed; L: Layout; play: string }) {
  const tone = useMemo(() => nodeTone(s.phase), [s.phase]);
  const delay = useMemo(() => lightDelay(L, s.idx), [L, s.idx]);
  const isFirewall = s.idx === INTERCEPT_INDEX;

  const lit =
    play === "done"
      ? { opacity: 1, scale: 1 }
      : play === "run"
        ? { opacity: [0, 1], scale: [0.4, 1.25, 1] }
        : { opacity: 0, scale: 0.4 };
  const litT =
    play === "run"
      ? { duration: 0.55, ease: EASE_OUT_EXPO, delay, times: [0, 0.6, 1] }
      : { duration: 0.01 };
  const showStatic = play === "done" || play === "run";
  const labelDelay = play === "run" ? delay + 0.05 : 0;
  const capDelay = play === "run" ? delay + 0.12 : 0;

  // label geometry per side
  let idxX = s.x, idxY: number, titleX = s.x, titleY: number, capX = s.x, capY: number, tick: { x2: number; y2: number };
  let anchor: "middle" | "start" = "middle";
  if (s.side === "right") {
    anchor = "start";
    idxX = titleX = capX = s.x + 22;
    idxY = s.y - 7;
    titleY = s.y + 5;
    capY = s.y + 19;
    tick = { x2: s.x + 14, y2: s.y };
  } else if (s.side === "above") {
    idxY = s.y - 22;
    titleY = s.y - 35;
    capY = s.y - 49;
    tick = { x2: s.x, y2: s.y - 14 };
  } else {
    idxY = s.y + 24;
    titleY = s.y + 37;
    capY = s.y + 51;
    tick = { x2: s.x, y2: s.y + 14 };
  }

  return (
    <g>
      <m.line
        x1={s.x} y1={s.y} x2={tick.x2} y2={tick.y2}
        stroke="rgba(234,240,250,0.16)" strokeWidth={1}
        initial={{ opacity: 0 }}
        animate={showStatic ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4, delay: play === "run" ? delay : 0 }}
      />
      <m.circle
        cx={s.x} cy={s.y} r={isFirewall ? 11 : 9}
        fill="none" stroke={tone.ring} strokeWidth={1}
        initial={{ opacity: 0, scale: 0.4 }} animate={lit} transition={litT}
        style={{ transformOrigin: `${s.x}px ${s.y}px` }}
      />
      <m.circle
        cx={s.x} cy={s.y} r={isFirewall ? 5 : 4} fill={tone.fill}
        initial={{ opacity: 0, scale: 0.4 }} animate={lit} transition={litT}
        style={{ transformOrigin: `${s.x}px ${s.y}px`, filter: `drop-shadow(0 0 6px ${tone.glow})` }}
      />
      <m.text
        x={idxX} y={idxY} textAnchor={anchor} className="obs-transit-idx" fill="#5F6875"
        initial={{ opacity: 0 }} animate={showStatic ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4, delay: labelDelay }}
      >
        {s.n}
      </m.text>
      <m.text
        x={titleX} y={titleY} textAnchor={anchor} className="obs-transit-title" fill={tone.label}
        initial={{ opacity: 0 }} animate={showStatic ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4, delay: labelDelay }}
      >
        {s.title}
      </m.text>
      <m.text
        x={capX} y={capY} textAnchor={anchor} className="obs-transit-cap" fill="#8B94A1"
        initial={{ opacity: 0 }} animate={showStatic ? { opacity: 0.92 } : { opacity: 0 }}
        transition={{ duration: 0.45, delay: capDelay }}
      >
        {s.cap}
      </m.text>
    </g>
  );
}

// ---- the firewall meridian + sever beat -----------------------------------
function FirewallGate({ L, play }: { L: Layout; play: string }) {
  const { gate, firewall, mode } = L;
  const beat = TRANSIT_S * (L.haltPct / 100) + 0.18;
  // shield + BLOCK readout sit off the firewall node, clear of the track
  const shieldX = mode === "wide" ? firewall.x : firewall.x + 4;
  const shieldY = mode === "wide" ? firewall.y - 30 : firewall.y - 30;
  const blockX = mode === "wide" ? firewall.x : firewall.x + 4;
  const blockY = mode === "wide" ? firewall.y - 44 : firewall.y - 44;

  return (
    <g aria-hidden>
      <m.line
        x1={gate.x1} y1={gate.y1} x2={gate.x2} y2={gate.y2}
        stroke="rgba(234,240,250,0.22)" strokeWidth={1} strokeDasharray="3 4"
        initial={{ opacity: 0 }}
        animate={play === "done" ? { opacity: 0.7 } : play === "run" ? { opacity: [0, 0.4, 0.7] } : { opacity: 0 }}
        transition={play === "run" ? { duration: 0.6, delay: 0.4 } : { duration: 0.01 }}
      />
      <m.line
        x1={gate.x1} y1={gate.y1} x2={gate.x2} y2={gate.y2}
        stroke="#FFFFFF" strokeWidth={2}
        initial={{ opacity: 0 }}
        animate={play === "run" ? { opacity: [0, 0.9, 0] } : { opacity: 0 }}
        transition={play === "run" ? { duration: 0.55, delay: beat, ease: "easeOut" } : { duration: 0.01 }}
        style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.9))" }}
      />
      <m.path
        d={`M ${shieldX} ${shieldY} l 9 4 v 6 c 0 6 -4 9 -9 12 c -5 -3 -9 -6 -9 -12 v -6 z`}
        fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.2} strokeLinejoin="round"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={play === "done" ? { opacity: 0.9, scale: 1 } : play === "run" ? { opacity: [0, 1], scale: [0.6, 1.15, 1] } : { opacity: 0 }}
        transition={play === "run" ? { duration: 0.5, delay: beat, ease: EASE_OUT_EXPO } : { duration: 0.01 }}
        style={{ transformOrigin: `${shieldX}px ${shieldY + 12}px`, filter: "drop-shadow(0 0 5px rgba(255,255,255,0.6))" }}
      />
      <m.text
        x={blockX} y={blockY} textAnchor="middle" className="obs-transit-block" fill="#FFFFFF"
        initial={{ opacity: 0 }}
        animate={play === "done" ? { opacity: 1 } : play === "run" ? { opacity: [0, 1] } : { opacity: 0 }}
        transition={play === "run" ? { duration: 0.4, delay: beat + 0.1 } : { duration: 0.01 }}
      >
        BLOCK
      </m.text>
    </g>
  );
}

// ---- compact legend (transit reads as an instrument) ----------------------
function TransitLegend({ play, mode }: { play: string; mode: "wide" | "narrow" }) {
  const items: { dot: string; label: string }[] = [
    { dot: "#7B8492", label: "safe" },
    { dot: "#C9D2E0", label: "compromised" },
    { dot: "#FFFFFF", label: "intercept · resolve" },
  ];
  return (
    <m.div
      className="obs-transit-legend mono"
      initial={{ opacity: 0 }}
      animate={play === "done" || play === "run" ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.5, delay: play === "run" ? 0.2 : 0 }}
      style={{
        position: mode === "wide" ? "absolute" : "static",
        top: "2px",
        right: 0,
        display: "flex",
        flexWrap: "wrap",
        gap: "16px",
        marginBottom: mode === "wide" ? 0 : "16px",
        fontSize: "9px",
        letterSpacing: "0.16em",
        color: "#8B94A1",
      }}
    >
      {items.map((it) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            aria-hidden
            style={{ width: "6px", height: "6px", borderRadius: "50%", background: it.dot, boxShadow: `0 0 5px ${it.dot}` }}
          />
          {it.label.toUpperCase()}
        </span>
      ))}
    </m.div>
  );
}
