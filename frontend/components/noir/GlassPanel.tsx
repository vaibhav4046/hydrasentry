import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Use the stronger glass fill (for elevated/foreground panels). */
  strong?: boolean;
  /** Optional forwarded ref (React 19 lets ref be a plain prop). */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Frosted white-on-black surface with a top hairline highlight. The base
 * building block for every card/panel in the app. Spreads through className
 * and all div props; pass `strong` for elevated surfaces. Accepts a `ref`.
 */
export function GlassPanel({
  className,
  strong = false,
  ref,
  ...props
}: GlassPanelProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "hydra-glass rounded-xl2",
        strong && "bg-white/[.085]",
        className,
      )}
      {...props}
    />
  );
}
