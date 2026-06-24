import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { NoirBg } from "../lib/NoirBg";
import { COLORS, FONTS } from "../lib/theme";

/**
 * Scene 6 (48-58s): an MCP firewall panel slides in from the right, the tainted
 * edge is severed, and the memory is quarantined (mem_poison_047).
 */
export const Scene06Firewall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slide = spring({ frame: frame - 12, fps, config: { damping: 22, mass: 0.8, stiffness: 80 } });
  const panelX = interpolate(slide, [0, 1], [560, 0]);

  // Edge "cut": the severed link recoils at frame ~55.
  const cut = interpolate(frame, [55, 70], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blockedFlash = interpolate(frame, [60, 66, 76], [0, 1, 0.7], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <NoirBg spotX={0.42} spotY={0.42} intensity={0.85} />

      {/* Left: the link being severed */}
      <div style={{ position: "absolute", left: 120, top: 0, bottom: 0, width: 760, display: "flex", alignItems: "center" }}>
        <svg width={760} height={420} viewBox="0 0 760 420" fill="none">
          {/* upstream poison node */}
          <circle cx={90} cy={210} r={14} fill={COLORS.black} stroke={COLORS.white} strokeWidth={2.5} />
          <text x={90} y={250} fill={COLORS.textSecondary} fontFamily='"JetBrains Mono", monospace' fontSize={13} textAnchor="middle">
            mem_poison_047
          </text>
          {/* downstream memory root */}
          <circle cx={670} cy={210} r={13} fill={COLORS.white} />
          <text x={670} y={250} fill={COLORS.textSecondary} fontFamily='"JetBrains Mono", monospace' fontSize={13} textAnchor="middle">
            agent_memory
          </text>
          {/* severed edge: two halves recoil */}
          <line x1={104} y1={210} x2={interpolate(cut, [0, 1], [360, 380])} y2={210} stroke={COLORS.white} strokeWidth={3} opacity={interpolate(cut, [0, 1], [0.35, 1])} style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.7))" }} />
          <line x1={interpolate(cut, [0, 1], [400, 380])} y1={210} x2={656} y2={210} stroke={COLORS.white} strokeWidth={3} opacity={interpolate(cut, [0, 1], [0.35, 1])} style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.7))" }} />
          {/* block marker at the cut */}
          <g opacity={blockedFlash} transform="translate(380 210)">
            <circle r={26} fill="none" stroke={COLORS.white} strokeWidth={2.5} />
            <line x1={-13} y1={-13} x2={13} y2={13} stroke={COLORS.white} strokeWidth={3} />
            <line x1={13} y1={-13} x2={-13} y2={13} stroke={COLORS.white} strokeWidth={3} />
          </g>
        </svg>
      </div>

      {/* Right: MCP firewall panel */}
      <div
        style={{
          position: "absolute",
          right: 90,
          top: "50%",
          transform: `translate(${panelX}px, -50%)`,
          width: 720,
          borderRadius: 18,
          border: `1px solid ${COLORS.borderStrong}`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
          boxShadow: "0 30px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
          backdropFilter: "blur(24px)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 26px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 15, letterSpacing: "3px", color: COLORS.textSecondary }}>
            MCP CONTEXT FIREWALL
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 13, letterSpacing: "2px", color: COLORS.textMuted }}>
            scan_context
          </span>
        </div>
        <div style={{ padding: "30px 28px", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: blockedFlash,
              }}
            >
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                <line x1={5} y1={5} x2={19} y2={19} stroke={COLORS.white} strokeWidth={2.5} />
                <line x1={19} y1={5} x2={5} y2={19} stroke={COLORS.white} strokeWidth={2.5} />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: FONTS.sans, fontSize: 34, fontWeight: 700, color: COLORS.textPrimary }}>
                CONTEXT BLOCKED
              </span>
              <span style={{ fontFamily: FONTS.sans, fontSize: 20, color: COLORS.textSecondary }}>
                memory quarantined
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: FONTS.mono, fontSize: 17, color: COLORS.textSecondary }}>
            <Row k="source_chunk_id" v="mem_poison_047" />
            <Row k="decision" v="block" />
            <Row k="action" v="quarantine" />
            <Row k="edge" v="poisoned_memory → refund_policy" />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Row: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
    <span style={{ color: COLORS.textMuted }}>{k}</span>
    <span style={{ color: COLORS.textPrimary }}>{v}</span>
  </div>
);
