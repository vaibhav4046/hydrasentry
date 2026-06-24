"use client";

import { SectionHeader } from "@/components/noir/SectionHeader";
import { DemoTimeline } from "@/components/noir/DemoTimeline";

export function TimelineSection() {
  return (
    <section
      id="timeline"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 md:py-28"
    >
      <SectionHeader
        kicker="REPLAY LAB"
        title="Run the attack before your users do."
        description="HydraSentry walks every incident through the same six stages, so you can watch a clean agent get poisoned and then blocked — with evidence at each step."
      />
      <DemoTimeline className="mt-12" />
    </section>
  );
}
