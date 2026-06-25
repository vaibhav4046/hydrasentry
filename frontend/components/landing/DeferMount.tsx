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
  // Start hidden on BOTH the server and the first client paint so the hydrated
  // markup matches exactly (no React #418). The placeholder reserves height to
  // keep CLS at 0. After mount we either reveal immediately (no
  // IntersectionObserver support) or observe and reveal on approach — both run
  // post-hydration so they never diverge from the server render.
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    // No IntersectionObserver (old browsers / test envs): reveal on the next
    // tick. Scheduling via a timer keeps the reveal out of the effect's
    // synchronous body and still runs entirely post-hydration.
    if (typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setShow(true), 0);
      return () => clearTimeout(id);
    }
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
