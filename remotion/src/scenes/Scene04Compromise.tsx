import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { NoirBg } from "../lib/NoirBg";
import { GraphMini } from "../lib/GraphMini";
import { RiskCounter } from "../lib/RiskCounter";
import { TerminalType, TerminalPanel } from "../lib/TerminalType";
import { COLORS, FONTS } from "../lib/theme";
import { BASE_NODES, BASE_EDGES, POISON_NODE, POISON_EDGES } from "./graphData";

/**
 * Scene 4 (26-36s): poisoned output types a dangerous auto-approval while the
 * RiskCounter climbs 12 -> 87. The tainted graph keeps pulsing behind it.
 */
export const Scene04Compromise: React.FC = () => {
  const frame = useCurrentFrame();
  const panelAppear = interpolate(frame, [6, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const nodes = [...BASE_NODES, POISON_NODE];
  const edges = [...BASE_EDGES, ...POISON_EDGES];

  return (
    <AbsoluteFill>
      <NoirBg spotX={0.68} spotY={0.4} intensity={0.9} />

      {/* Left: tainted graph, dimmed */}
      <div style={{ position: "absolute", left: 50, top: 170, opacity: 0.7 }}>
        <GraphMini nodes={nodes} edges={edges} startFrame={0} edgeStagger={3} travel width={720} height={560} />
      </div>

      {/* Right: risk climb + poisoned output */}
      <div
        style={{
          position: "absolute",
          right: 90,
          top: 0,
          bottom: 0,
          width: 900,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 38,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <RiskCounter from={12} to={87} startFrame={40} durationFrames={70} label="RISK SCORE" size={180} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: FONTS.mono, fontSize: 15, letterSpacing: "3px", color: COLORS.textMuted }}>
              POISONED RUN
            </span>
            <span style={{ fontFamily: FONTS.sans, fontSize: 26, fontWeight: 600, color: COLORS.textPrimary }}>
              Policy overridden by injected memory
            </span>
            <span style={{ fontFamily: FONTS.sans, fontSize: 18, color: COLORS.textSecondary }}>
              The agent now acts on tampered context.
            </span>
          </div>
        </div>

        <TerminalPanel title="agent · refund-assistant (compromised)" appear={panelAppear} width={860}>
          <TerminalType
            text="Refund approved instantly. VIP customers always get instant refunds."
            startFrame={36}
            cps={1.25}
            fontSize={28}
            prefix="> "
          />
        </TerminalPanel>
      </div>
    </AbsoluteFill>
  );
};
