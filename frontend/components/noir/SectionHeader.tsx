"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/cn";
import { fadeUp, staggerContainer } from "@/lib/motion";

interface SectionHeaderProps {
  kicker?: string;
  title: string;
  description?: string;
  /** Center the block (default left). */
  align?: "left" | "center";
  className?: string;
}

/**
 * Kicker (mono uppercase) + display title + optional description. Animates in
 * on scroll via the shared fadeUp/stagger variants. Use to open every major
 * section so rhythm and type scale stay consistent.
 */
export function SectionHeader({
  kicker,
  title,
  description,
  align = "left",
  className,
}: SectionHeaderProps) {
  return (
    <m.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className={cn(
        "flex max-w-2xl flex-col gap-4",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      {kicker && (
        <m.span
          variants={fadeUp}
          className="mono text-[11px] uppercase tracking-[0.24em] text-muted"
        >
          {kicker}
        </m.span>
      )}
      <m.h2
        variants={fadeUp}
        className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl md:text-[2.75rem] md:leading-[1.05]"
      >
        {title}
      </m.h2>
      {description && (
        <m.p
          variants={fadeUp}
          className="text-pretty text-base leading-relaxed text-muted"
        >
          {description}
        </m.p>
      )}
    </m.div>
  );
}
