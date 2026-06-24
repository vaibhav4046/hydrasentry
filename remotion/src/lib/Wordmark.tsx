import React from "react";
import { COLORS, FONTS } from "./theme";
import { BrandMark } from "./BrandMark";

type Props = {
  scale?: number;
  tagline?: string;
  markDraw?: number;
  markGlow?: number;
};

/**
 * Lockup: mark + "HydraSentry" + mono tagline.
 * Recreated from brand/hydrasentry-wordmark.svg, decomposed into HTML/SVG
 * so each part can animate independently.
 */
export const Wordmark: React.FC<Props> = ({
  scale = 1,
  tagline = "CONTEXT INTEGRITY PLATFORM",
  markDraw = 1,
  markGlow = 0,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28 * scale,
        transform: `scale(${scale})`,
        transformOrigin: "center",
      }}
    >
      <BrandMark size={104} draw={markDraw} glow={markGlow} spokes={markDraw} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: "-2px",
            color: COLORS.textPrimary,
            lineHeight: 1,
          }}
        >
          HydraSentry
        </span>
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 18,
            letterSpacing: "5px",
            color: COLORS.textSecondary,
          }}
        >
          {tagline}
        </span>
      </div>
    </div>
  );
};
