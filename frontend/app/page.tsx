import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustMarquee } from "@/components/landing/TrustMarquee";
import { UseCaseBento } from "@/components/landing/UseCaseBento";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { PipelineDiagram } from "@/components/landing/PipelineDiagram";
import { TimelineSection } from "@/components/landing/TimelineSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { MetricsStrip } from "@/components/landing/MetricsStrip";
import { ArchitectureSection } from "@/components/landing/ArchitectureSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { SiteFooter } from "@/components/landing/SiteFooter";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <LandingNav />
      <main className="flex-1">
        <HeroSection />
        <TrustMarquee />
        <UseCaseBento />
        <ComparisonSection />
        <PipelineDiagram />
        <TimelineSection />
        <FeatureSection />
        <MetricsStrip />
        <ArchitectureSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
