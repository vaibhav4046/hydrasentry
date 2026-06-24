import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "./theme";

type Props = {
  /** Spotlight center X as a 0..1 fraction of width. */
  spotX?: number;
  /** Spotlight center Y as a 0..1 fraction of height. */
  spotY?: number;
  /** Spotlight intensity multiplier. */
  intensity?: number;
  /** Grid line opacity 0..1. */
  gridOpacity?: number;
  /** Adds a slow breathing drift to the spotlight when true. */
  animate?: boolean;
};

/**
 * Reusable noir background: deep-black base, faint 64px grid, radial spotlight,
 * and a soft vignette. Mirrors the product's NoirBackground component.
 */
export const NoirBg: React.FC<Props> = ({
  spotX = 0.5,
  spotY = 0.4,
  intensity = 1,
  gridOpacity = 0.045,
  animate = true,
}) => {
  const frame = useCurrentFrame();
  const breathe = animate
    ? interpolate(Math.sin(frame / 90), [-1, 1], [0.92, 1.08])
    : 1;
  const cx = `${spotX * 100}%`;
  const cy = `${spotY * 100}%`;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgBase }}>
      {/* faint engineering grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,${gridOpacity}) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,${gridOpacity}) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />
      {/* radial spotlight */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${cx} ${cy}, rgba(255,255,255,${
            0.16 * intensity * breathe
          }), rgba(255,255,255,${0.04 * intensity}) 32%, transparent 60%)`,
        }}
      />
      {/* edge vignette to seat the frame in black */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(to top, ${COLORS.bgBase} 0%, transparent 22%)`,
        }}
      />
    </AbsoluteFill>
  );
};
