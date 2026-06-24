import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { NoirBg } from "../lib/NoirBg";
import { Wordmark } from "../lib/Wordmark";
import { COLORS, FONTS } from "../lib/theme";
import { GraphMini } from "../lib/GraphMini";
import { BASE_NODES, BASE_EDGES } from "./graphData";

/**
 * Scene 1 (0-8s): black grid + radial spotlight, the white "memory tree"
 * graph grows in, then the HydraSentry wordmark + tagline fade up.
 */
export const Scene01Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Graph grows first (frames ~10-110), then recedes upward as wordmark rises.
  const graphOpacity = interpolate(frame, [10, 40, 150, 185], [0, 0.9, 0.9, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const graphLift = interpolate(frame, [150, 200], [0, -60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Wordmark reveal.
  const wmFrame = frame - 150;
  const wmRise = spring({ frame: wmFrame, fps, config: { damping: 200, mass: 0.6, stiffness: 110 } });
  const wmOpacity = interpolate(wmFrame, [0, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Tagline fades in after the wordmark settles.
  const taglineOpacity = interpolate(frame, [190, 220], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const taglineBlur = interpolate(frame, [190, 220], [6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <NoirBg spotX={0.5} spotY={0.42} intensity={1.05} />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          opacity: graphOpacity,
          transform: `translateY(${graphLift}px)`,
        }}
      >
        <GraphMini
          nodes={BASE_NODES}
          edges={BASE_EDGES}
          startFrame={10}
          edgeStagger={9}
          width={900}
          height={600}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 34,
        }}
      >
        <div
          style={{
            opacity: wmOpacity,
            transform: `translateY(${interpolate(wmRise, [0, 1], [40, 0])}px)`,
            filter: `blur(${interpolate(wmRise, [0, 1], [8, 0])}px)`,
          }}
        >
          <Wordmark scale={1} markDraw={1} markGlow={interpolate(wmRise, [0, 1], [0, 0.6])} />
        </div>
        <p
          style={{
            opacity: taglineOpacity,
            filter: `blur(${taglineBlur}px)`,
            margin: 0,
            maxWidth: 1020,
            textAlign: "center",
            fontFamily: FONTS.sans,
            fontSize: 30,
            fontWeight: 400,
            color: COLORS.textSecondary,
            letterSpacing: "-0.2px",
          }}
        >
          Graph-native context integrity for memory-powered AI agents.
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
