"use client";

import { m } from "framer-motion";
import { MetricCard } from "@/components/noir/MetricCard";
import { METRICS } from "./content";
import { fadeUp, staggerContainer } from "@/lib/motion";

/**
 * Benchmark / metrics strip — animated count-up stat cards from the canonical
 * judge run. Sits between capabilities and the architecture section as a
 * "by-the-numbers" beat. Numbers count up on scroll-in (reduced-motion safe via
 * MetricCard). Bordered band with hairline + glow rhythm.
 */
export function MetricsStrip() {
  return (
    <section className="relative border-y border-hairline bg-deep/30">
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <m.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="flex flex-col items-center gap-3 text-center"
        >
          <m.span
            variants={fadeUp}
            className="mono text-[11px] uppercase tracking-[0.24em] text-muted"
          >
            BY THE NUMBERS
          </m.span>
          <m.h2
            variants={fadeUp}
            className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
          >
            One canonical run, fully reproducible.
          </m.h2>
        </m.div>

        <m.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4"
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
      </div>
    </section>
  );
}
