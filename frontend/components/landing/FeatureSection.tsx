"use client";

import { m } from "framer-motion";
import { SectionHeader } from "@/components/noir/SectionHeader";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { MetricCard } from "@/components/noir/MetricCard";
import { FEATURES, METRICS } from "./content";
import { fadeUp, staggerContainer } from "@/lib/motion";

export function FeatureSection() {
  return (
    <section
      id="features"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 md:py-28"
    >
      <SectionHeader
        kicker="CAPABILITIES"
        title="Built for memory-native agents."
        description="Eight capabilities that turn HydraDB context integrity from a hope into a verifiable, repeatable process."
      />
      <m.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {FEATURES.map((feature) => {
          const Icon = feature.Icon;
          return (
            <m.div
              key={feature.title}
              variants={fadeUp}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassPanel className="flex h-full flex-col gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-white/[.04]">
                  <Icon className="h-5 w-5 text-ink" strokeWidth={1.6} />
                </span>
                <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                  {feature.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-muted">
                  {feature.description}
                </p>
              </GlassPanel>
            </m.div>
          );
        })}
      </m.div>

      <m.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {METRICS.map((metric) => (
          <m.div key={metric.label} variants={fadeUp}>
            <MetricCard
              label={metric.label}
              value={metric.value}
              countTo={metric.countTo}
            />
          </m.div>
        ))}
      </m.div>
    </section>
  );
}
