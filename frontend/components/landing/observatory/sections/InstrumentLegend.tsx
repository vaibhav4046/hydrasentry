"use client";

import { m } from "framer-motion";
import { PRIMITIVES } from "../../castellan/landingData";
import { SectionMarker } from "./SectionMarker";
import { RevealSection } from "./RevealSection";
import { mastheadLine } from "@/lib/motion";

/**
 * Instrument legend, the product primitives rendered as an engraved atlas
 * legend (a hairline-bordered grid where the 1px gap shows the void through).
 * Reveals on scroll via RevealSection (hash-load-safe: visible-on-mount when
 * already in view or under reduced motion). Card hover brightness lives in CSS
 * (.obs-card). Copy is preserved verbatim from landingData.
 */
export function InstrumentLegend() {
  return (
    <RevealSection id="product" style={{ padding: "72px 0 28px" }}>
      <SectionMarker index="00" label="WHAT HYDRASENTRY DOES" />
      <m.p
        variants={mastheadLine}
        style={{
          marginTop: "18px",
          maxWidth: "52ch",
          fontSize: "15px",
          lineHeight: 1.5,
          color: "#C9D2E0",
          fontWeight: 500,
        }}
      >
        Replay the attack. Trace the path. Block the action. Certify the fix.{" "}
        <span style={{ color: "#8B94A1", fontWeight: 400 }}>
          Graph-native proof, not prompt vibes.
        </span>
      </m.p>
      <m.div
        variants={mastheadLine}
        className="obs-grid-4"
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: "1px",
          background: "rgba(234,240,250,0.07)",
          border: "1px solid rgba(234,240,250,0.07)",
        }}
      >
        {PRIMITIVES.map((p, i) => (
          <div
            key={p.tag}
            className="obs-card"
            style={{ padding: "22px 18px", background: "rgba(4,5,6,0.92)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: "11.5px", color: "#EAF0FA", letterSpacing: "0.02em" }}
              >
                {p.tag}
              </span>
              <span className="mono" style={{ fontSize: "9px", color: "#5F6875" }}>
                {String.fromCharCode(945 + i)}
              </span>
            </div>
            <div style={{ marginTop: "12px", fontSize: "13.5px", fontWeight: 600, color: "#F3F6FB" }}>
              {p.title}
            </div>
            <div style={{ marginTop: "6px", fontSize: "12px", lineHeight: 1.5, color: "#8B94A1" }}>
              {p.desc}
            </div>
          </div>
        ))}
      </m.div>
    </RevealSection>
  );
}
