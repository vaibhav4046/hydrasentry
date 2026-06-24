"use client";

import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SectionHeader } from "@/components/noir/SectionHeader";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { cn } from "@/lib/cn";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { ARCH_FLOW, ARCH_ENGINES, ARCH_STATS } from "./content";

/**
 * Architecture section: a left-to-right flow (Frontend -> API -> Scenario
 * Engine) fanning out into the five engines, plus a HydraDB-native stats row.
 * Monochrome, glassy, diagram-like without a heavy diagramming dependency.
 */
export function ArchitectureSection() {
  return (
    <section
      id="architecture"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 md:py-28"
    >
      <SectionHeader
        kicker="HOW IT FITS TOGETHER"
        title="HydraDB-native by construction."
        description="A thin API fronts a deterministic scenario engine. The engine drives the HydraDB adapter, risk scoring, graph extraction, skill scanning, and the MCP gateway — every stage emits evidence."
      />

      <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-12">
        {/* flow chain */}
        <m.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="flex flex-col gap-3 lg:col-span-7"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {ARCH_FLOW.map((layer, i) => (
              <m.div key={layer.label} variants={fadeUp} className="relative">
                <GlassPanel className="h-full p-4">
                  <div className="mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
                    layer {i + 1}
                  </div>
                  <div className="mt-1 text-[15px] font-semibold tracking-tight text-ink">
                    {layer.label}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {layer.items.map((item) => (
                      <li
                        key={item}
                        className="mono text-[11.5px] text-muted"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </GlassPanel>
                {i < ARCH_FLOW.length - 1 && (
                  <ArrowRight
                    aria-hidden
                    className="absolute right-[-13px] top-1/2 hidden h-4 w-4 -translate-y-1/2 text-faint sm:block"
                    strokeWidth={1.8}
                  />
                )}
              </m.div>
            ))}
          </div>

          <m.div
            variants={fadeUp}
            className="rounded-xl2 border border-dashed border-hairline-strong p-4"
          >
            <div className="mono mb-3 text-[10.5px] uppercase tracking-[0.16em] text-faint">
              engines driven by the scenario engine
            </div>
            <div className="flex flex-wrap gap-2">
              {ARCH_ENGINES.map((engine) => (
                <span
                  key={engine}
                  className="mono rounded-lg border border-hairline bg-white/[.04] px-3 py-1.5 text-[12px] text-ink"
                >
                  {engine}
                </span>
              ))}
            </div>
          </m.div>
        </m.div>

        {/* stats */}
        <m.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-2 gap-3 lg:col-span-5"
        >
          {ARCH_STATS.map((stat) => (
            <m.div key={stat.label} variants={fadeUp}>
              <GlassPanel
                className={cn(
                  "flex h-full flex-col justify-center gap-1 p-5",
                )}
              >
                <div className="text-3xl font-semibold tracking-tight text-ink">
                  {stat.value}
                </div>
                <div className="mono text-[11px] uppercase tracking-[0.14em] text-muted">
                  {stat.label}
                </div>
              </GlassPanel>
            </m.div>
          ))}
        </m.div>
      </div>
    </section>
  );
}
