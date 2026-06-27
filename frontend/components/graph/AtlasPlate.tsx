"use client";

import { useCallback, useState } from "react";
import { AtlasStarChart } from "./AtlasStarChart";
import {
  type AtlasGraphModel,
  type AtlasGraphStar,
  ATLAS_COORD_TICKS,
} from "@/lib/cockpit/atlasGraphModel";

/**
 * The framed Context Graph observation plate: the live AtlasStarChart canvas
 * inside an engraved atlas frame, with HTML-rendered cartographic overlays
 * positioned over the deterministic star coordinates. Labels are DOM (mono /
 * display), not canvas text, so they stay crisp at any DPR and carry real
 * typographic character, exactly like the homepage ChartPlate. This is a larger,
 * working version of that plate: PLATE II · MEMORIA, a real/demo source badge, a
 * cartographic legend (TAINTED / CLEAN / SEVERED / GUARDIAN), and the named-star
 * labels for every context entity in the run.
 *
 * The plate owns hover + selection state and lifts the selected star id to the
 * page so the Node Inspector updates. Hover here highlights the matching DOM
 * label; the canvas highlights the star + its incident lines.
 */

/** Chart plot occupies a centred square; map atlas [0,1] → plate %. */
const PLOT_PAD = 8.5; // must match computePlot's 0.085 inset

function plotX(nx: number): number {
  return PLOT_PAD + nx * (100 - PLOT_PAD * 2);
}
function plotY(ny: number): number {
  return PLOT_PAD + ny * (100 - PLOT_PAD * 2);
}

interface AtlasPlateProps {
  model: AtlasGraphModel;
  selectedId: string;
  onSelect: (id: string) => void;
  /** Honest source label: true only for parsed real HydraDB query_paths. */
  isReal: boolean;
  isRunning: boolean;
  /** Bottom-right coordinate readouts; defaults to the canonical demo ticks. */
  coordTicks?: readonly string[];
  /** When true, the REAL source is a captured offline sample, not a live call. */
  captured?: boolean;
  /** When true, the REAL source is a genuine just-now live HydraDB query. */
  live?: boolean;
  /**
   * Cinematic build progress [0..1] forwarded to the canvas. 1 (default) is the
   * normal, fully-materialized plate. The page ramps it 0 → 1 while a live
   * HydraDB query is in flight so the constellation draws itself in.
   */
  reveal?: number;
}

export function AtlasPlate({
  model,
  selectedId,
  onSelect,
  isReal,
  isRunning,
  coordTicks = ATLAS_COORD_TICKS,
  captured = false,
  live = false,
  reveal = 1,
}: AtlasPlateProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const onHover = useCallback((id: string | null) => setHoverId(id), []);
  const handleSelect = useCallback((id: string) => onSelect(id), [onSelect]);

  const activeId = hoverId ?? selectedId;

  return (
    <div
      className="atlas-plate"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 10",
        minHeight: 0,
        borderRadius: 3,
        border: "1px solid rgba(234,240,250,0.1)",
        background:
          "radial-gradient(120% 120% at 50% 30%, rgba(234,240,250,0.04), transparent 60%), linear-gradient(180deg, rgba(6,7,9,0.65), rgba(2,3,4,0.78))",
        overflow: "hidden",
      }}
    >
      <CornerMarks />

      {/* the live constellation */}
      <AtlasStarChart
        model={model}
        selectedId={selectedId}
        hoverId={hoverId}
        onHover={onHover}
        onSelect={handleSelect}
        reveal={reveal}
      />

      {/* plate header: catalogue designation */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 18,
          display: "flex",
          alignItems: "center",
          gap: 9,
          pointerEvents: "none",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#EAF0FA",
            boxShadow: "0 0 9px #EAF0FA",
            animation: "hsPulseDot 2.6s ease-in-out infinite",
          }}
        />
        <span
          className="mono"
          style={{ fontSize: "9.5px", letterSpacing: "0.26em", color: "#9BA3AF" }}
        >
          CONTEXT GRAPH
        </span>
      </div>

      {/* source badge, honest real (live / captured) vs derived */}
      <SourceBadge isReal={isReal} captured={captured} live={live} />

      {/* coordinate readouts */}
      <div
        className="mono atlas-plate-coords"
        style={{
          position: "absolute",
          bottom: 14,
          right: 16,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 3,
          pointerEvents: "none",
        }}
      >
        {coordTicks.map((c) => (
          <span
            key={c}
            style={{ fontSize: "8.5px", letterSpacing: "0.14em", color: "#5F6875" }}
          >
            {c}
          </span>
        ))}
      </div>

      {/* cartographic legend */}
      <Legend isRunning={isRunning} />

      {/* named-star labels positioned over the figure */}
      {model.stars.map((s) => (
        <StarLabel
          key={s.id}
          star={s}
          active={activeId === s.id}
          selected={selectedId === s.id}
          onSelect={handleSelect}
          onHover={onHover}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CornerMarks() {
  return (
    <>
      {(
        [
          ["top", "left"],
          ["top", "right"],
          ["bottom", "left"],
          ["bottom", "right"],
        ] as const
      ).map(([v, hpos]) => (
        <span
          key={`${v}-${hpos}`}
          aria-hidden
          style={{
            position: "absolute",
            [v]: "10px",
            [hpos]: "10px",
            width: 12,
            height: 12,
            borderTop: v === "top" ? "1px solid rgba(234,240,250,0.4)" : "none",
            borderBottom:
              v === "bottom" ? "1px solid rgba(234,240,250,0.4)" : "none",
            borderLeft:
              hpos === "left" ? "1px solid rgba(234,240,250,0.4)" : "none",
            borderRight:
              hpos === "right" ? "1px solid rgba(234,240,250,0.4)" : "none",
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

/**
 * Honest, NON-INTERACTIVE graph-source label. It is a status indicator, not a
 * control, so it shows a SINGLE badge reflecting the actual source. Three
 * real-ish states are distinguished truthfully:
 *   - LIVE      "REAL HYDRADB QUERY_PATHS · LIVE"      genuine just-now query
 *   - CAPTURED  "REAL HYDRADB QUERY_PATHS · CAPTURED"  real proof artifact
 *   - DERIVED   "DERIVED SCENARIO GRAPH FALLBACK"      demo fallback
 * LIVE only ever shows for a real, just-now traversal; never for captured or
 * derived. The LIVE state reads brightest (solid dot, white text). A leading
 * dot + "SOURCE" label make it unmistakably a readout. (pointerEvents:none.)
 */
function SourceBadge({
  isReal,
  captured = false,
  live = false,
}: {
  isReal: boolean;
  captured?: boolean;
  live?: boolean;
}) {
  const isLive = isReal && live;
  const realLabel = isLive
    ? "REAL HYDRADB QUERY_PATHS · LIVE"
    : captured
      ? "REAL HYDRADB QUERY_PATHS · CAPTURED"
      : "REAL HYDRADB QUERY_PATHS";
  const dotColor = isLive ? "#FFFFFF" : isReal ? "#EAF0FA" : "#5F6875";
  return (
    <div
      className="atlas-source-badge"
      style={{
        position: "absolute",
        top: 14,
        right: 16,
        display: "flex",
        alignItems: "center",
        gap: 9,
        pointerEvents: "none",
        padding: "5px 11px 5px 9px",
        borderRadius: 999,
        border: `1px solid ${
          isLive
            ? "rgba(255,255,255,0.6)"
            : isReal
              ? "rgba(234,240,250,0.32)"
              : "rgba(255,255,255,0.13)"
        }`,
        // Layered glass: a faint top-lit gradient + an inner lip so the chip reads
        // as a seated instrument readout, not a flat pill. LIVE reads brightest.
        background: isLive
          ? "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))"
          : isReal
            ? "linear-gradient(180deg, rgba(234,240,250,0.07), rgba(234,240,250,0.02))"
            : "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))",
        boxShadow: isLive
          ? "0 0 22px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.16)"
          : "inset 0 1px 0 rgba(255,255,255,0.06)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {/* status dot inside a faint well, so it reads as a seated indicator lamp */}
      <span
        aria-hidden
        style={{
          position: "relative",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dotColor,
          boxShadow: isReal
            ? `0 0 ${isLive ? 10 : 7}px ${dotColor}, inset 0 0 2px rgba(0,0,0,0.4)`
            : "inset 0 0 2px rgba(0,0,0,0.4)",
          animation: isLive ? "hsPulseDot 2.2s ease-in-out infinite" : "none",
        }}
      />
      <span
        className="mono"
        style={{
          fontSize: "8px",
          letterSpacing: "0.2em",
          color: "#5F6875",
          borderRight: "1px solid rgba(255,255,255,0.1)",
          paddingRight: 8,
        }}
      >
        SOURCE
      </span>
      <span
        className="mono"
        style={{
          fontSize: "9px",
          letterSpacing: "0.1em",
          color: isLive ? "#FFFFFF" : isReal ? "#EAF0FA" : "#9BA3AF",
          textShadow: isLive ? "0 0 10px rgba(255,255,255,0.45)" : "none",
        }}
      >
        {isReal ? realLabel : "DERIVED SCENARIO GRAPH FALLBACK"}
      </span>
    </div>
  );
}

const LEGEND_ITEMS: { key: string; label: string; render: () => React.ReactNode }[] =
  [
    {
      key: "tainted",
      label: "TAINTED PATH",
      render: () => (
        <span
          style={{
            width: 18,
            height: 2,
            background: "#fff",
            display: "inline-block",
            boxShadow: "0 0 4px rgba(255,255,255,0.7)",
          }}
        />
      ),
    },
    {
      key: "clean",
      label: "CLEAN",
      render: () => (
        <span
          style={{
            width: 18,
            height: 2,
            background: "rgba(234,240,250,0.32)",
            display: "inline-block",
          }}
        />
      ),
    },
    {
      key: "severed",
      label: "SEVERED",
      render: () => (
        <span
          style={{
            width: 18,
            height: 0,
            borderTop: "2px dashed rgba(234,240,250,0.5)",
            display: "inline-block",
          }}
        />
      ),
    },
    {
      key: "guardian",
      label: "GUARDIAN",
      render: () => (
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            border: "1.4px solid #fff",
            display: "inline-block",
          }}
        />
      ),
    },
  ];

function Legend({ isRunning }: { isRunning: boolean }) {
  return (
    <div
      className="mono atlas-plate-legend"
      style={{
        position: "absolute",
        bottom: 14,
        left: 16,
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        alignItems: "center",
        fontSize: "8.5px",
        letterSpacing: "0.1em",
        color: "#9BA3AF",
        pointerEvents: "none",
        maxWidth: "62%",
      }}
    >
      {LEGEND_ITEMS.map((it) => (
        <span key={it.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {it.render()}
          {it.label}
        </span>
      ))}
      <span style={{ color: "#5F6875" }}>{isRunning ? "running…" : "↗ flow"}</span>
    </div>
  );
}

interface StarLabelProps {
  star: AtlasGraphStar;
  active: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function StarLabel({ star, active, selected, onSelect, onHover }: StarLabelProps) {
  const left = plotX(star.x);
  const top = plotY(star.y);
  const isLeft = star.side === "left";
  const focused = active || selected;
  const stale = star.kind === "policy_stale";

  // Brightness ramp: tainted/guardian read brightest, stale dimmest.
  const nameColor = focused
    ? "#FFFFFF"
    : star.tainted || star.guardian
      ? "#EAF0FA"
      : stale
        ? "#5F6875"
        : "#D2D8E2";

  return (
    <div
      className="atlas-star-label"
      onMouseEnter={() => onHover(star.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(star.id)}
      style={{
        position: "absolute",
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(${isLeft ? "calc(-100% - 13px)" : "13px"}, -50%)`,
        textAlign: isLeft ? "right" : "left",
        cursor: "pointer",
        maxWidth: "40%",
        zIndex: focused ? 3 : 2,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: "9.5px",
          letterSpacing: "0.08em",
          color: nameColor,
          whiteSpace: "nowrap",
          textShadow: focused ? "0 0 10px rgba(255,255,255,0.4)" : "none",
          transition: "color 140ms ease",
        }}
      >
        {star.label}
      </div>
      <div
        className="mono atlas-star-des"
        style={{
          marginTop: 1,
          fontSize: "8px",
          letterSpacing: "0.06em",
          color: focused ? "#9BA3AF" : "#5F6875",
          whiteSpace: "nowrap",
        }}
      >
        {star.extinct ? "✕ " : star.guardian ? "⛨ " : "· "}
        {star.des}
      </div>
    </div>
  );
}
