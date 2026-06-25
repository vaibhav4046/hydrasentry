"use client";

import { m } from "framer-motion";
import { RunDemoButton } from "./HeroActions";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { blurReveal } from "@/lib/motion";

// Compact proof folded into the closing CTA (the standalone metrics band was
// removed to cut a competing focal point — the references end on one confident
// call to action, not a wall of stats).
const CTA_STATS: { value: string; label: string }[] = [
  { value: "87 / HIGH", label: "canonical run" },
  { value: "<200ms", label: "firewall decision" },
  { value: "100%", label: "deterministic" },
];

export function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-32 pt-4 md:pb-40">
      <m.div
        variants={blurReveal}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
      >
        <GlassPanel
          strong
          className="flex flex-col items-center gap-7 px-6 py-16 text-center md:py-24"
        >
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl md:text-5xl">
            Run the attack before your users do.
          </h2>
          <p className="max-w-xl text-pretty text-[17px] leading-relaxed text-muted">
            Fire the end-to-end judge demo against the live backend and watch
            Constellan replay, score, block, and report a memory-poisoning
            attack in seconds.
          </p>
          <RunDemoButton label="Run Judge Demo" size="lg" />

          {/* hairline-divided proof row — the metrics, restated quietly */}
          <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-t border-hairline pt-8">
            {CTA_STATS.map((s) => (
              <li key={s.label} className="flex flex-col items-center gap-1">
                <span className="text-xl font-semibold tracking-tight text-ink tabular-nums">
                  {s.value}
                </span>
                <span className="mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </m.div>
    </section>
  );
}
