"use client";

import { useReducedMotion } from "framer-motion";
import type { HTMLAttributes } from "react";
import { TRUST_PRIMITIVES } from "./content";
import { usePauseOffscreen } from "@/hooks/usePauseOffscreen";

/**
 * Auto-scrolling monochrome trust strip (Railway-style logo marquee, noir).
 * Shows the HydraDB-native primitives HydraSentry speaks. The track holds two
 * identical halves and slides -50% via a pure-CSS keyframe for a seamless loop;
 * it pauses on hover (animation-play-state). Under prefers-reduced-motion it
 * renders a single static, wrapped, centered row.
 */
export function TrustMarquee() {
  const reduce = useReducedMotion();
  const items = TRUST_PRIMITIVES;
  // Pause the infinite marquee transform when the strip is scrolled past / tab hidden.
  const hostRef = usePauseOffscreen<HTMLElement>();

  if (reduce) {
    return (
      <section className="border-y border-hairline bg-deep/40">
        <ul className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-4 px-6 py-6">
          {items.map((p) => (
            <PrimitiveChip key={p.label} label={p.label} Icon={p.Icon} />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section
      ref={hostRef}
      aria-label="HydraDB-native primitives"
      className="group/marquee relative overflow-hidden border-y border-hairline bg-deep/40 py-6"
    >
      <div className="marquee-mask">
        <ul className="hydra-marquee-track flex w-max items-center gap-x-10 [&>*]:shrink-0">
          {[...items, ...items].map((p, i) => (
            <PrimitiveChip
              key={`${p.label}-${i}`}
              label={p.label}
              Icon={p.Icon}
              aria-hidden={i >= items.length}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function PrimitiveChip({
  label,
  Icon,
  ...rest
}: {
  label: string;
  Icon: (typeof TRUST_PRIMITIVES)[number]["Icon"];
} & HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className="mono inline-flex items-center gap-2 whitespace-nowrap text-[12.5px] tracking-wide text-muted transition-colors hover:text-ink"
      {...rest}
    >
      <Icon className="h-4 w-4 text-ink/70" strokeWidth={1.7} />
      {label}
    </li>
  );
}
