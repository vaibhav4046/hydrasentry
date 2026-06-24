import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { NoirBg } from "../lib/NoirBg";
import { BrandMark } from "../lib/BrandMark";
import { COLORS, FONTS } from "../lib/theme";

type Metric = { label: string; value: string };
const METRICS: Metric[] = [
  { label: "Risk Score", value: "87/100" },
  { label: "Memories Scanned", value: "124" },
  { label: "Skills Verified", value: "8" },
  { label: "Quarantined", value: "12" },
];

const FINDINGS = [
  "Prompt-injection via poisoned memory mem_poison_047",
  "Refund policy overridden by tainted graph edge",
  "Unsafe SKILL.md directives: 4 critical lines",
  "Context blocked at MCP gateway · memory quarantined",
];

/**
 * Scene 8 (66-72s): an evidence report card assembles — header, metric tiles,
 * and a findings list — sealed with the HydraSentry mark.
 */
export const Scene08Report: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardPop = spring({ frame: frame - 6, fps, config: { damping: 200, mass: 0.7, stiffness: 95 } });
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <NoirBg spotX={0.5} spotY={0.4} intensity={0.85} />

      <div style={{ position: "absolute", top: 80, left: 0, right: 0, textAlign: "center", opacity: titleOpacity }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 16, letterSpacing: "5px", color: COLORS.textMuted }}>
          EVIDENCE REPORT GENERATED
        </span>
      </div>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 1280,
            transform: `translateY(${interpolate(cardPop, [0, 1], [40, 0])}px) scale(${interpolate(cardPop, [0, 1], [0.96, 1])})`,
            opacity: interpolate(cardPop, [0, 1], [0, 1]),
            borderRadius: 20,
            border: `1px solid ${COLORS.borderStrong}`,
            background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
            boxShadow: "0 36px 120px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
            backdropFilter: "blur(24px)",
            overflow: "hidden",
          }}
        >
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "26px 34px", borderBottom: `1px solid ${COLORS.border}` }}>
            <BrandMark size={56} draw={1} glow={0.5} showPlate />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: FONTS.sans, fontSize: 30, fontWeight: 700, color: COLORS.textPrimary }}>
                Context Integrity Report
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 14, letterSpacing: "2px", color: COLORS.textMuted }}>
                run · refund-assistant · 2026-06-24
              </span>
            </div>
            <span style={{ marginLeft: "auto", fontFamily: FONTS.mono, fontSize: 15, letterSpacing: "3px", color: COLORS.white, border: "1px solid rgba(255,255,255,0.6)", borderRadius: 8, padding: "8px 16px" }}>
              VERDICT · FAIL
            </span>
          </div>

          {/* metric tiles */}
          <div style={{ display: "flex", gap: 18, padding: "26px 34px" }}>
            {METRICS.map((m, i) => {
              const at = 24 + i * 8;
              const op = interpolate(frame - at, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={m.label} style={{ flex: 1, opacity: op, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.03)", padding: "20px 22px" }}>
                  <div style={{ fontFamily: FONTS.sans, fontSize: 40, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: "-1px" }}>{m.value}</div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 13, letterSpacing: "2px", color: COLORS.textSecondary, marginTop: 4 }}>{m.label.toUpperCase()}</div>
                </div>
              );
            })}
          </div>

          {/* findings */}
          <div style={{ padding: "0 34px 30px" }}>
            {FINDINGS.map((f, i) => {
              const at = 56 + i * 9;
              const op = interpolate(frame - at, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const x = interpolate(frame - at, [0, 12], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", opacity: op, transform: `translateX(${x}px)`, borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: COLORS.white, boxShadow: "0 0 8px rgba(255,255,255,0.7)" }} />
                  <span style={{ fontFamily: FONTS.sans, fontSize: 21, color: COLORS.textSecondary }}>{f}</span>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
