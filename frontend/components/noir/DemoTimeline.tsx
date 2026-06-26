"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/cn";
import { fadeUp, staggerContainer } from "@/lib/motion";

interface DemoStep {
  label: string;
  detail: string;
}

interface DemoTimelineProps {
  steps?: DemoStep[];
  className?: string;
}

const DEFAULT_STEPS: DemoStep[] = [
  { label: "Clean", detail: "Seed trusted HydraDB context, run baseline." },
  { label: "Poison", detail: "Inject adversarial memory into the tenant." },
  { label: "Attacked", detail: "Replay the task, behavior diverges." },
  { label: "Graph", detail: "Extract query_paths, taint the failing path." },
  { label: "Blocked", detail: "Firewall blocks and quarantines the memory." },
  { label: "Report", detail: "Export signed evidence of the incident." },
];

/**
 * Horizontal (vertical on mobile) numbered attack timeline:
 * Clean -> Poison -> Attacked -> Graph -> Blocked -> Report.
 * Staggered reveal on scroll. Connector line dims between nodes.
 */
export function DemoTimeline({
  steps = DEFAULT_STEPS,
  className,
}: DemoTimelineProps) {
  return (
    <m.ol
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className={cn(
        "grid gap-4 md:grid-cols-3 lg:grid-cols-6",
        className,
      )}
    >
      {steps.map((step, i) => (
        <m.li
          key={step.label}
          variants={fadeUp}
          className="hydra-glass rounded-xl2 relative flex flex-col gap-2 p-4"
        >
          <div className="flex items-center gap-2">
            <span className="mono flex h-7 w-7 items-center justify-center rounded-full border border-hairline-strong text-[12px] text-ink tabular-nums">
              {i + 1}
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink">
              {step.label}
            </span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-muted">
            {step.detail}
          </p>
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className="pointer-events-none absolute right-[-10px] top-1/2 hidden h-px w-5 -translate-y-1/2 bg-gradient-to-r from-white/30 to-transparent lg:block"
            />
          )}
        </m.li>
      ))}
    </m.ol>
  );
}
