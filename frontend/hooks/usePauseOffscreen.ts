"use client";

import { useEffect, useRef } from "react";

/**
 * Pauses perpetual CSS animations inside a host element when it is scrolled out
 * of view OR the tab is hidden. Sets `data-anim="on" | "off"` on the ref'd
 * element; the global CSS rule `[data-anim="off"] .atg-ember { animation-play-
 * state: paused }` (and siblings) then stops the compositor doing per-frame work
 * for content nobody can see — the marquee strip, ember twinkle, traveling dash.
 *
 * Returns a ref to attach to the animation host. One IntersectionObserver per
 * host; cleaned up on unmount. rootMargin keeps motion alive slightly past the
 * edges so re-entry never shows a frozen frame.
 */
export function usePauseOffscreen<T extends HTMLElement = HTMLDivElement>(
  rootMargin = "120px 0px",
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let onScreen = true;

    const apply = () => {
      const active = onScreen && !document.hidden;
      el.dataset.anim = active ? "on" : "off";
    };

    apply();

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          onScreen = entries.some((e) => e.isIntersecting);
          apply();
        },
        { rootMargin },
      );
      io.observe(el);
    }

    const onVis = () => apply();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [rootMargin]);

  return ref;
}
