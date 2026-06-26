"use client";

import { m } from "framer-motion";
import type { Variants } from "framer-motion";
import { mastheadLine } from "@/lib/motion";

/**
 * A small-caps coordinate section marker with a leading index + hairline rule.
 * The hairline draws from zero width as it enters (scaleX), giving each section
 * a precise instrument-like "registration" tick before its content reveals.
 * Used as the first child inside a RevealSection container so it sequences with
 * the heading via the shared "hidden"/"show" variants (no self-contained
 * whileInView observer, which could miss an already-in-view hash-load).
 */
const markerRule: Variants = {
  hidden: { scaleX: 0 },
  show: {
    scaleX: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 },
  },
};

export function SectionMarker({ index, label }: { index: string; label: string }) {
  return (
    <m.div
      variants={mastheadLine}
      style={{ display: "flex", alignItems: "center", gap: "14px" }}
    >
      <span
        className="mono"
        style={{ fontSize: "10px", letterSpacing: "0.1em", color: "#5F6875" }}
      >
        {index}
      </span>
      <m.span
        aria-hidden
        variants={markerRule}
        style={{
          width: "22px",
          height: "1px",
          background: "rgba(234,240,250,0.22)",
          transformOrigin: "left center",
        }}
      />
      <span
        className="mono"
        style={{ fontSize: "10px", letterSpacing: "0.26em", color: "#9BA3AF" }}
      >
        {label}
      </span>
    </m.div>
  );
}
