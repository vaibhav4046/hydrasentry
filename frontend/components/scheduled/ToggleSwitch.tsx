"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/cn";

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}

// Monochrome on/off switch. Enabled = bright filled track + knob pushed right;
// disabled state dims. The knob slides with a spring-free tween to stay on the
// house easing. Severity-neutral by design.
export function ToggleSwitch({
  enabled,
  onToggle,
  label,
  disabled,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition",
        "outline-none focus-visible:ring-2 focus-visible:ring-white/70",
        enabled
          ? "border-white/60 bg-white/[.18]"
          : "border-hairline bg-white/[.03]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <m.span
        animate={{ x: enabled ? 22 : 3 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "h-4 w-4 rounded-full",
          enabled ? "bg-white" : "bg-white/50",
        )}
      />
    </button>
  );
}
