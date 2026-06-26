"use client";

import { m } from "framer-motion";
import { ARCH_STAGES } from "../../castellan/landingData";
import { SectionMarker } from "./SectionMarker";
import { sectionContainer, mastheadLine, EASE_OUT_EXPO } from "@/lib/motion";

/**
 * Reduction method, the architecture as a five-stage deterministic loop. As it
 * enters, the heading reveals, the top rule draws left-to-right (scaleX), and
 * the stage columns fade/rise in sequence; the final node glows (the evidence).
 */
export function ReductionMethod() {
  return (
    <m.section
      id="architecture"
      style={{ padding: "52px 0 24px" }}
      variants={sectionContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-90px" }}
    >
      <SectionMarker index="03" label="REDUCTION METHOD" />
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

      <div style={{ position: "relative", marginTop: "30px" }}>
        {/* top rule draws across as the section enters */}
        <m.span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: "rgba(234,240,250,0.1)",
            transformOrigin: "left center",
          }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: "-90px" }}
          transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.1 }}
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
    </m.section>
  );
}
