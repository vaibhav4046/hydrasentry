"use client";

import { m } from "framer-motion";
import { RunDemoButton } from "./HeroActions";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { blurReveal } from "@/lib/motion";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-28">
      <m.div
        variants={blurReveal}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
      >
        <GlassPanel
          strong
          className="flex flex-col items-center gap-6 px-6 py-14 text-center md:py-20"
        >
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl md:text-5xl">
            Run the attack before your users do.
          </h2>
          <p className="max-w-xl text-pretty text-base leading-relaxed text-muted">
            Fire the end-to-end judge demo against the live backend and watch
            HydraSentry replay, score, block, and report a memory-poisoning
            attack in seconds.
          </p>
          <RunDemoButton label="Run Judge Demo" size="lg" />
        </GlassPanel>
      </m.div>
    </section>
  );
}
