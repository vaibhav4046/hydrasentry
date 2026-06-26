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
 * Fraunces) — not canvas text — so they stay crisp at any DPR and carry real
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
}

export function AtlasPlate({
  model,
  selectedId,
  onSelect,
  isReal,
  isRunning,
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
          PLATE II · MEMORIA
        </span>
      </div>

      {/* source badge — honest real vs derived */}
      <SourceBadge isReal={isReal} />

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
        {ATLAS_COORD_TICKS.map((c) => (
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

function SourceBadge({ isReal }: { isReal: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 16,
        display: "flex",
        gap: 7,
        pointerEvents: "none",
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: "9px",
          letterSpacing: "0.1em",
          color: isReal ? "#EAF0FA" : "#5F6875",
          border: `1px solid ${isReal ? "rgba(234,240,250,0.3)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 999,
          padding: "4px 9px",
          background: isReal ? "rgba(234,240,250,0.05)" : "transparent",
        }}
      >
        REAL HYDRADB QUERY_PATHS
      </span>
      <span
        className="mono"
        style={{
          fontSize: "9px",
          letterSpacing: "0.1em",
          color: isReal ? "#5F6875" : "#EAF0FA",
          border: `1px solid ${isReal ? "rgba(255,255,255,0.1)" : "rgba(234,240,250,0.3)"}`,
          borderRadius: 999,
          padding: "4px 9px",
          background: isReal ? "transparent" : "rgba(234,240,250,0.05)",
        }}
      >
        DERIVED SCENARIO GRAPH
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
