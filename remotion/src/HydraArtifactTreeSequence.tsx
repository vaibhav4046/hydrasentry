import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { NoirBg } from "./lib/NoirBg";
import { RiskCounter } from "./lib/RiskCounter";
import { Wordmark } from "./lib/Wordmark";
import { COLORS, FONTS } from "./lib/theme";
import { ArtifactTree, TREE_W, TREE_H } from "./ArtifactTree";

/**
 * HydraArtifactTreeSequence — the monochrome "artifact tree" launch film. A
 * Remotion-native rebuild of the frontend hero's visual identity (white tree on
 * noir, white-hot tainted path), in 8 scenes:
 *   1 Tree seed        — trunk/branches draw in
 *   2 Memory nodes     — context badges appear
 *   3 Query path       — the clean retrieval path glows
 *   4 Poisoned memory  — the tainted memory surfaces
 *   5 Conflict detected — tainted path goes white-hot + traveling dash
 *   6 Risk counts to 87
 *   7 MCP firewall blocks
 *   8 Report generated
 *
 * Each scene owns its fades; the ArtifactTree is a pure function of
 * (progress, taint, block, frame) so scenes simply map their local frame range
 * onto those drivers. Strict monochrome — danger is white intensity, never hue.
 */

// Scene boundaries in frames @ 30fps (≈70s total = 2100 frames).
const FPS = 30;
const SCENE_FRAMES = [
  0, // start
  240, // 1 seed        (0-8s)
  480, // 2 memory      (8-16s)
  720, // 3 query path  (16-24s)
  960, // 4 poison      (24-32s)
  1290, // 5 conflict   (32-43s)
  1560, // 6 risk       (43-52s)
  1860, // 7 firewall   (52-62s)
  2100, // 8 report     (62-70s)
];

interface SceneDef {
  Comp: React.FC;
  name: string;
}

const SCENES: SceneDef[] = [
  { Comp: SceneSeed, name: "01 Tree Seed" },
  { Comp: SceneMemory, name: "02 Memory Nodes" },
  { Comp: SceneQueryPath, name: "03 Query Path" },
  { Comp: ScenePoison, name: "04 Poisoned Memory" },
  { Comp: SceneConflict, name: "05 Conflict Detected" },
  { Comp: SceneRisk, name: "06 Risk Score" },
  { Comp: SceneFirewall, name: "07 MCP Firewall" },
  { Comp: SceneReport, name: "08 Report" },
];

export const HydraArtifactTreeSequence: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgBase }}>
      {SCENES.map((s, i) => {
        const from = SCENE_FRAMES[i];
        const durationInFrames = SCENE_FRAMES[i + 1] - from;
        const Comp = s.Comp;
        return (
          <Sequence key={i} from={from} durationInFrames={durationInFrames} name={s.name}>
            <Comp />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// ---- shared layout helpers --------------------------------------------------

/** Centered tree stage; the parent scene supplies the drivers via children. */
const TreeStage: React.FC<{
  progress: number;
  taint?: number;
  block?: number;
  spotX?: number;
  opacity?: number;
}> = ({ progress, taint = 0, block = 0, spotX = 0.5, opacity = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <NoirBg spotX={spotX} spotY={0.4} intensity={0.85} />
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity,
        }}
      >
        <div
          style={{
            position: "relative",
            width: TREE_W,
            height: TREE_H,
            filter: "drop-shadow(0 0 40px rgba(255,255,255,0.06))",
          }}
        >
          <ArtifactTree progress={progress} taint={taint} block={block} frame={frame} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Lower-third title card (kicker + headline), monochrome. */
const TitleCard: React.FC<{
  kicker: string;
  title: string;
  appear: number;
  align?: "left" | "center";
}> = ({ kicker, title, appear, align = "left" }) => {
  const y = interpolate(appear, [0, 1], [24, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: align === "center" ? 0 : 120,
        right: align === "center" ? 0 : undefined,
        bottom: 96,
        opacity: appear,
        transform: `translateY(${y}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align === "center" ? "center" : "left",
      }}
    >
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 16,
          letterSpacing: "5px",
          color: COLORS.textMuted,
          textTransform: "uppercase",
        }}
      >
        {kicker}
      </span>
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize: 46,
          fontWeight: 700,
          letterSpacing: "-1px",
          color: COLORS.textPrimary,
          maxWidth: 1100,
          lineHeight: 1.08,
        }}
      >
        {title}
      </span>
    </div>
  );
};

const useAppear = (start: number, end: number): number => {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
};

const useFade = (durationInFrames: number, hold = 18): number => {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    [0, hold, durationInFrames - hold, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
};

// ---- Scene 1: Tree seed -----------------------------------------------------
function SceneSeed() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wm = spring({ frame: frame - 6, fps, config: { damping: 200, mass: 0.6, stiffness: 120 } });
  // branches draw across the scene
  const progress = interpolate(frame, [10, 220], [0, 0.16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = useFade(SCENE_FRAMES[1] - SCENE_FRAMES[0]);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <TreeStage progress={progress} spotX={0.5} />
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: wm,
          transform: `translateY(${interpolate(wm, [0, 1], [-20, 0])}px)`,
        }}
      >
        <Wordmark scale={0.72} tagline="CONTEXT INTEGRITY PLATFORM" markDraw={wm} markGlow={0.4} />
      </div>
      <TitleCard
        kicker="HydraDB native"
        title="Every agent memory is a node on the context tree."
        appear={useAppear(60, 96)}
        align="center"
      />
    </AbsoluteFill>
  );
}

// ---- Scene 2: Memory nodes --------------------------------------------------
function SceneMemory() {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 200], [0.16, 0.34], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = useFade(SCENE_FRAMES[2] - SCENE_FRAMES[1]);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <TreeStage progress={progress} />
      <TitleCard
        kicker="Context retrieval"
        title="Memories, policies and documents surface as labelled nodes."
        appear={useAppear(20, 56)}
      />
    </AbsoluteFill>
  );
}

// ---- Scene 3: Query path ----------------------------------------------------
function SceneQueryPath() {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 210], [0.36, 0.54], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = useFade(SCENE_FRAMES[3] - SCENE_FRAMES[2]);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <TreeStage progress={progress} />
      <TitleCard
        kicker="query_paths"
        title="A clean retrieval path glows through the trusted branches."
        appear={useAppear(20, 56)}
      />
    </AbsoluteFill>
  );
}

// ---- Scene 4: Poisoned memory -----------------------------------------------
function ScenePoison() {
  const frame = useCurrentFrame();
  // taint ramps up as the poisoned memory surfaces (still pre-conflict)
  const progress = interpolate(frame, [0, 120], [0.55, 0.58], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taint = interpolate(frame, [40, 150], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = useFade(SCENE_FRAMES[4] - SCENE_FRAMES[3]);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <TreeStage progress={progress} taint={taint} spotX={0.32} />
      <TitleCard
        kicker="memory poisoning"
        title="A tampered memory claims VIP customers always get instant refunds."
        appear={useAppear(24, 60)}
      />
    </AbsoluteFill>
  );
}

// ---- Scene 5: Conflict detected ---------------------------------------------
function SceneConflict() {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 160], [0.58, 0.72], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // tainted path goes fully white-hot here (traveling dash kicks in > 0.4)
  const taint = interpolate(frame, [0, 90], [0.55, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = useFade(SCENE_FRAMES[5] - SCENE_FRAMES[4]);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <TreeStage progress={progress} taint={taint} spotX={0.6} />
      <TitleCard
        kicker="conflict detected"
        title="The poisoned memory overrides the refund policy — the path goes hot."
        appear={useAppear(20, 56)}
      />
    </AbsoluteFill>
  );
}

// ---- Scene 6: Risk counts to 87 ---------------------------------------------
function SceneRisk() {
  const progress = 0.74;
  const taint = 1;
  const fade = useFade(SCENE_FRAMES[6] - SCENE_FRAMES[5]);
  const panel = useAppear(8, 36);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <TreeStage progress={progress} taint={taint} spotX={0.34} opacity={0.62} />
      <div
        style={{
          position: "absolute",
          right: 120,
          top: 0,
          bottom: 0,
          width: 720,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 30,
          opacity: panel,
          transform: `translateX(${interpolate(panel, [0, 1], [40, 0])}px)`,
        }}
      >
        <RiskCounter from={12} to={87} startFrame={36} durationFrames={70} label="RISK SCORE" size={220} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 16, letterSpacing: "4px", color: COLORS.textMuted }}>
            MEMORY POISONING · HIGH
          </span>
          <span style={{ fontFamily: FONTS.sans, fontSize: 30, fontWeight: 700, color: COLORS.textPrimary }}>
            Rules + replay + judge agree
          </span>
          <span style={{ fontFamily: FONTS.sans, fontSize: 20, color: COLORS.textSecondary, maxWidth: 600 }}>
            The deterministic engine scores the tainted path 87 / 100.
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ---- Scene 7: MCP firewall blocks -------------------------------------------
function SceneFirewall() {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 90], [0.74, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taint = interpolate(frame, [120, 170], [1, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // firewall block flash
  const block = interpolate(frame, [110, 140, 240], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = useFade(SCENE_FRAMES[7] - SCENE_FRAMES[6]);
  const badge = useAppear(140, 168);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <TreeStage progress={progress} taint={taint} block={block} spotX={0.5} />
      {/* BLOCKED stamp */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: badge,
          transform: `scale(${interpolate(badge, [0, 1], [0.9, 1])})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "14px 28px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.6)",
            background: "rgba(255,255,255,0.08)",
            boxShadow: "0 0 28px rgba(255,255,255,0.25)",
          }}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <line x1={5} y1={5} x2={19} y2={19} stroke={COLORS.white} strokeWidth={2.6} />
            <line x1={19} y1={5} x2={5} y2={19} stroke={COLORS.white} strokeWidth={2.6} />
          </svg>
          <span style={{ fontFamily: FONTS.mono, fontSize: 18, letterSpacing: "4px", color: COLORS.textPrimary }}>
            CONTEXT FIREWALL · BLOCK
          </span>
        </div>
      </div>
      <TitleCard
        kicker="mcp gateway"
        title="The firewall blocks the unsafe memory before the agent can act."
        appear={useAppear(30, 66)}
      />
    </AbsoluteFill>
  );
}

// ---- Scene 8: Report generated ----------------------------------------------
function SceneReport() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = 0.94;
  const fade = useFade(SCENE_FRAMES[8] - SCENE_FRAMES[7], 24);
  const card = spring({ frame: frame - 16, fps, config: { damping: 22, mass: 0.8, stiffness: 80 } });
  const wm = useAppear(120, 160);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <TreeStage progress={progress} taint={0.3} block={1} spotX={0.5} opacity={0.5} />
      {/* evidence report card */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 880,
            borderRadius: 18,
            border: `1px solid ${COLORS.borderStrong}`,
            background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
            boxShadow: "0 30px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
            backdropFilter: "blur(24px)",
            overflow: "hidden",
            opacity: card,
            transform: `translateY(${interpolate(card, [0, 1], [40, 0])}px)`,
          }}
        >
          <div
            style={{
              padding: "18px 28px",
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontFamily: FONTS.mono, fontSize: 15, letterSpacing: "3px", color: COLORS.textSecondary }}>
              EVIDENCE REPORT · hydrasentry-run.md
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, letterSpacing: "2px", color: COLORS.textMuted }}>
              generated
            </span>
          </div>
          <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 12, fontFamily: FONTS.mono, fontSize: 18, color: COLORS.textSecondary }}>
            <ReportRow k="risk_score" v="87 / 100 · HIGH" />
            <ReportRow k="attack_type" v="memory_poisoning" />
            <ReportRow k="firewall.decision" v="block" />
            <ReportRow k="quarantine" v="mem_poison_047" />
            <ReportRow k="graph_source" v="REAL HYDRADB QUERY_PATHS" />
          </div>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          bottom: 90,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: wm,
        }}
      >
        <Wordmark scale={0.6} tagline="SECURE THE MEMORY LAYER" markDraw={wm} markGlow={0.5} />
      </div>
    </AbsoluteFill>
  );
}

const ReportRow: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      borderBottom: `1px solid ${COLORS.border}`,
      paddingBottom: 10,
    }}
  >
    <span style={{ color: COLORS.textMuted }}>{k}</span>
    <span style={{ color: COLORS.textPrimary }}>{v}</span>
  </div>
);
