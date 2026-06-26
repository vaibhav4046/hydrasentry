"use client";

import type { ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { EASE_OUT_EXPO } from "@/lib/motion";

interface GraphNodeLabelProps {
  /** Lucide icon node (already sized by the caller, or defaulted here). */
  icon: ReactNode;
  title: string;
  /** Optional secondary line (e.g. a chunk id or score). */
  sub?: string;
  /** Tainted variant = white-hot ring + pulse halo. */
  tainted?: boolean;
  /** Run the entrance + (for tainted) pulse loop (default true). */
  animate?: boolean;
  /** Entrance delay in seconds when animated. */
  delay?: number;
  /** Text/label side relative to the badge (default right). */
  align?: "left" | "right";
  onClick?: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  className?: string;
}

/**
 * Circular glass node badge + its text label, the connected "context node"
 * around the artifact tree. Hover raises + glows; the tainted variant gets a
 * white-hot ring and a slow pulsing halo (danger = intensity, never hue).
 * Reusable by ArtifactTreeGraph and any graph surface that needs labelled nodes.
 */
export function GraphNodeLabel({
  icon,
  title,
  sub,
  tainted = false,
  animate: shouldAnimate = true,
  delay = 0,
  align = "right",
  onClick,
  onHoverStart,
  onHoverEnd,
  className,
}: GraphNodeLabelProps) {
  const prefersReduced = useReducedMotion();
  const isAnimated = shouldAnimate && !prefersReduced;
  const interactive = Boolean(onClick);

  return (
    <m.div
      className={cn(
        "group inline-flex items-center gap-2.5",
        align === "left" && "flex-row-reverse text-right",
        interactive && "cursor-pointer",
        className,
      )}
      initial={isAnimated ? { opacity: 0, scale: 0.86 } : false}
      animate={isAnimated ? { opacity: 1, scale: 1 } : undefined}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay }}
      whileHover={{ y: -2 }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {/* badge */}
      <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
        {/* pulse halo (tainted only) */}
        {isAnimated && tainted && (
          <m.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.6)" }}
            animate={{ opacity: [0.25, 0.7, 0.25], scale: [1, 1.18, 1] }}
            transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-full w-full items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300",
            tainted
              ? "border-white/70 bg-white/[.1] text-ink shadow-[0_0_24px_rgba(255,255,255,0.42)]"
              : "border-hairline-strong bg-white/[.05] text-ink/80 shadow-[0_0_18px_rgba(255,255,255,0.1)] group-hover:border-white/45 group-hover:text-ink group-hover:shadow-[0_0_26px_rgba(255,255,255,0.28)]",
          )}
        >
          {icon}
        </span>
      </span>

      {/* label */}
      <span className="flex min-w-0 flex-col leading-tight">
        <span
          className={cn(
            "mono text-[10.5px] font-medium uppercase tracking-[0.13em]",
            tainted ? "text-ink" : "text-ink/85",
          )}
        >
          {title}
        </span>
        {sub && (
          <span className="mt-0.5 max-w-[15rem] truncate text-[11px] leading-snug text-faint">
            {sub}
          </span>
        )}
      </span>
    </m.div>
  );
}
