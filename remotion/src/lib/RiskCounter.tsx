import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS, FONTS } from "./theme";

type Props = {
  from: number;
  to: number;
  /** Local frame where the count-up begins. */
  startFrame: number;
  /** Duration of the count-up in frames. */
  durationFrames: number;
  label?: string;
  size?: number;
};

/**
 * Animated risk score (NN/100) rendered as a ring + numeric count-up.
 * The ring fills as the score rises; intensity is conveyed by white glow,
 * never colour (noir constraint).
 */
export const RiskCounter: React.FC<Props> = ({
  from,
  to,
  startFrame,
  durationFrames,
  label = "RISK SCORE",
  size = 220,
}) => {
  const frame = useCurrentFrame();
  const value = Math.round(
    interpolate(frame, [startFrame, startFrame + durationFrames], [from, to], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    })
  );

  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  const pct = value / 100;
  const dangerGlow = interpolate(value, [12, 87], [0.15, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={10}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={COLORS.white}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ filter: `drop-shadow(0 0 ${16 * dangerGlow}px rgba(255,255,255,${dangerGlow}))` }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: size * 0.34,
              fontWeight: 700,
              color: COLORS.textPrimary,
              lineHeight: 1,
              letterSpacing: "-2px",
            }}
          >
            {value}
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: size * 0.08,
              color: COLORS.textMuted,
              letterSpacing: "2px",
            }}
          >
            / 100
          </span>
        </div>
      </div>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 15,
          letterSpacing: "4px",
          color: COLORS.textSecondary,
        }}
      >
        {label}
      </span>
    </div>
  );
};
