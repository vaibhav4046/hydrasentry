import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { NoirBg } from "../lib/NoirBg";
import { COLORS, FONTS } from "../lib/theme";

type Triplet = {
  source: string;
  relation: string;
  target: string;
  tainted?: boolean;
};

// query_paths output. The tainted triplet is the smoking gun.
const TRIPLETS: Triplet[] = [
  { source: "ticket_4471", relation: "references", target: "refund_policy" },
  { source: "customer_tier", relation: "maps_to", target: "vip_flag" },
  { source: "poisoned_memory", relation: "overrides", target: "refund_policy", tainted: true },
  { source: "approval_rule", relation: "requires", target: "manager_signoff" },
];

/**
 * Scene 5 (36-48s): query_paths results appear as `source -> relation -> target`
 * triplets in mono; the tainted triplet is highlighted white-hot.
 */
export const Scene05Triplets: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [4, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <NoirBg spotX={0.5} spotY={0.36} intensity={0.8} />

      <div style={{ position: "absolute", top: 110, left: 0, right: 0, textAlign: "center", opacity: headerOpacity }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 16, letterSpacing: "5px", color: COLORS.textMuted }}>
          HYDRADB · query_paths(graph_context=true)
        </span>
        <div style={{ fontFamily: FONTS.sans, fontSize: 36, fontWeight: 600, color: COLORS.textPrimary, marginTop: 10 }}>
          The exact path that poisoned the decision
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          marginTop: 40,
        }}
      >
        {TRIPLETS.map((t, i) => {
          const appearAt = 30 + i * 18;
          const pop = spring({ frame: frame - appearAt, fps, config: { damping: 200, mass: 0.6, stiffness: 120 } });
          const opacity = interpolate(pop, [0, 1], [0, 1]);
          const x = interpolate(pop, [0, 1], [40, 0]);
          const pulse = t.tainted ? interpolate(Math.sin((frame - appearAt) / 8), [-1, 1], [0.6, 1]) : 1;

          return (
            <div
              key={`${t.source}-${t.target}`}
              style={{
                opacity,
                transform: `translateX(${x}px)`,
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "16px 30px",
                borderRadius: 12,
                minWidth: 980,
                justifyContent: "center",
                border: `1px solid ${t.tainted ? "rgba(255,255,255,0.55)" : COLORS.border}`,
                background: t.tainted
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.025)",
                boxShadow: t.tainted
                  ? `0 0 ${30 * pulse}px rgba(255,255,255,${0.25 * pulse})`
                  : "none",
              }}
            >
              <Token text={t.source} strong={t.tainted} />
              <Arrow label={t.relation} tainted={t.tainted} />
              <Token text={t.target} strong={t.tainted} />
              {t.tainted ? (
                <span
                  style={{
                    marginLeft: 18,
                    fontFamily: FONTS.mono,
                    fontSize: 14,
                    letterSpacing: "2px",
                    color: COLORS.white,
                    border: "1px solid rgba(255,255,255,0.6)",
                    borderRadius: 6,
                    padding: "4px 10px",
                  }}
                >
                  TAINTED
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Token: React.FC<{ text: string; strong?: boolean }> = ({ text, strong }) => (
  <span
    style={{
      fontFamily: FONTS.mono,
      fontSize: 26,
      color: strong ? COLORS.white : COLORS.textPrimary,
      fontWeight: strong ? 700 : 400,
    }}
  >
    {text}
  </span>
);

const Arrow: React.FC<{ label: string; tainted?: boolean }> = ({ label, tainted }) => (
  <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
    <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: tainted ? COLORS.textSecondary : COLORS.textMuted, letterSpacing: "1px" }}>
      {label}
    </span>
    <span style={{ fontFamily: FONTS.mono, fontSize: 24, color: tainted ? COLORS.white : COLORS.textSecondary }}>→</span>
  </span>
);
