"use client";

import { StarChart } from "./StarChart";
import { CONSTELLATION, COORD_TICKS } from "./atlasData";

/**
 * The framed observation plate: the live StarChart canvas inside an engraved
 * atlas frame, with HTML-rendered cartographic overlays positioned over the
 * deterministic star coordinates. Rendering the labels as DOM (mono / Fraunces)
 * rather than on the canvas keeps the text crisp at any DPR and lets the named
 * stars carry real typographic character.
 *
 * The whole plate is decorative/observational; the named-star labels are the
 * legend that maps the constellation back to the product (CORE = agent memory,
 * MEM_POISON_047 = the tainted path the firewall severs, etc).
 */

/** The chart plot occupies a centred square; map atlas [0,1] → plate %. */
const PLOT_PAD = 8.5; // % inset, must match StarChart's `pad` ratio (0.085)

function plotX(nx: number): number {
  return PLOT_PAD + nx * (100 - PLOT_PAD * 2);
}
function plotY(ny: number): number {
  return PLOT_PAD + ny * (100 - PLOT_PAD * 2);
}

export function ChartPlate() {
  return (
    <div
      className="obs-plate"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        borderRadius: "2px",
        border: "1px solid rgba(234,240,250,0.1)",
        background:
          "radial-gradient(120% 120% at 50% 38%, rgba(234,240,250,0.035), transparent 60%), linear-gradient(180deg, rgba(6,7,9,0.6), rgba(2,3,4,0.7))",
        overflow: "hidden",
      }}
    >
      {/* corner registration ticks, the engraved plate frame */}
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
            width: "12px",
            height: "12px",
            borderTop: v === "top" ? "1px solid rgba(234,240,250,0.4)" : "none",
            borderBottom:
              v === "bottom" ? "1px solid rgba(234,240,250,0.4)" : "none",
            borderLeft:
              hpos === "left" ? "1px solid rgba(234,240,250,0.4)" : "none",
            borderRight:
              hpos === "right" ? "1px solid rgba(234,240,250,0.4)" : "none",
          }}
        />
      ))}

      {/* the live chart */}
      <StarChart />

      {/* plate header: catalogue designation */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "18px",
          display: "flex",
          alignItems: "center",
          gap: "9px",
        }}
      >
        <span
          aria-hidden
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#EAF0FA",
            boxShadow: "0 0 9px #EAF0FA",
            animation: "hsPulseDot 2.6s ease-in-out infinite",
          }}
        />
        <span
          className="mono"
          style={{
            fontSize: "9.5px",
            letterSpacing: "0.26em",
            color: "#9BA3AF",
          }}
        >
          PLATE I · MEMORIA
        </span>
      </div>

      {/* plate footer: coordinate readouts */}
      <div
        className="mono obs-plate-coords"
        style={{
          position: "absolute",
          bottom: "14px",
          right: "16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "3px",
        }}
      >
        {COORD_TICKS.map((c) => (
          <span
            key={c}
            style={{
              fontSize: "8.5px",
              letterSpacing: "0.14em",
              color: "#5F6875",
            }}
          >
            {c}
          </span>
        ))}
      </div>

      {/* named-star labels positioned over the figure */}
      {CONSTELLATION.map((s) => {
        const left = plotX(s.x);
        const top = plotY(s.y);
        const isLeft = s.side === "left";
        return (
          <div
            key={s.id}
            className="obs-star-label"
            style={{
              position: "absolute",
              left: `${left}%`,
              top: `${top}%`,
              transform: `translate(${isLeft ? "calc(-100% - 12px)" : "12px"}, -50%)`,
              textAlign: isLeft ? "right" : "left",
              pointerEvents: "none",
              maxWidth: "44%",
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: "9.5px",
                letterSpacing: "0.1em",
                color: s.tainted ? "#EAF0FA" : "#D9DEE7",
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </div>
            <div
              className="mono"
              style={{
                marginTop: "1px",
                fontSize: "8px",
                letterSpacing: "0.08em",
                color: "#5F6875",
                whiteSpace: "nowrap",
              }}
            >
              {s.tainted ? "✕ " : "· "}
              {s.des}
            </div>
          </div>
        );
      })}
    </div>
  );
}
