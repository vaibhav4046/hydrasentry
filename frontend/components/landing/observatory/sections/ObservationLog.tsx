"use client";

import { m } from "framer-motion";
import { FLOW_STEPS } from "../../castellan/landingData";
import { SectionMarker } from "./SectionMarker";
import { sectionContainer, mastheadLine, EASE_OUT_EXPO } from "@/lib/motion";

/**
 * Observation log — the attack flow as a transit timeline. As the section
 * enters, the heading block reveals, then a hairline draws DOWN the left edge of
 * the log (a vertical rule that scales from the top via transform — GPU only),
 * and each recorded observation row fades/rises in sequence behind it. The
 * progressive hairline is the "timeline drawing itself" the brief calls for.
 */
export function ObservationLog() {
  return (
    <m.section
      id="flow"
      style={{ padding: "60px 0 44px" }}
      variants={sectionContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-90px" }}
    >
      <div
        className="obs-flow-head"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "28px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: "30ch" }}>
          <SectionMarker index="01" label="OBSERVATION LOG" />
          <m.h2
            variants={mastheadLine}
            className="obs-display"
            style={{
              marginTop: "18px",
              fontSize: "clamp(28px,3.8vw,46px)",
              lineHeight: 1.02,
              letterSpacing: "-0.015em",
              fontWeight: 500,
              color: "#F3F6FB",
            }}
          >
            The transit of a{" "}
            <em style={{ fontStyle: "normal", fontWeight: 400, color: "#EAF0FA" }}>
              poisoned memory
            </em>
          </m.h2>
        </div>
        <m.p
          variants={mastheadLine}
          style={{ maxWidth: "40ch", fontSize: "13.5px", lineHeight: 1.62, color: "#8B94A1" }}
        >
          Promptfoo tells you a prompt failed. Constellan charts the graph anatomy
          of how poisoned context reached the agent — nine recorded observations,
          one severed star.
        </m.p>
      </div>

      <div
        className="obs-log"
        style={{
          position: "relative",
          marginTop: "36px",
          borderTop: "1px solid rgba(234,240,250,0.08)",
        }}
      >
        {/* progressively-drawn timeline hairline down the index column */}
        <m.span
          aria-hidden
          style={{
            position: "absolute",
            left: "2px",
            top: 0,
            bottom: 0,
            width: "1px",
            background:
              "linear-gradient(180deg, rgba(234,240,250,0.34), rgba(234,240,250,0.06))",
            transformOrigin: "top center",
          }}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, margin: "-90px" }}
          transition={{ duration: 1.1, ease: EASE_OUT_EXPO, delay: 0.15 }}
        />
        {FLOW_STEPS.map((f) => (
          <m.div
            key={f.n}
            variants={mastheadLine}
            className="obs-log-row"
            style={{
              display: "grid",
              gridTemplateColumns: "64px 1fr 200px",
              alignItems: "baseline",
              gap: "20px",
              padding: "18px 4px",
              borderBottom: "1px solid rgba(234,240,250,0.06)",
            }}
          >
            <span
              className="mono"
              style={{ fontSize: "12px", color: "#5F6875", letterSpacing: "0.06em" }}
            >
              {f.n}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
              <span
                aria-hidden
                style={{
                  flex: "0 0 auto",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: f.dot,
                  boxShadow: `0 0 7px ${f.dot}`,
                }}
              />
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#F3F6FB" }}>
                {f.title}
              </span>
            </div>
            <span
              className="obs-log-desc"
              style={{ fontSize: "12.5px", lineHeight: 1.5, color: "#8B94A1" }}
            >
              {f.desc}
            </span>
          </m.div>
        ))}
      </div>
    </m.section>
  );
}
