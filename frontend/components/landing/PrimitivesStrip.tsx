"use client";

import { m } from "framer-motion";
import { PRIMITIVES } from "./content";
import { fadeUp, staggerContainer } from "@/lib/motion";

export function PrimitivesStrip() {
  return (
    <section className="border-y border-hairline bg-deep/40">
      <m.ul
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-4 px-6 py-6"
      >
        {PRIMITIVES.map((primitive) => {
          const Icon = primitive.Icon;
          return (
            <m.li
              key={primitive.label}
              variants={fadeUp}
              className="mono inline-flex items-center gap-2 text-[12.5px] tracking-wide text-muted"
            >
              <Icon className="h-4 w-4 text-ink/70" strokeWidth={1.7} />
              {primitive.label}
            </m.li>
          );
        })}
      </m.ul>
    </section>
  );
}
