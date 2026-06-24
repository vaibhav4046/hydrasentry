import React from "react";
import { Composition } from "remotion";
import { HydraSentryDemoFilm } from "./HydraSentryDemoFilm";
import { VIDEO } from "./lib/theme";

/**
 * Remotion root. Single composition: the 75s HydraSentry noir demo film
 * at 1920x1080, 30fps, 2250 frames.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="HydraSentryDemoFilm"
      component={HydraSentryDemoFilm}
      durationInFrames={VIDEO.durationInFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  );
};
