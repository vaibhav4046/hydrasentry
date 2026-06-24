import React from "react";
import { COLORS } from "./theme";

type Props = {
  size?: number;
  /** 0..1 progress for stroke-draw-in of the hex shield. */
  draw?: number;
  /** Opacity of the radiating spokes (0..1). */
  spokes?: number;
  /** Glow intensity 0..1 on the center node. */
  glow?: number;
  showPlate?: boolean;
};

/**
 * HydraSentry mark recreated inline from brand/hydrasentry-mark.svg.
 * Hexagonal shield + inner hex + center node + 6 radiating spokes.
 * Supports a stroke-draw-in animation via the `draw` prop.
 */
export const BrandMark: React.FC<Props> = ({
  size = 128,
  draw = 1,
  spokes = 1,
  glow = 0,
  showPlate = false,
}) => {
  const outerLen = 360;
  const innerLen = 230;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {showPlate ? <rect width={128} height={128} rx={28} fill={COLORS.bgBase} /> : null}
      <path
        d="M64 14L108 39.5V88.5L64 114L20 88.5V39.5L64 14Z"
        stroke={COLORS.textPrimary}
        strokeWidth={7}
        strokeLinejoin="round"
        strokeDasharray={outerLen}
        strokeDashoffset={outerLen * (1 - draw)}
      />
      <path
        d="M64 34L90 49V79L64 94L38 79V49L64 34Z"
        stroke={COLORS.markSecondary}
        strokeWidth={5}
        strokeLinejoin="round"
        strokeDasharray={innerLen}
        strokeDashoffset={innerLen * (1 - draw)}
      />
      <circle
        cx={64}
        cy={64}
        r={11}
        fill={COLORS.textPrimary}
        style={{
          filter: glow > 0 ? `drop-shadow(0 0 ${10 * glow}px rgba(255,255,255,${0.7 * glow}))` : undefined,
        }}
      />
      <path
        d="M64 20V34M64 94V108M26 42L38 49M90 79L102 86M102 42L90 49M38 79L26 86"
        stroke={COLORS.textPrimary}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={spokes}
      />
    </svg>
  );
};
