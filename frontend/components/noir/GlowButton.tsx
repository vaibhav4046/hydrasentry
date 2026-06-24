"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export type GlowButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type GlowButtonSize = "sm" | "md" | "lg";

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlowButtonVariant;
  size?: GlowButtonSize;
  /** Optional leading icon node. */
  iconLeft?: ReactNode;
  /** Optional trailing icon node. */
  iconRight?: ReactNode;
}

const SIZE: Record<GlowButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

const VARIANT: Record<GlowButtonVariant, string> = {
  primary: "hydra-button-primary",
  secondary: "hydra-button-secondary",
  ghost: "hydra-button-ghost",
  danger: "hydra-button-danger",
};

/**
 * The single button primitive. Monochrome only — `danger` is dark glass with a
 * bright white outline and a warning glyph, never a saturated red. Renders a
 * native <button>; forwards ref and all button props.
 */
export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  function GlowButton(
    {
      className,
      variant = "primary",
      size = "md",
      iconLeft,
      iconRight,
      children,
      ...props
    },
    ref,
  ) {
    const showDangerGlyph = variant === "danger" && !iconLeft;
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight",
          "outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-base",
          "disabled:cursor-not-allowed disabled:opacity-50",
          SIZE[size],
          VARIANT[variant],
          className,
        )}
        {...props}
      >
        {showDangerGlyph ? (
          <ShieldAlert className="h-4 w-4" strokeWidth={1.8} />
        ) : (
          iconLeft
        )}
        {children}
        {iconRight}
      </button>
    );
  },
);
