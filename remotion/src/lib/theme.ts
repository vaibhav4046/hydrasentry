/**
 * HydraSentry noir theme tokens.
 * Mirrors docs/assets/hydrasentry_ui_assets/tokens/tokens.css (--hs-* palette).
 * Strict monochrome: black backgrounds, white text, grayscale "states".
 */

export const COLORS = {
  bgBase: "#050608",
  bgDeep: "#020305",
  bgPanel: "#0B0D10",
  bgElevated: "#11141A",
  glass: "rgba(255,255,255,0.055)",
  glassStrong: "rgba(255,255,255,0.085)",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.18)",
  textPrimary: "#F5F7FA",
  textSecondary: "#9CA3AF",
  textMuted: "#5F6875",
  white: "#FFFFFF",
  black: "#000000",
  // Risk "states" are expressed purely as white intensity, never colour.
  danger: "#F5F7FA",
  safe: "#D7DCE5",
  warning: "#B7BEC9",
  markSecondary: "#AEB4BE",
} as const;

export const FONTS = {
  // System-stack sans + mono so the bundle renders without external font fetches.
  sans: '"Inter", "Geist", "Segoe UI", system-ui, Arial, sans-serif',
  mono: '"JetBrains Mono", "Geist Mono", "SFMono-Regular", "Consolas", "Liberation Mono", monospace',
} as const;

// Cinematic easing pulled from the product's framer-motion variants.
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 2250, // 75s @ 30fps
} as const;

// Spring config used across scenes for a controlled, non-bouncy feel.
export const SOFT_SPRING = {
  damping: 200,
  mass: 0.6,
  stiffness: 120,
} as const;

export const POP_SPRING = {
  damping: 14,
  mass: 0.5,
  stiffness: 140,
} as const;
