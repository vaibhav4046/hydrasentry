"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface DeferMountProps {
  /** Render the children only once the placeholder scrolls near the viewport. */
  children: ReactNode;
  /** Root margin for the observer — start mounting this far before it's visible. */
  rootMargin?: string;
  /** Reserve vertical space so deferring doesn't cause layout shift / scrollbar jump. */
  minHeight?: number;
  className?: string;
}

/**
 * Defers mounting (and therefore hydration + chunk evaluation) of a below-the-fold
 * landing section until it approaches the viewport. The landing page statically
 * imported ten "use client" sections that all hydrated on load, producing a long-
 * task storm (measured ~2.4s of long tasks / 1.4s TBT under 6x CPU throttle).
 *
 * Each deferred section is paired with next/dynamic so its JS chunk is also only
 * fetched on demand. A spacer of `minHeight` holds layout so CLS stays 0 and the
 * scrollbar doesn't jump. Once mounted it stays mounted (one-shot).
 */
export function DeferMount({
  children,
  rootMargin = "600px 0px",
  minHeight = 480,
  className,
}: DeferMountProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  // If IntersectionObserver is unavailable (SSR / very old browsers) render
  // immediately — computed in the initializer so we never call setState
  // synchronously inside the effect.
  const [show, setShow] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show, rootMargin]);

  return (
    <div ref={ref} className={className} style={show ? undefined : { minHeight }}>
      {show ? children : null}
    </div>
  );
}
