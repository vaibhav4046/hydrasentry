"use client";

import dynamic from "next/dynamic";
import { DeferMount } from "./DeferMount";

/**
 * Below-the-fold landing sections, each code-split (next/dynamic) and mounted
 * lazily via DeferMount so neither their JS chunk nor their hydration runs on
 * first load. Only LandingNav + HeroSection (the artifact tree) ship eagerly in
 * the initial bundle; everything here streams in as the user scrolls.
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
const ComparisonSection = dynamic(() =>
  import("./ComparisonSection").then((m) => m.ComparisonSection),
);
const PipelineDiagram = dynamic(() =>
  import("./PipelineDiagram").then((m) => m.PipelineDiagram),
);
const TimelineSection = dynamic(() =>
  import("./TimelineSection").then((m) => m.TimelineSection),
);
const FeatureSection = dynamic(() =>
  import("./FeatureSection").then((m) => m.FeatureSection),
);
const MetricsStrip = dynamic(() =>
  import("./MetricsStrip").then((m) => m.MetricsStrip),
);
const ArchitectureSection = dynamic(() =>
  import("./ArchitectureSection").then((m) => m.ArchitectureSection),
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
        <ComparisonSection />
      </DeferMount>
      <DeferMount minHeight={520}>
        <PipelineDiagram />
      </DeferMount>
      <DeferMount minHeight={360}>
        <TimelineSection />
      </DeferMount>
      <DeferMount minHeight={520}>
        <FeatureSection />
      </DeferMount>
      <DeferMount minHeight={360}>
        <MetricsStrip />
      </DeferMount>
      <DeferMount minHeight={560}>
        <ArchitectureSection />
      </DeferMount>
      <DeferMount minHeight={320}>
        <FinalCta />
      </DeferMount>
    </>
  );
}
