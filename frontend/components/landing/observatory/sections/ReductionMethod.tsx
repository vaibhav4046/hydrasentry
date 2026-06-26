"use client";

import { m } from "framer-motion";
import type { Variants } from "framer-motion";
import { ARCH_STAGES } from "../../castellan/landingData";
import { SectionMarker } from "./SectionMarker";
import { RevealSection } from "./RevealSection";
import { mastheadLine, EASE_OUT_EXPO } from "@/lib/motion";

/**
 * Reduction method, the architecture as a five-stage deterministic loop. As it
 * enters, the heading reveals, the top rule draws left-to-right (scaleX), and
 * the stage columns fade/rise in sequence; the final node glows (the evidence).
 * Wrapped in RevealSection so a direct /#architecture hash-load (or reduced
 * motion) shows it immediately instead of a blank section.
 */
const topRule: Variants = {
  hidden: { scaleX: 0 },
  show: {
    scaleX: 1,
    transition: { duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.1 },
  },
};

export function ReductionMethod() {
  return (
    <RevealSection id="architecture" style={{ padding: "52px 0 24px" }}>
      <SectionMarker index="03" label="THE METHOD" />
      <m.h2
        variants={mastheadLine}
        className="obs-display"
        style={{
          marginTop: "18px",
          maxWidth: "20ch",
          fontSize: "clamp(24px,3.2vw,38px)",
          lineHeight: 1.04,
          letterSpacing: "-0.025em",
          fontWeight: 600,
          color: "#F3F6FB",
        }}
      >
        From task to evidence in one deterministic loop
      </m.h2>
      <m.p
        variants={mastheadLine}
        style={{
          marginTop: "14px",
          maxWidth: "48ch",
          fontSize: "13.5px",
          lineHeight: 1.6,
          color: "#8B94A1",
        }}
      >
        Every accepted finding becomes a regression rule, so the same poisoned
        memory can never reach the agent twice.
      </m.p>

      <div style={{ position: "relative", marginTop: "30px" }}>
        {/* top rule draws across as the section enters (variant-driven so it
            reveals with the section even on an already-in-view hash-load) */}
        <m.span
          aria-hidden
          variants={topRule}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: "rgba(234,240,250,0.1)",
            transformOrigin: "left center",
          }}
        />
        <div
          className="obs-method"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5,1fr)",
            gap: "0",
          }}
        >
          {ARCH_STAGES.map((a, i) => (
            <m.div
              key={a.n}
              variants={mastheadLine}
              className="obs-method-col"
              style={{
                padding: "22px 18px 22px 0",
                borderLeft: i === 0 ? "none" : "1px solid rgba(234,240,250,0.07)",
                paddingLeft: i === 0 ? 0 : "18px",
                position: "relative",
              }}
            >
              {/* node tick on the top rule */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: "-4px",
                  left: i === 0 ? 0 : "18px",
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: i === ARCH_STAGES.length - 1 ? "#fff" : "#5F6875",
                  boxShadow: i === ARCH_STAGES.length - 1 ? "0 0 8px #fff" : "none",
                }}
              />
              <div className="mono" style={{ fontSize: "10px", color: "#5F6875", letterSpacing: "0.08em" }}>
                {a.n}
              </div>
              <div style={{ marginTop: "10px", fontSize: "14px", fontWeight: 600, color: "#F3F6FB" }}>
                {a.title}
              </div>
              <div style={{ marginTop: "6px", fontSize: "11.5px", lineHeight: 1.5, color: "#8B94A1" }}>
                {a.desc}
              </div>
            </m.div>
          ))}
        </div>
      </div>
    </RevealSection>
  );
}
