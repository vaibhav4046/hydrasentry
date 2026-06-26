"use client";

/**
 * Hydration-safe reduced-motion read.
 *
 * WHY: framer-motion's useReducedMotion() reads the live
 * `(prefers-reduced-motion: reduce)` match synchronously into useState on the
 * FIRST client render. The server has no matchMedia, so it renders with the
 * preference as `null` (the animated branch). When the visitor has Reduced
 * Motion ON, the client's first render therefore disagrees with the server
 * HTML, and any component that branches its rendered DOM/inline-style on the
 * value throws React hydration error #418 ("Hydration failed").
 *
 * FIX: useSyncExternalStore with a server snapshot of `false`. The first client
 * render uses the SAME value the server emitted (matching markup, no mismatch),
 * then the store settles to the live preference on the next commit and stays in
 * sync via the matchMedia change listener. This is the React-recommended
 * external-store pattern (same shape as hooks/useDemoMode.ts) and avoids the
 * set-state-in-effect lint of a mount-flag approach.
 *
 * Use this anywhere the reduced-motion value affects RENDERED OUTPUT (variant
 * names that change initial style attributes, conditional elements, text). For
 * effect-only reads, the plain framer-motion hook is fine.
 */
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/** Server + first-paint snapshot is always false so SSR markup matches. */
function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotionSafe(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
