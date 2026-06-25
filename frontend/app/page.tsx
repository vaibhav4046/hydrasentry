import { CastellanBackground } from "@/components/landing/castellan/CastellanBackground";
import { CastellanNav } from "@/components/landing/castellan/CastellanNav";
import { CastellanHero } from "@/components/landing/castellan/CastellanHero";
import { CastellanProduct } from "@/components/landing/castellan/CastellanProduct";
import { CastellanSections } from "@/components/landing/castellan/CastellanSections";
import { CastellanFinalCta } from "@/components/landing/castellan/CastellanFinalCta";
import { CastellanFooter } from "@/components/landing/castellan/CastellanFooter";

/**
 * Landing page (/), a same-to-same port of the standalone Castellan landing
 * design (docs/castellan_import/HydraSentry.dc.html), rebranded HydraSentry.
 *
 * Layered like the source: a fixed noir background (CastellanBackground, z-0:
 * radial glows + masked grid + conic radar + drifting particles) sits behind a
 * relative content column (z-2). Order: announcement bar + nav, hero, the
 * interactive Memory Cortex canvas + replay band, the static below-fold sections
 * (primitives, attack flow, capabilities, architecture), the final CTA, footer.
 *
 * The previous WebGL neural-field hero (HeroMemoryField / ArtifactTreeHero /
 * WebGLMemoryField and the old landing/* sections) is no longer used on `/` —
 * those component files are left in place but unimported here. The hero/nav/
 * announcement "Run Judge Demo" CTAs call the real backend via runJudgeDemo()
 * (bundled-demo fallback) and route into the cockpit at /results; the Memory
 * Cortex canvas keeps the design's own local inject/block/reset interaction.
 */
export default function LandingPage() {
  return (
    <div
      className="castellan-landing"
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#040506",
        isolation: "isolate",
      }}
    >
      <CastellanBackground />

      <CastellanNav />

      <main
        id="top"
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 28px",
        }}
      >
        <CastellanHero />
        <CastellanProduct />
        <CastellanSections />
        <CastellanFinalCta />
      </main>

      <CastellanFooter />
    </div>
  );
}
