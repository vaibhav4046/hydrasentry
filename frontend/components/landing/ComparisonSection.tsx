"use client";

import { m } from "framer-motion";
import { Check, Minus, ArrowRight } from "lucide-react";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { cn } from "@/lib/cn";
import { COMPARE_HEADLINE, COMPARE_ROWS } from "./content";
import { fadeUp, staggerContainer } from "@/lib/motion";

/**
 * Comparison section (HydraDB-style framing): prompt-level eval tools tell you a
 * prompt failed; HydraSentry shows the graph anatomy of how poisoned context
 * reached the agent. A two-column capability ledger drives the point home. The
 * HydraSentry column reads brighter (white intensity, not hue) to signal "ours".
 */
export function ComparisonSection() {
  return (
    <section className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 md:py-28">
      <m.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto flex max-w-3xl flex-col gap-4 text-center"
      >
        <m.span
          variants={fadeUp}
          className="mono text-[11px] uppercase tracking-[0.24em] text-muted"
        >
          WHY GRAPH-LEVEL
        </m.span>
        <m.h2
          variants={fadeUp}
          className="text-balance text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl md:text-[2.4rem] md:leading-[1.1]"
        >
          {COMPARE_HEADLINE}
        </m.h2>
      </m.div>

      <m.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mx-auto mt-12 max-w-4xl"
      >
        <GlassPanel className="overflow-hidden p-0">
          {/* header row */}
          <div className="grid grid-cols-[1.1fr_1fr_1.2fr] border-b border-hairline">
            <div className="px-5 py-4">
              <span className="mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
                capability
              </span>
            </div>
            <div className="border-l border-hairline px-5 py-4">
              <span className="mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
                prompt-level testing
              </span>
            </div>
            <div className="border-l border-hairline-strong bg-white/[.04] px-5 py-4">
              <span className="mono text-[10.5px] uppercase tracking-[0.16em] text-ink">
                HydraSentry
              </span>
            </div>
          </div>

          {COMPARE_ROWS.map((row, i) => (
            <div
              key={row.capability}
              className={cn(
                "grid grid-cols-[1.1fr_1fr_1.2fr] items-stretch",
                i < COMPARE_ROWS.length - 1 && "border-b border-hairline",
              )}
            >
              <div className="flex items-center px-5 py-4">
                <span className="text-[13.5px] font-medium text-ink">
                  {row.capability}
                </span>
              </div>
              <div className="flex items-start gap-2 border-l border-hairline px-5 py-4">
                <Minus
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-faint"
                  strokeWidth={1.8}
                />
                <span className="text-[13px] leading-relaxed text-muted">
                  {row.promptLevel}
                </span>
              </div>
              <div className="flex items-start gap-2 border-l border-hairline-strong bg-white/[.025] px-5 py-4">
                <Check
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-ink"
                  strokeWidth={2}
                />
                <span className="text-[13px] font-medium leading-relaxed text-ink">
                  {row.hydrasentry}
                </span>
              </div>
            </div>
          ))}
        </GlassPanel>

        <p className="mono mt-4 inline-flex items-center gap-1.5 text-[11.5px] text-faint">
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          context integrity is a graph problem, not a string problem
        </p>
      </m.div>
    </section>
  );
}
