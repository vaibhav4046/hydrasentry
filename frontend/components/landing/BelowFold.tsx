"use client";

import dynamic from "next/dynamic";
import { DeferMount } from "./DeferMount";

/**
 * Below-the-fold landing sections, each code-split (next/dynamic) and mounted
 * lazily via DeferMount so neither their JS chunk nor their hydration runs on
 * first load. Only LandingNav + HeroSection (the artifact tree) ship eagerly in
 * the initial bundle; everything here streams in as the user scrolls.
 *
 * Deliberately restrained flow — hero (eager) -> proof -> threat model -> how it
 * works -> capabilities -> CTA. One idea per section, generous spacing. The
 * dense comparison table, replay-lab demo, metrics band, and architecture
 * diagram were cut from the landing to keep a single clear focal point per
 * scroll; those stories live on their dedicated command-center pages.
 *
 * ssr:false would blank the section's HTML; we keep SSR (better for SEO + no
 * flash) and rely on DeferMount to gate *hydration* timing on the client. The
 * dynamic() call still splits each section into its own chunk that the browser
 * only requests when DeferMount reveals it.
 */
const TrustMarquee = dynamic(() =>
  import("./TrustMarquee").then((m) => m.TrustMarquee),
);
const UseCaseBento = dynamic(() =>
  import("./UseCaseBento").then((m) => m.UseCaseBento),
);
const PipelineDiagram = dynamic(() =>
  import("./PipelineDiagram").then((m) => m.PipelineDiagram),
);
const FeatureSection = dynamic(() =>
  import("./FeatureSection").then((m) => m.FeatureSection),
);
const FinalCta = dynamic(() => import("./FinalCta").then((m) => m.FinalCta));

export function BelowFold() {
  return (
    <>
      <DeferMount minHeight={96}>
        <TrustMarquee />
      </DeferMount>
      <DeferMount minHeight={560}>
        <UseCaseBento />
      </DeferMount>
      <DeferMount minHeight={520}>
        <PipelineDiagram />
      </DeferMount>
      <DeferMount minHeight={520}>
        <FeatureSection />
      </DeferMount>
      <DeferMount minHeight={320}>
        <FinalCta />
      </DeferMount>
    </>
  );
}
