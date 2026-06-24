import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { NoirBg } from "../lib/NoirBg";
import { GraphMini } from "../lib/GraphMini";
import { RiskCounter } from "../lib/RiskCounter";
import { TerminalType, TerminalPanel } from "../lib/TerminalType";
import { COLORS, FONTS } from "../lib/theme";
import { BASE_NODES, BASE_EDGES } from "./graphData";

/**
 * Scene 2 (8-16s): clean memory graph on the left, RiskCounter pinned at 12/100,
 * baseline agent types a safe, policy-respecting request.
 */
export const Scene02Baseline: React.FC = () => {
  const frame = useCurrentFrame();
  const panelAppear = interpolate(frame, [10, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <NoirBg spotX={0.32} spotY={0.4} intensity={0.85} />

      {/* Left: clean graph */}
      <div style={{ position: "absolute", left: 70, top: 150 }}>
        <GraphMini
          nodes={BASE_NODES}
          edges={BASE_EDGES}
          startFrame={0}
          edgeStagger={4}
          width={760}
          height={560}
        />
      </div>

      {/* Right: risk + agent prompt */}
      <div
        style={{
          position: "absolute",
          right: 90,
          top: 0,
          bottom: 0,
          width: 880,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <RiskCounter from={12} to={12} startFrame={0} durationFrames={1} label="RISK SCORE" size={180} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: FONTS.mono, fontSize: 15, letterSpacing: "3px", color: COLORS.textMuted }}>
              BASELINE RUN
            </span>
            <span style={{ fontFamily: FONTS.sans, fontSize: 26, fontWeight: 600, color: COLORS.textPrimary }}>
              Clean HydraDB context
            </span>
            <span style={{ fontFamily: FONTS.sans, fontSize: 18, color: COLORS.textSecondary }}>
              Memory intact. Policy boundaries respected.
            </span>
          </div>
        </div>

        <TerminalPanel title="agent · refund-assistant" appear={panelAppear} width={840}>
          <TerminalType
            text="I need manager approval before processing this refund."
            startFrame={45}
            cps={1.3}
            fontSize={28}
            prefix="> "
          />
        </TerminalPanel>
      </div>
    </AbsoluteFill>
  );
};
