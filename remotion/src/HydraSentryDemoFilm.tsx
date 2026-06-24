import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { COLORS } from "./lib/theme";
import { Scene01Intro } from "./scenes/Scene01Intro";
import { Scene02Baseline } from "./scenes/Scene02Baseline";
import { Scene03Poison } from "./scenes/Scene03Poison";
import { Scene04Compromise } from "./scenes/Scene04Compromise";
import { Scene05Triplets } from "./scenes/Scene05Triplets";
import { Scene06Firewall } from "./scenes/Scene06Firewall";
import { Scene07SkillMake } from "./scenes/Scene07SkillMake";
import { Scene08Report } from "./scenes/Scene08Report";
import { Scene09CTA } from "./scenes/Scene09CTA";

// Scene boundaries in seconds (from the storyboard), converted to frames at runtime.
const SCENE_MARKS_S = [0, 8, 16, 26, 36, 48, 58, 66, 72, 75];

const SCENES = [
  Scene01Intro,
  Scene02Baseline,
  Scene03Poison,
  Scene04Compromise,
  Scene05Triplets,
  Scene06Firewall,
  Scene07SkillMake,
  Scene08Report,
  Scene09CTA,
];

/**
 * Top-level film: stitches the 9 noir scenes back-to-back using Remotion
 * <Sequence>. Each scene owns its own internal fades, so transitions read as
 * smooth cross-dissolves against the shared black backdrop.
 */
export const HydraSentryDemoFilm: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgBase }}>
      {SCENES.map((Scene, i) => {
        const fromS = SCENE_MARKS_S[i];
        const toS = SCENE_MARKS_S[i + 1];
        const from = Math.round(fromS * fps);
        const durationInFrames = Math.round((toS - fromS) * fps);
        return (
          <Sequence key={i} from={from} durationInFrames={durationInFrames} name={`Scene ${String(i + 1).padStart(2, "0")}`}>
            <Scene />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
