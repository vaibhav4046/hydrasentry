"use client";

import { m } from "framer-motion";
import { ArrowDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { staggerContainer, fadeUp } from "@/lib/motion";
import { humanize } from "@/lib/format";
import type { SelfRefinement } from "@/lib/types";

interface SelfRefinementTimelineProps {
  refinement: SelfRefinement;
  className?: string;
}

interface TimelineStep {
  label: string;
  detail: string;
}

// Renders the self-refinement loop: finding accepted -> pattern extracted ->
// rule created -> regression test added -> future scan scheduled. The backend
// timeline entries are objects ({step, detail}) on live runs but the contract
// also allows plain strings, so both shapes are normalized here.
export function SelfRefinementTimeline({
  refinement,
  className,
}: SelfRefinementTimelineProps) {
  const steps = normalize(refinement);
  if (steps.length === 0) {
    return (
      <p className="mono text-xs text-faint">No self-refinement recorded.</p>
    );
  }
  return (
    <m.ol
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className={cn("flex flex-col gap-3", className)}
    >
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <m.li key={i} variants={fadeUp} className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-hairline-strong bg-white/[.08]">
                <Sparkles className="h-3.5 w-3.5 text-ink" strokeWidth={1.7} />
              </span>
              <div className="pt-0.5">
                <div className="text-[13.5px] font-semibold tracking-tight text-ink">
                  {step.label}
                </div>
                {step.detail && (
                  <p className="mono mt-0.5 text-[11.5px] leading-relaxed text-muted">
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
            {!last && (
              <ArrowDown
                className="ml-[14px] h-3.5 w-3.5 text-faint"
                strokeWidth={1.8}
              />
            )}
          </m.li>
        );
      })}
    </m.ol>
  );
}

function normalize(refinement: SelfRefinement): TimelineStep[] {
  const timeline = refinement.timeline;
  if (Array.isArray(timeline) && timeline.length > 0) {
    return timeline.map((entry) => {
      if (typeof entry === "string") {
        return { label: humanize(entry), detail: "" };
      }
      const obj = entry as { step?: string; detail?: string };
      return {
        label: humanize(obj.step ?? "step"),
        detail: obj.detail ?? "",
      };
    });
  }
  // Fall back to assembling from the discrete fields.
  const steps: TimelineStep[] = [];
  if (refinement.finding_accepted) {
    steps.push({ label: "Finding accepted", detail: "" });
  }
  if (refinement.pattern) {
    steps.push({ label: "Pattern extracted", detail: refinement.pattern });
  }
  if (refinement.rule_id) {
    steps.push({ label: "Rule created", detail: refinement.rule_id });
  }
  if (refinement.regression_scenario_id) {
    steps.push({
      label: "Regression test added",
      detail: refinement.regression_scenario_id,
    });
  }
  return steps;
}
