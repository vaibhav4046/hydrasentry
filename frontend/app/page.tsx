import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { PrimitivesStrip } from "@/components/landing/PrimitivesStrip";
import { TimelineSection } from "@/components/landing/TimelineSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { ArchitectureSection } from "@/components/landing/ArchitectureSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { SiteFooter } from "@/components/landing/SiteFooter";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <LandingNav />
      <main className="flex-1">
        <HeroSection />
        <PrimitivesStrip />
        <TimelineSection />
        <FeatureSection />
        <ArchitectureSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
