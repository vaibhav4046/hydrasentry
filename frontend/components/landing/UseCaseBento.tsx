"use client";

import { m } from "framer-motion";
import { SectionHeader } from "@/components/noir/SectionHeader";
import { USE_CASES, type UseCaseDef } from "./content";
import { fadeUp, staggerWide } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Use-case bento: the five context-attack classes HydraSentry catches. Adapted
 * from HydraDB's use-case bento to our security framing. The first tile spans
 * two columns as the hero of the grid. Each tile has the animated silver
 * border-sweep (.hydra-border-sweep) on hover/focus and lifts on hover.
 */
export function UseCaseBento() {
  return (
    <section
      id="use-cases"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 md:py-28"
    >
      <SectionHeader
        kicker="THREAT MODEL"
        title="Five ways context poisons an agent."
        description="Every incident class maps to a deterministic scenario you can replay, score, and block — not a vague prompt that 'looked wrong'."
      />

      <m.div
        variants={staggerWide}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {USE_CASES.map((uc) => (
          <BentoTile key={uc.title} useCase={uc} />
        ))}
      </m.div>
    </section>
  );
}

function BentoTile({ useCase }: { useCase: UseCaseDef }) {
  const { title, description, Icon, tag, wide } = useCase;
  return (
    <m.article
      variants={fadeUp}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "hydra-border-sweep group/tile",
        wide && "sm:col-span-2",
      )}
    >
      <div
        tabIndex={0}
        className={cn(
          "hydra-glass flex h-full flex-col gap-4 rounded-xl2 p-6 outline-none",
          "transition-shadow duration-300 group-hover/tile:shadow-glow",
          "focus-visible:shadow-glow",
          wide && "sm:p-8",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-hairline bg-white/[.04] text-ink transition-colors group-hover/tile:border-hairline-strong">
            <Icon
              className={cn("h-5 w-5", wide && "h-6 w-6")}
              strokeWidth={1.6}
            />
          </span>
          <span className="mono rounded-md border border-hairline bg-white/[.03] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-faint">
            {tag}
          </span>
        </div>
        <h3
          className={cn(
            "font-semibold tracking-tight text-ink",
            wide ? "text-xl sm:text-2xl" : "text-[16px]",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "text-pretty leading-relaxed text-muted",
            wide ? "max-w-2xl text-[14.5px]" : "text-[13px]",
          )}
        >
          {description}
        </p>
      </div>
    </m.article>
  );
}
