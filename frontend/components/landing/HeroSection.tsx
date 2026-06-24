"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { RunDemoButton } from "./HeroActions";
import { HERO, METRICS } from "./content";
import { MemoryTree } from "@/components/noir/MemoryTree";
import { MetricCard } from "@/components/noir/MetricCard";
import { cn } from "@/lib/cn";
import { fadeUp, staggerContainer, blurReveal } from "@/lib/motion";

export function HeroSection() {
  return (
    <section
      id="product"
      className="mx-auto grid max-w-7xl scroll-mt-24 grid-cols-1 items-center gap-12 px-6 pb-16 pt-14 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-24"
    >
      <m.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex flex-col items-start gap-6"
      >
        <m.span
          variants={fadeUp}
          className="mono rounded-full border border-hairline bg-white/[.03] px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-muted"
        >
          {HERO.kicker}
        </m.span>
        <m.h1
          variants={fadeUp}
          className="text-balance text-4xl font-semibold leading-[1.04] tracking-tight text-ink sm:text-5xl lg:text-[4.1rem]"
        >
          {HERO.headline}
        </m.h1>
        <m.p
          variants={fadeUp}
          className="max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-[17px]"
        >
          {HERO.subcopy}
        </m.p>
        <m.div
          variants={fadeUp}
          className="flex flex-col items-start gap-3 sm:flex-row sm:items-center"
        >
          <RunDemoButton label={HERO.primaryCta} size="lg" />
          <Link
            href="#architecture"
            className={cn(
              "hydra-button-secondary inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold tracking-tight",
              "outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-base",
            )}
          >
            {HERO.secondaryCta}
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </m.div>
        <m.dl
          variants={fadeUp}
          className="mt-2 grid w-full grid-cols-2 gap-3 sm:max-w-md"
        >
          {METRICS.slice(0, 2).map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              countTo={metric.countTo}
            />
          ))}
        </m.dl>
      </m.div>

      <m.div
        variants={blurReveal}
        initial="hidden"
        animate="show"
        className="relative w-full"
      >
        {/* soft radial halo so the luminous tree reads as the focal point */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(circle at 52% 42%, rgba(255,255,255,0.10), rgba(255,255,255,0.03) 38%, transparent 66%)",
          }}
        />
        <MemoryTree className="mx-auto max-w-[460px] lg:max-w-none" />
      </m.div>
    </section>
  );
}
