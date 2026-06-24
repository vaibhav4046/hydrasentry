import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { NoirBg } from "../lib/NoirBg";
import { GraphMini } from "../lib/GraphMini";
import { COLORS, FONTS } from "../lib/theme";
import { BASE_NODES, BASE_EDGES, POISON_NODE, POISON_EDGES } from "./graphData";

/**
 * Scene 3 (16-26s): a poisoned memory node slides in from the left and wires
 * into the graph; the tainted path pulses white-hot with a traveling packet.
 */
export const Scene03Poison: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Poison node enters; tainted edges draw after it lands.
  const enter = spring({ frame: frame - 20, fps, config: { damping: 18, mass: 0.7, stiffness: 90 } });
  const enterX = interpolate(enter, [0, 1], [-220, 0]);

  const nodes = [...BASE_NODES, POISON_NODE];
  const taintStart = 48;
  const showTaint = frame >= taintStart;
  const edges = showTaint ? [...BASE_EDGES, ...POISON_EDGES] : BASE_EDGES;

  const labelOpacity = interpolate(frame, [60, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <NoirBg spotX={0.4} spotY={0.42} intensity={0.95} />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `translateX(${enterX}px)` }}>
          <GraphMini
            nodes={nodes}
            edges={edges}
            startFrame={0}
            edgeStagger={5}
            travel
            width={980}
            height={620}
          />
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          top: 90,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: labelOpacity,
        }}
      >
        <span style={{ fontFamily: FONTS.mono, fontSize: 16, letterSpacing: "4px", color: COLORS.textMuted }}>
          INJECTION DETECTED
        </span>
        <div style={{ fontFamily: FONTS.sans, fontSize: 34, fontWeight: 600, color: COLORS.textPrimary, marginTop: 8 }}>
          Poisoned memory wires into the context graph
        </div>
      </div>
    </AbsoluteFill>
  );
};
