"use client";

import { m } from "framer-motion";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { StatusPill } from "@/components/noir/StatusPill";
import { cn } from "@/lib/cn";
import type { ReplayResult } from "@/lib/types";

interface ReplayCardProps {
  variant: "baseline" | "poisoned";
  result: ReplayResult;
  className?: string;
}

// One side of the replay comparison. Baseline reads calm and dim; poisoned reads
// bright with a heavy border and a hazard glyph. The verdict drives a StatusPill
// tone (brightness, never hue). Retrieved chunk ids render in mono; the injected
// poison chunk on the compromised side is emphasized.
export function ReplayCard({ variant, result, className }: ReplayCardProps) {
  const compromised = variant === "poisoned";
  const Icon = compromised ? ShieldAlert : ShieldCheck;
  return (
    <m.div
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassPanel
        className={cn(
          "flex h-full flex-col gap-4 p-5",
          compromised ? "border-white/55 bg-white/[.07]" : "border-hairline",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "grid h-9 w-9 place-items-center rounded-lg border",
                compromised
                  ? "border-white/60 bg-white/[.1]"
                  : "border-hairline bg-white/[.04]",
              )}
            >
              <Icon className="h-4 w-4 text-ink" strokeWidth={1.7} />
            </span>
            <div>
              <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                {compromised ? "poisoned context" : "clean context"}
              </div>
              <div className="text-[15px] font-semibold tracking-tight text-ink">
                {compromised ? "Poisoned replay" : "Baseline replay"}
              </div>
            </div>
          </div>
          <StatusPill
            tone={compromised ? "critical" : "safe"}
            label={result.verdict}
          />
        </div>

        <p
          className={cn(
            "rounded-lg border p-3.5 text-[13.5px] leading-relaxed",
            compromised
              ? "border-white/30 bg-black/30 text-ink"
              : "border-hairline bg-black/20 text-muted",
          )}
        >
          {result.answer}
        </p>

        <div className="mt-auto">
          <div className="mono mb-1.5 text-[10.5px] uppercase tracking-[0.16em] text-faint">
            retrieved chunks
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.retrieved_chunk_ids.map((id) => {
              const poison = id.toLowerCase().includes("poison");
              return (
                <span
                  key={id}
                  className={cn(
                    "mono rounded border px-1.5 py-0.5 text-[10.5px]",
                    poison
                      ? "border-white/60 bg-white/[.1] text-ink"
                      : "border-hairline text-muted",
                  )}
                >
                  {id}
                </span>
              );
            })}
          </div>
        </div>
      </GlassPanel>
    </m.div>
  );
}
