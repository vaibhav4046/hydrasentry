import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { NoirBg } from "../lib/NoirBg";
import { Wordmark } from "../lib/Wordmark";
import { COLORS, FONTS } from "../lib/theme";

/**
 * Scene 9 (72-75s): final CTA on black — "Run the attack before your users do."
 * with the HydraSentry wordmark beneath.
 */
export const Scene09CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lineRise = spring({ frame: frame - 4, fps, config: { damping: 200, mass: 0.7, stiffness: 100 } });
  const wmOpacity = interpolate(frame, [22, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Gentle fade-to-black at the very end of the film.
  const fadeOut = interpolate(frame, [60, 88], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <NoirBg spotX={0.5} spotY={0.46} intensity={0.7} animate={false} />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 56, opacity: fadeOut }}>
        <h1
          style={{
            margin: 0,
            maxWidth: 1400,
            textAlign: "center",
            fontFamily: FONTS.sans,
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "-2px",
            color: COLORS.textPrimary,
            opacity: interpolate(lineRise, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(lineRise, [0, 1], [44, 0])}px)`,
            filter: `blur(${interpolate(lineRise, [0, 1], [8, 0])}px)`,
            textShadow: "0 0 40px rgba(255,255,255,0.15)",
          }}
        >
          Run the attack before your users do.
        </h1>

        <div style={{ opacity: wmOpacity }}>
          <Wordmark scale={0.78} markGlow={0.5} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
