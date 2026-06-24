"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/cn";

export interface SegmentOption {
  value: string;
  label: string;
  hint?: string;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Monochrome segmented control. The active segment is lit with a sliding white
 * glass pill (shared layoutId) so selection animates between options. Used for
 * the autonomy mode picker. Severity-neutral by design.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-xl border border-hairline bg-white/[.03] p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            title={option.hint}
            className={cn(
              "relative rounded-lg px-4 py-1.5 text-[13px] font-semibold tracking-tight transition",
              "outline-none focus-visible:ring-2 focus-visible:ring-white/70",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <m.span
                layoutId={`seg-${ariaLabel}`}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 -z-10 rounded-lg border border-hairline-strong bg-white/[.1]"
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
