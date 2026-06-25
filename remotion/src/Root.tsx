import React from "react";
import { Composition } from "remotion";
import { HydraSentryDemoFilm } from "./HydraSentryDemoFilm";
import { HydraArtifactTreeSequence } from "./HydraArtifactTreeSequence";
import { VIDEO } from "./lib/theme";

/**
 * Remotion root. Two compositions:
 *  - HydraSentryDemoFilm: the original 75s noir demo film (2250 frames).
 *  - HydraArtifactTreeSequence: the monochrome "artifact tree" identity film
 *    (8 scenes, 1920x1080, 30fps, 2100 frames ≈ 70s) matching the frontend hero.
 * Both register cleanly so either can be selected/rendered.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HydraSentryDemoFilm"
        component={HydraSentryDemoFilm}
        durationInFrames={VIDEO.durationInFrames}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="HydraArtifactTreeSequence"
        component={HydraArtifactTreeSequence}
        durationInFrames={2100}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
