import { Config } from "@remotion/cli/config";

// HydraSentry noir demo film render configuration.
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(null); // auto: use all available cores
Config.setChromiumOpenGlRenderer("angle");

// Keep the H.264 output crisp for a graphics-heavy noir film.
Config.setCodec("h264");
Config.setCrf(18);
