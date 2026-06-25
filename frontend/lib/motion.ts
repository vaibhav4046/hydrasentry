/**
 * Shared Framer Motion variants for Constellan.
 *
 * House style: slow, cinematic, never bouncy. Durations 0.45–0.8s,
 * ease [0.22, 1, 0.36, 1]. Reveal motion leans on opacity + small y +
 * blur so it reads as "surfacing from the dark" rather than sliding.
 *
 * Usage (scroll reveal):
 *   <motion.div variants={fadeUp} initial="hidden" whileInView="show"
 *     viewport={{ once: true, margin: "-80px" }} />
 *
 * Usage (staggered list): put `staggerContainer` on the parent and a
 * child variant (e.g. `fadeUp`) on each item.
 */
import type { Variants, Transition } from "framer-motion";

export const EASE_OUT_EXPO: Transition["ease"] = [0.22, 1, 0.36, 1];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: EASE_OUT_EXPO },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: EASE_OUT_EXPO } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.985 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.65, ease: EASE_OUT_EXPO },
  },
};

export const blurReveal: Variants = {
  hidden: { opacity: 0, filter: "blur(14px)" },
  show: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: EASE_OUT_EXPO },
  },
};

/** Hover-only variant for interactive panels. Drive with whileHover="hover". */
export const panelHover: Variants = {
  rest: { scale: 1, borderColor: "rgba(255,255,255,0.10)" },
  hover: {
    scale: 1.012,
    borderColor: "rgba(255,255,255,0.22)",
    transition: { duration: 0.25, ease: EASE_OUT_EXPO },
  },
};

/** Slow breathing glow for "live"/active indicators. Use animate="pulse". */
export const glowPulse: Variants = {
  rest: { opacity: 0.55 },
  pulse: {
    opacity: [0.45, 1, 0.45],
    transition: { duration: 2.4, ease: "easeInOut", repeat: Infinity },
  },
};

/** Stroke-dash reveal for SVG graph edges. Apply to <motion.path>. */
export const graphEdgeReveal: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.9, ease: EASE_OUT_EXPO },
  },
};

/**
 * Risk count-up easing for animated numerics. The numeric tween itself is
 * driven by the component (animate/useMotionValue); this exports the shared
 * transition so all counters feel identical.
 */
export const riskCountUp: Transition = {
  duration: 1.1,
  ease: EASE_OUT_EXPO,
};

/** Per-line terminal reveal. Stagger with `staggerContainer` on the parent. */
export const terminalLineReveal: Variants = {
  hidden: { opacity: 0, x: -6 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.45, ease: EASE_OUT_EXPO },
  },
};

/**
 * Seamless horizontal marquee. The track holds two identical halves; this
 * translates the whole track by exactly -50% so the loop is invisible. Drive
 * with `animate="run"` on a track whose width is 2x its content. Reduced-motion
 * callers should simply not apply this (render a static, centered row instead).
 */
export const marqueeTrack: Variants = {
  run: {
    x: ["0%", "-50%"],
    transition: { duration: 32, ease: "linear", repeat: Infinity },
  },
};

/**
 * Larger lift + glow for premium feature cards. Pair with the
 * `.hydra-border-sweep` CSS utility so the silver border-sweep runs while the
 * card rises. GPU-only (transform), border handled in CSS.
 */
export const cardLift: Variants = {
  rest: { y: 0 },
  hover: { y: -6, transition: { duration: 0.4, ease: EASE_OUT_EXPO } },
};

/**
 * Pipeline node pop-in. Sequence nodes left-to-right by putting
 * `staggerContainer` (or a wider-gap container) on the parent SVG/flex wrapper.
 */
export const nodePopIn: Variants = {
  hidden: { opacity: 0, scale: 0.9, filter: "blur(4px)" },
  show: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
};

/** Wider-gap stagger for diagram/bento sequences that should feel deliberate. */
export const staggerWide: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.06 } },
};
