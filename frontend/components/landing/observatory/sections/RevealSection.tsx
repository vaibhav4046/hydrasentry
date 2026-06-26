"use client";

/**
 * Hash-load-safe scroll reveal for the Observatory below-the-fold sections.
 *
 * WHY THIS EXISTS: the sections previously used framer-motion's `whileInView`
 * with `initial="hidden"` (opacity:0). That has two failure modes that show as a
 * BLANK black section:
 *   1. Direct nav to a hash (e.g. /#flow, /#architecture) lands the target
 *      section already in the viewport. The IntersectionObserver behind
 *      whileInView attaches AFTER hydration; the scroll-into-view fires before
 *      it, so the observer can miss the already-in-view element and the section
 *      stays at opacity:0 forever.
 *   2. Under prefers-reduced-motion the variants still gate visibility on the
 *      observer firing, so an above-the-fold section can stay hidden.
 *
 * FIX (same class as the hero's initial-visible fix): drive `animate` from a
 * boolean that is TRUE on first commit when the section is already in view OR
 * reduced motion is on, and otherwise flips to TRUE the moment the section
 * scrolls into view. `initial={false}` makes the first paint render whatever
 * `animate` resolves to (no hidden flash for already-in-view content), so the
 * section is never stuck invisible. Sections further down still animate in on
 * scroll exactly as before.
 *
 * Children opt into the staggered choreography by using variant names "hidden"
 * / "show" (e.g. `mastheadLine`), identical to the previous markup, so callers
 * change only the wrapper element, not their inner motion children.
 */
import { useEffect, useRef, useState } from "react";
import { m, useInView } from "framer-motion";
import type { Variants } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { sectionContainer } from "@/lib/motion";

interface RevealSectionProps {
  id?: string;
  className?: string;
  style?: CSSProperties;
  /** Container variants (defaults to the shared staggered sectionContainer). */
  variants?: Variants;
  /** Observer trigger margin (matches the old viewport.margin). */
  margin?: string;
  children: ReactNode;
}

export function RevealSection({
  id,
  className,
  style,
  variants = sectionContainer,
  margin = "-90px",
  children,
}: RevealSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  // `once` so it never re-hides; the margin matches the previous whileInView.
  const inView = useInView(ref, {
    once: true,
    margin: margin as never,
  });

  // Mounted flag: lets us also reveal anything that is ALREADY in the viewport
  // on the very first client commit (the hash-load case), which the observer
  // can otherwise miss. useInView reports this on mount in modern framer, but we
  // belt-and-brace it with a post-mount in-viewport check so a missed observer
  // can never leave the section invisible.
  const [mountedInView, setMountedInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < vh && r.bottom > 0) setMountedInView(true);
  }, []);

  const show = reduce || inView || mountedInView;

  return (
    <m.section
      ref={ref}
      id={id}
      className={className}
      style={style}
      variants={variants}
      initial={false}
      animate={show ? "show" : "hidden"}
    >
      {children}
    </m.section>
  );
}
