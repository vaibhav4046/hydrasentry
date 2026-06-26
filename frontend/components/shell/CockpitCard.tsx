"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared flat-cockpit primitives, extending the design language established on
 * the Command page (app/mission/page.tsx). Every remaining dashboard surface
 * composes these so the card border/radius/background, the tiny-uppercase label
 * style, the number/type scale, and the spacing rhythm stay identical across the
 * cockpit. Monochrome only, emphasis is white/silver at varying opacity,
 * hairline borders, scale contrast, and tiny mono labels. No hue.
 */

interface CockpitCardProps {
  /** Render a faint hover lift (border + fill brighten). Off for static panels. */
  hover?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * The flat hairline card. The cockpit's single surface primitive, replaces the
 * glassy landing GlassPanel on dashboard bodies. Default padding is left to the
 * caller (pass p-5 / p-6) so cards match Command's spacing per context.
 */
export function CockpitCard({ hover, className, children }: CockpitCardProps) {
  return (
    <div
      className={cn("cockpit-card", hover && "cockpit-card-hover", className)}
    >
      {children}
    </div>
  );
}

interface CockpitSectionLabelProps {
  /** Tiny uppercase eyebrow, e.g. "BEHAVIOR DIFF". */
  children: ReactNode;
  /** Optional right-aligned mono meta (e.g. a filename or count). */
  meta?: ReactNode;
  className?: string;
}

/**
 * The Command-page section header: a tiny uppercase eyebrow, optionally paired
 * with a dim mono meta line on the right (mirrors "mission_control.log" /
 * "8 standing" on Command). Use at the top of a card to title its content.
 */
export function CockpitSectionLabel({
  children,
  meta,
  className,
}: CockpitSectionLabelProps) {
  if (!meta) {
    return <div className={cn("cockpit-eyebrow", className)}>{children}</div>;
  }
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="cockpit-eyebrow">{children}</div>
      <span className="mono text-[10px] uppercase tracking-[0.14em] text-faint">
        {meta}
      </span>
    </div>
  );
}

interface CockpitFieldProps {
  /** Tiny uppercase key, e.g. "next run". */
  label: ReactNode;
  /** The value. */
  value: ReactNode;
  /** Render the value in the mono face (for ids, urls, timestamps, models). */
  mono?: boolean;
  className?: string;
}

/**
 * A label/value row, tiny uppercase key on the left, value on the right.
 * Matches the field rhythm used across the cockpit's detail cards. Pass
 * `mono` for ids, query_paths, model ids, base urls, and timestamps.
 */
export function CockpitField({
  label,
  value,
  mono,
  className,
}: CockpitFieldProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <dt className="cockpit-eyebrow">{label}</dt>
      <dd
        className={cn(
          "max-w-[62%] truncate text-right text-[12px] text-ink/90",
          mono && "mono",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

type PillTone = "neutral" | "bright";

interface CockpitPillProps {
  /** Pill text, kept short, rendered uppercase mono. */
  label: ReactNode;
  /** Optional leading icon node. */
  icon?: ReactNode;
  /** "bright" reads as notable/critical (brighter border + fill), never hue. */
  tone?: PillTone;
  /** Pulsing dot affordance (e.g. running/scanning). */
  pulse?: boolean;
  /** Show a leading status dot. */
  dot?: boolean;
  className?: string;
}

/**
 * Cockpit status pill, mirrors the top-bar CockpitStatusPill. Monochrome:
 * severity is shown via brightness, border weight, and label, never hue. A
 * `bright` tone marks notable/critical state; `pulse` animates the dot.
 */
export function CockpitPill({
  label,
  icon,
  tone = "neutral",
  pulse,
  dot,
  className,
}: CockpitPillProps) {
  const bright = tone === "bright";
  return (
    <span
      className={cn(
        "mono inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10.5px] uppercase tracking-[0.14em]",
        bright
          ? "border-white/45 bg-white/[.08] text-ink"
          : "border-white/15 bg-white/[.04] text-muted",
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            pulse
              ? "bg-white animate-pulse"
              : bright
                ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                : "bg-white/55",
          )}
        />
      )}
      {icon}
      {label}
    </span>
  );
}
