import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { BelowFold } from "@/components/landing/BelowFold";
import { SiteFooter } from "@/components/landing/SiteFooter";

/**
 * Landing page. Above-the-fold chrome (nav + the signature ArtifactTreeHero)
 * ships eagerly so first paint and LCP are light. Everything below the fold is
 * code-split and mounted on scroll via <BelowFold> (next/dynamic + DeferMount),
 * which removes the first-load hydration storm those ten client sections caused.
 */
export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <LandingNav />
      <main className="flex-1">
        <HeroSection />
        <BelowFold />
      </main>
      <SiteFooter />
    </div>
  );
}
