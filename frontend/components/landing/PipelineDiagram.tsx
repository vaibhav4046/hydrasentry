"use client";

import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SectionHeader } from "@/components/noir/SectionHeader";
import { PIPELINE, type PipelineStep } from "./content";
import { fadeUp, nodePopIn, staggerWide } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * The deterministic HydraSentry pipeline rendered as an animated monochrome
 * node-flow. Nodes pop in left-to-right on scroll; connectors are hairline with
 * a chevron. "tainted" steps (poison present) read brighter with a dashed ring
 * and a traveling-dash underline — danger via white intensity + motion, never
 * hue. Wraps into rows responsively; no horizontal overflow at any width.
 */
export function PipelineDiagram() {
  return (
    <section
      id="pipeline"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-28 md:py-36"
    >
      <SectionHeader
        kicker="THE PIPELINE"
        title="Nine deterministic stages, every run."
        description="Seed clean context, replay it, inject poison, replay again, extract the query_paths graph, score the risk, then firewall, quarantine, and report. Same input, same output — every time."
      />

      <m.ol
        variants={staggerWide}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-14 flex flex-wrap items-stretch justify-center gap-y-6"
      >
        {PIPELINE.map((step, i) => (
          <li key={step.label} className="flex items-stretch">
            <PipelineNode step={step} index={i} />
            {i < PIPELINE.length - 1 && <Connector />}
          </li>
        ))}
      </m.ol>

      <m.p
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="mono mt-8 text-center text-[11.5px] text-faint"
      >
        canonical run · memory_poisoning_refund · 87 / HIGH · reproducible offline
      </m.p>
    </section>
  );
}

function PipelineNode({ step, index }: { step: PipelineStep; index: number }) {
  const { label, detail, tainted } = step;
  return (
    <m.div
      variants={nodePopIn}
      className={cn(
        "relative flex w-[150px] flex-col gap-1 rounded-xl2 border p-3.5 text-center",
        tainted
          ? "border-dashed border-hairline-strong bg-white/[.07] shadow-glow"
          : "border-hairline bg-white/[.03]",
      )}
    >
      <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        className={cn(
          "text-[12.5px] font-semibold leading-tight tracking-tight",
          tainted ? "text-ink" : "text-ink/90",
        )}
      >
        {label}
      </span>
      <span className="mono text-[10.5px] text-muted">{detail}</span>

      {tainted && (
        // Traveling-dash underline marks the poisoned segment of the flow.
        <svg
          aria-hidden
          viewBox="0 0 120 4"
          className="mt-1 h-1 w-full"
          preserveAspectRatio="none"
        >
          <line
            x1="2"
            y1="2"
            x2="118"
            y2="2"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.5"
            strokeDasharray="6 8"
            strokeLinecap="round"
            className="atg-travel"
          />
        </svg>
      )}
    </m.div>
  );
}

function Connector() {
  return (
    <span
      aria-hidden
      className="flex w-7 shrink-0 items-center justify-center self-center"
    >
      <ArrowRight className="h-4 w-4 text-faint" strokeWidth={1.8} />
    </span>
  );
}
