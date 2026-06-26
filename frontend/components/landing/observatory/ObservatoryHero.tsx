"use client";

import { useRef } from "react";
import { m, useScroll, useTransform } from "framer-motion";
import { ChartPlate } from "./ChartPlate";
import { TransitButton, SightButton } from "./ObservatoryButtons";
import { useRunJudgeDemo } from "../castellan/useRunJudgeDemo";
import {
  mastheadContainer,
  mastheadLine,
  mastheadAccent,
  plateReveal,
} from "@/lib/motion";

/**
 * Observatory hero — the deliberate anti-template fold. Instead of a centred
 * gradient headline over a glowing blob, this is an editorial, asymmetric
 * spread: a left-set Fraunces masthead with an italic accent, a coordinate
 * eyebrow, subcopy and refined hairline CTAs on the left; the live star-chart
 * plate set off-axis on the right; cartographic readouts living in the margins.
 *
 * Motion: a "First Light" masthead cascade plays once on load — the eyebrow,
 * each headline line, the italic accent (which lands last), the subcopy, the
 * CTAs and the readouts each rise + fade + soft-blur-clear in a deliberate
 * stagger (lib/motion mastheadContainer/Line/Accent). The plate surfaces from
 * the dark alongside, and gets a subtle scroll parallax (GPU transform only).
 * All of it composes to instant under prefers-reduced-motion via the global
 * MotionConfig. The primary CTA fires the real backend judge demo.
 */
export function ObservatoryHero() {
  const { run, isRunning } = useRunJudgeDemo();
  const plateWrapRef = useRef<HTMLDivElement | null>(null);

  // Subtle parallax: the plate drifts up a touch slower than the page scroll.
  const { scrollYProgress } = useScroll({
    target: plateWrapRef,
    offset: ["start end", "end start"],
  });
  const plateY = useTransform(scrollYProgress, [0, 1], [26, -26]);

  return (
    <section
      style={{
        position: "relative",
        paddingTop: "64px",
        paddingBottom: "44px",
      }}
    >
      <div
        className="obs-hero-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.05fr) minmax(0,0.95fr)",
          alignItems: "center",
          gap: "56px",
        }}
      >
        {/* LEFT — editorial masthead, sequenced on load */}
        <m.div
          className="obs-hero-copy"
          style={{ minWidth: 0 }}
          variants={mastheadContainer}
          initial="hidden"
          animate="show"
        >
          {/* coordinate eyebrow */}
          <m.div
            variants={mastheadLine}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginBottom: "30px",
            }}
          >
            <span
              aria-hidden
              className="obs-eyebrow-rule"
              style={{
                width: "26px",
                height: "1px",
                background: "rgba(234,240,250,0.4)",
              }}
            />
            <span
              className="mono"
              style={{
                fontSize: "10px",
                letterSpacing: "0.26em",
                color: "#9BA3AF",
              }}
            >
              N 38°·24 / OBS · CONTEXT INTEGRITY FOR HYDRADB AGENTS
            </span>
          </m.div>

          {/* Fraunces masthead — left-set, revealed line by line */}
          <h1
            className="obs-display"
            style={{
              margin: 0,
              fontSize: "clamp(40px, 5.6vw, 78px)",
              lineHeight: 0.98,
              letterSpacing: "-0.018em",
              fontWeight: 500,
              color: "#F3F6FB",
              textWrap: "balance",
            }}
          >
            <m.span variants={mastheadLine} style={{ display: "block" }}>
              Chart the constellation
            </m.span>
            <m.span variants={mastheadLine} style={{ display: "block" }}>
              of your agent&apos;s memory
              <span style={{ color: "#7E8794" }}> — </span>
              <m.em
                variants={mastheadAccent}
                className="obs-display-italic"
                style={{
                  display: "inline-block",
                  fontStyle: "normal",
                  fontWeight: 400,
                  color: "#EAF0FA",
                }}
              >
                and guard it.
              </m.em>
            </m.span>
          </h1>

          {/* subcopy */}
          <m.p
            variants={mastheadLine}
            style={{
              marginTop: "26px",
              maxWidth: "52ch",
              fontSize: "clamp(14px,1.15vw,16px)",
              lineHeight: 1.62,
              color: "#9BA3AF",
              textWrap: "pretty",
            }}
          >
            Constellan is the memory observatory for AI agents. It replays a task
            against clean and poisoned HydraDB context, maps the exact{" "}
            <span className="mono" style={{ color: "#D9DEE7", fontSize: "0.92em" }}>
              query_paths
            </span>{" "}
            that carried the poison, and severs the tainted star through MCP
            before the agent acts.
          </m.p>

          {/* CTAs */}
          <m.div
            variants={mastheadLine}
            style={{
              marginTop: "34px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <TransitButton onClick={run} disabled={isRunning}>
              {isRunning ? "Routing…" : "Run Judge Demo"} →
            </TransitButton>
            <SightButton href="#architecture">Sight the architecture</SightButton>
          </m.div>

          {/* baseline rule + tiny readout */}
          <m.div
            variants={mastheadLine}
            style={{
              marginTop: "44px",
              paddingTop: "16px",
              borderTop: "1px solid rgba(234,240,250,0.08)",
              display: "flex",
              alignItems: "center",
              gap: "22px",
              flexWrap: "wrap",
            }}
          >
            {[
              ["DETERMINISTIC", "87 / HIGH · reproducible"],
              ["GRAPH-NATIVE", "real query_paths, never faked"],
              ["MONOCHROME", "one light source"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span
                  className="mono"
                  style={{ fontSize: "8.5px", letterSpacing: "0.18em", color: "#5F6875" }}
                >
                  {k}
                </span>
                <span style={{ fontSize: "11.5px", color: "#9BA3AF" }}>{v}</span>
              </div>
            ))}
          </m.div>
        </m.div>

        {/* RIGHT — the observation plate, set slightly high (off-axis) with parallax */}
        <m.div
          ref={plateWrapRef}
          className="obs-hero-plate"
          style={{ minWidth: 0, alignSelf: "start", marginTop: "6px", y: plateY }}
          variants={plateReveal}
          initial="hidden"
          animate="show"
        >
          <ChartPlate />
        </m.div>
      </div>
    </section>
  );
}
