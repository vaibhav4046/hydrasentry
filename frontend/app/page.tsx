import { ObservatoryBackground } from "@/components/landing/observatory/ObservatoryBackground";
import { ObservatoryNav } from "@/components/landing/observatory/ObservatoryNav";
import { ObservatoryHero } from "@/components/landing/observatory/ObservatoryHero";
import { ObservatorySections } from "@/components/landing/observatory/ObservatorySections";
import { ObservatoryFinalCta } from "@/components/landing/observatory/ObservatoryFinalCta";
import { ObservatoryFooter } from "@/components/landing/observatory/ObservatoryFooter";

/**
 * Landing page (/), "Constellan: The Memory Observatory".
 *
 * A deliberate anti-AI-template direction: the homepage is a precision celestial
 * star-atlas / observatory console. The agent's memory is charted as a sparse
 * constellation on a live canvas star-chart (azimuth ring, RA/Dec ticks, named
 * stars of varying magnitude, a slow sentinel sweep, and the tainted memory
 * collapsing into a dark crossed-out star), the opposite of the centered
 * gradient-headline + glowing neural blob cliché. The masthead is set left in a
 * sleek Space Grotesk display face (the unexpected non-serif display), the chart
 * sits off-axis, and cartographic mono labels live in the margins.
 *
 * Layered like the cockpit: a fixed void background (ObservatoryBackground, z-0)
 * behind a relative content column (z-2). Order: coordinate announcement + nav,
 * editorial hero with the star-chart plate, the below-fold observatory sections
 * (instrument legend, observation log, instruments, reduction method), the
 * closing observation band, footer.
 *
 * The announcement / nav / hero / final-CTA "Run Judge Demo" CTAs all fire the
 * real backend via runJudgeDemo() (bundled-demo fallback) and route into the
 * cockpit at /results. The previous Castellan landing (components/landing/
 * castellan/*) is left in place but unimported here. The .castellan-landing
 * wrapper class is reused so the global overflow-x clip + [data-reveal] entrance
 * CSS still apply to the homepage.
 */
export default function LandingPage() {
  return (
    <div
      className="castellan-landing observatory-landing"
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#040506",
        isolation: "isolate",
      }}
    >
      <ObservatoryBackground />

      <ObservatoryNav />

      <main
        id="top"
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "0 28px",
        }}
      >
        <ObservatoryHero />
        <ObservatorySections />
        <ObservatoryFinalCta />
      </main>

      <ObservatoryFooter />
    </div>
  );
}
