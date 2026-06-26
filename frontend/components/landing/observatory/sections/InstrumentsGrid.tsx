"use client";

import { m } from "framer-motion";
import { FEATURES } from "../../castellan/landingData";
import { SectionMarker } from "./SectionMarker";
import { sectionContainer, mastheadLine } from "@/lib/motion";

/**
 * Instruments, the capabilities grid. Reveals on scroll with a small stagger;
 * each instrument cell is a hairline-bordered plate with a mono glyph badge.
 * Card hover brightness lives in CSS (.obs-card). Copy preserved from
 * landingData.
 */
export function InstrumentsGrid() {
  return (
    <m.section
      id="features"
      style={{ padding: "48px 0" }}
      variants={sectionContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-90px" }}
    >
      <div
        className="obs-feat-head"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: "30ch" }}>
          <SectionMarker index="02" label="INSTRUMENTS" />
          <m.h2
            variants={mastheadLine}
            className="obs-display"
            style={{
              marginTop: "18px",
              fontSize: "clamp(26px,3.4vw,42px)",
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
              fontWeight: 600,
              color: "#F3F6FB",
            }}
          >
            A full observatory,
            <br />
            not a test runner
          </m.h2>
        </div>
        <m.p
          variants={mastheadLine}
          style={{ maxWidth: "38ch", fontSize: "13px", lineHeight: 1.62, color: "#8B94A1" }}
        >
          Coordinated instruments replay, chart, block, quarantine, verify,
          schedule, and refine, every reading reproducible.
        </m.p>
      </div>

      <m.div
        variants={mastheadLine}
        className="obs-grid-3"
        style={{
          marginTop: "30px",
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: "1px",
          background: "rgba(234,240,250,0.07)",
          border: "1px solid rgba(234,240,250,0.07)",
        }}
      >
        {FEATURES.map((c) => (
          <div
            key={c.icon}
            className="obs-card"
            style={{ padding: "26px 22px", background: "rgba(4,5,6,0.92)", minHeight: "180px" }}
          >
            <div
              className="mono"
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "2px",
                display: "grid",
                placeItems: "center",
                border: "1px solid rgba(234,240,250,0.2)",
                color: "#EAF0FA",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              {c.icon}
            </div>
            <div style={{ marginTop: "18px", fontSize: "15.5px", fontWeight: 600, color: "#F3F6FB" }}>
              {c.title}
            </div>
            <div style={{ marginTop: "8px", fontSize: "12.5px", lineHeight: 1.55, color: "#8B94A1" }}>
              {c.desc}
            </div>
          </div>
        ))}
      </m.div>
    </m.section>
  );
}
