"use client";

import { m } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { staggerContainer, fadeUp } from "@/lib/motion";
import { humanize } from "@/lib/format";
import type { Stage } from "@/lib/types";

interface StageTimelineProps {
  stages: Stage[];
  className?: string;
}

// Vertical pipeline timeline. Each stage reveals in sequence with a connecting
// rail; done stages get a filled white check, others a dim ring. Stage labels
// are humanized from the backend snake_case names.
export function StageTimeline({ stages, className }: StageTimelineProps) {
  return (
    <m.ol
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className={cn("relative flex flex-col", className)}
    >
      {stages.map((stage, i) => {
        const done = stage.status === "done";
        const last = i === stages.length - 1;
        return (
          <m.li
            key={`${stage.stage}-${i}`}
            variants={fadeUp}
            className="relative flex gap-3 pb-4"
          >
            {!last && (
              <span
                aria-hidden
                className="absolute left-[11px] top-6 h-full w-px bg-white/12"
              />
            )}
            <span
              className={cn(
                "relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                done
                  ? "border-white bg-white/[.12]"
                  : "border-hairline bg-white/[.03]",
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5 text-ink" strokeWidth={2.2} />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
              )}
            </span>
            <div className="pt-0.5">
              <div className="text-[13.5px] font-medium tracking-tight text-ink">
                {humanize(stage.stage)}
              </div>
              <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                {stage.status}
              </div>
            </div>
          </m.li>
        );
      })}
    </m.ol>
  );
}
