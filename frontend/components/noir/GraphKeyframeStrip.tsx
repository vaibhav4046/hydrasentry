"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/cn";
import { MAX_STAGE, STAGE_LABELS } from "./artifactTreeData";

interface GraphKeyframeStripProps {
  /** Currently active stage 0..7. */
  activeStage: number;
  /** Click a step to scrub the ArtifactTreeGraph to that stage. */
  onScrub?: (stage: number) => void;
  className?: string;
}

// Percent labels under each step (0% .. 100% across 8 frames).
const PCTS = STAGE_LABELS.map((_, i) =>
  Math.round((i / MAX_STAGE) * 100),
);

/**
 * The 8-step keyframe strip: tiny monochrome node-tree thumbnails labelled
 * 0 INIT … 7 REPORT with a % readout. The active stage is highlighted (brighter
 * border + glow); clicking a step scrubs the ArtifactTreeGraph. A thin progress
 * rail under the row tracks the active stage. Monochrome only.
 */
export function GraphKeyframeStrip({
  activeStage,
  onScrub,
  className,
}: GraphKeyframeStripProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {STAGE_LABELS.map((label, i) => {
          const active = i === activeStage;
          const done = i < activeStage;
          const interactive = Boolean(onScrub);
          return (
            <button
              key={label}
              type="button"
              disabled={!interactive}
              onClick={() => onScrub?.(i)}
              aria-label={`Stage ${i}: ${label}`}
              aria-pressed={active}
              className={cn(
                "group flex flex-col items-center gap-1.5 rounded-lg border p-1.5 outline-none transition-all duration-300",
                active
                  ? "border-white/55 bg-white/[.07] shadow-[0_0_18px_rgba(255,255,255,0.2)]"
                  : done
                    ? "border-hairline-strong bg-white/[.03]"
                    : "border-hairline bg-transparent",
                interactive &&
                  "cursor-pointer hover:border-white/40 hover:bg-white/[.05] focus-visible:ring-2 focus-visible:ring-white/70",
                !interactive && "cursor-default",
              )}
            >
              <KeyframeThumb stage={i} active={active} done={done} />
              <span className="flex flex-col items-center leading-none">
                <span
                  className={cn(
                    "mono text-[8.5px] font-medium uppercase tracking-[0.08em]",
                    active ? "text-ink" : done ? "text-muted" : "text-faint",
                  )}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    "mono mt-0.5 text-[8px]",
                    active ? "text-muted" : "text-faint/70",
                  )}
                >
                  {PCTS[i]}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {/* progress rail */}
      <div className="relative h-px w-full overflow-hidden bg-white/[0.08]">
        <m.span
          className="absolute inset-y-0 left-0 bg-white/60"
          initial={false}
          animate={{ width: `${(activeStage / MAX_STAGE) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

// ---- tiny node-tree thumbnail per stage -------------------------------------
// A 4-node mini graph; progressively more nodes/edges light as the stage rises.
// The risky chain (right pair) goes white-hot from CONFLICT (stage 4) on.
function KeyframeThumb({
  stage,
  active,
  done,
}: {
  stage: number;
  active: boolean;
  done: boolean;
}) {
  const lit = (threshold: number) => stage >= threshold || done || active;
  const dim = "rgba(255,255,255,0.22)";
  const on = "rgba(255,255,255,0.92)";
  const hot = stage >= 4;

  return (
    <svg viewBox="0 0 40 28" className="h-7 w-full" fill="none">
      {/* trunk + branches (SEED at 1) */}
      <path
        d="M20 26 L20 16 M20 16 L11 9 M20 16 L29 9"
        stroke={lit(1) ? on : dim}
        strokeOpacity={lit(1) ? 0.8 : 0.4}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* left/safe nodes (RETRIEVE at 2) */}
      <circle cx="11" cy="9" r="2" fill={lit(2) ? on : dim} fillOpacity={lit(2) ? 0.85 : 0.4} />
      <circle cx="20" cy="16" r="1.6" fill={lit(1) ? on : dim} fillOpacity={lit(1) ? 0.85 : 0.4} />
      {/* right/risky node + edge to firewall (CONFLICT/RISK/BLOCK 4..6) */}
      <line
        x1="29"
        y1="9"
        x2="34"
        y2="18"
        stroke={hot ? on : dim}
        strokeOpacity={hot ? 0.95 : lit(3) ? 0.5 : 0.3}
        strokeWidth={hot ? 1.4 : 1}
        strokeDasharray="2 1.5"
      />
      <circle
        cx="29"
        cy="9"
        r={hot ? 2.4 : 2}
        fill={hot ? on : lit(3) ? on : dim}
        fillOpacity={hot ? 1 : lit(3) ? 0.7 : 0.4}
        style={hot ? { filter: "drop-shadow(0 0 3px rgba(255,255,255,0.9))" } : undefined}
      />
      {/* firewall / report node (BLOCK 6, REPORT 7) */}
      <rect
        x="32"
        y="16"
        width="4"
        height="4"
        rx="0.6"
        fill={lit(6) ? on : dim}
        fillOpacity={lit(6) ? 0.95 : 0.35}
        style={lit(6) ? { filter: "drop-shadow(0 0 3px rgba(255,255,255,0.8))" } : undefined}
      />
    </svg>
  );
}
