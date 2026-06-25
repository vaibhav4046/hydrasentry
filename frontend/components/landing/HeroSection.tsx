import { ArtifactTreeHero } from "@/components/noir/ArtifactTreeHero";

/**
 * Landing hero. Renders the signature ArtifactTreeHero — the living monochrome
 * "artifact tree graph" with the interactive Query-Paths preview, live risk
 * readout, and the staged Launch-Interactive-Demo flow. ArtifactTreeHero owns
 * its own `#product` section + anchor; this file is intentionally thin so the
 * heavy client logic stays in the noir component library.
 */
export function HeroSection() {
  return <ArtifactTreeHero />;
}
