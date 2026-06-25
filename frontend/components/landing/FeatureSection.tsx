"use client";

import { m } from "framer-motion";
import { SectionHeader } from "@/components/noir/SectionHeader";
import { FEATURES } from "./content";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Capability grid. Each card carries the animated silver border-sweep
 * (.hydra-border-sweep, runs on hover/focus), a hover lift, and a white glow —
 * Railway-style feature cards adapted to noir. Metrics moved to MetricsStrip.
 */
export function FeatureSection() {
  return (
    <section
      id="features"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-28 md:py-36"
    >
      <SectionHeader
        kicker="CAPABILITIES"
        title="Built for memory-native agents."
        description="Six capabilities that turn HydraDB context integrity from a hope into a verifiable, repeatable process."
      />
      <m.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {FEATURES.map((feature) => {
          const Icon = feature.Icon;
          return (
            <m.div
              key={feature.title}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="hydra-border-sweep group/feat"
            >
              <div
                tabIndex={0}
                className={cn(
                  "hydra-glass flex h-full flex-col gap-3 rounded-xl2 p-5 outline-none",
                  "transition-shadow duration-300",
                  "group-hover/feat:shadow-glow focus-visible:shadow-glow",
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-white/[.04] transition-colors group-hover/feat:border-hairline-strong">
                  <Icon className="h-5 w-5 text-ink" strokeWidth={1.6} />
                </span>
                <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                  {feature.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-muted">
                  {feature.description}
                </p>
              </div>
            </m.div>
          );
        })}
      </m.div>
    </section>
  );
}
