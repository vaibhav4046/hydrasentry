"use client";

import { m } from "framer-motion";
import { SectionMarker } from "./SectionMarker";
import { RevealSection } from "./RevealSection";
import { mastheadLine } from "@/lib/motion";

/**
 * Research section, "The unsolved layer: persistent memory integrity". A compact,
 * premium below-the-fold band that frames the hard problem HydraSentry targets:
 * prompt injection is transient, memory poisoning persists. Five hairline cards
 * name the open risk classes and the certified-replay answer. Pure monochrome,
 * no hue; reveals on scroll via the hash-load-safe RevealSection (no permanent
 * opacity:0, so reduced motion keeps the copy fully legible).
 */
interface ResearchCard {
  n: string;
  title: string;
  desc: string;
}

const CARDS: ResearchCard[] = [
  {
    n: "01",
    title: "Persistent Memory Poisoning",
    desc: "A malicious memory survives the session that wrote it and steers a later, unrelated task toward an unsafe action.",
  },
  {
    n: "02",
    title: "Skill Supply Chain Risk",
    desc: "Installed skills carry hidden injection, secret access, and exfiltration that no prompt scanner inspects before they run.",
  },
  {
    n: "03",
    title: "MCP Tool Surface Risk",
    desc: "Poisoned context decides which tool fires. The unsafe action is the real blast radius, not the words in the prompt.",
  },
  {
    n: "04",
    title: "Graph Provenance Gap",
    desc: "Once retrieved, a poisoned memory reads as trusted context unless the system tracks the exact node and path that carried it.",
  },
  {
    n: "05",
    title: "Certified Replay Defense",
    desc: "Every replay becomes a Memory Integrity Certificate: what changed, which node carried it, which tool would have fired, which rule now blocks it.",
  },
];

export function ResearchSection() {
  return (
    <RevealSection style={{ padding: "56px 0 36px" }}>
      <SectionMarker index="R0" label="THE OPEN PROBLEM" />
      <m.h2
        variants={mastheadLine}
        className="obs-display"
        style={{
          marginTop: "18px",
          maxWidth: "22ch",
          fontSize: "clamp(24px,3.2vw,38px)",
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          fontWeight: 600,
          color: "#F3F6FB",
        }}
      >
        The unsolved layer: persistent memory integrity
      </m.h2>
      <m.p
        variants={mastheadLine}
        style={{
          marginTop: "16px",
          maxWidth: "64ch",
          fontSize: "14px",
          lineHeight: 1.62,
          color: "#9BA3AF",
          textWrap: "pretty",
        }}
      >
        Prompt injection is transient. Memory poisoning persists. Once a poisoned
        memory is retrieved, it becomes indistinguishable from trusted context
        unless the system tracks provenance, replay behavior, and graph path
        evidence. HydraSentry turns every replay into a Memory Integrity
        Certificate: what changed, which node carried it, which tool would have
        fired, and what rule now prevents it.
      </m.p>

      <m.div
        variants={mastheadLine}
        className="obs-grid-5"
        style={{
          marginTop: "30px",
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: "1px",
          background: "rgba(234,240,250,0.07)",
          border: "1px solid rgba(234,240,250,0.07)",
        }}
      >
        {CARDS.map((c, i) => (
          <div
            key={c.n}
            className="obs-card"
            style={{
              padding: "22px 18px",
              background: "rgba(4,5,6,0.92)",
              minHeight: "186px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: "10px", color: "#5F6875", letterSpacing: "0.08em" }}
              >
                {c.n}
              </span>
              <span
                aria-hidden
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: i === CARDS.length - 1 ? "#fff" : "#5F6875",
                  boxShadow: i === CARDS.length - 1 ? "0 0 8px #fff" : "none",
                }}
              />
            </div>
            <div
              style={{
                marginTop: "14px",
                fontSize: "13.5px",
                fontWeight: 600,
                color: "#F3F6FB",
                lineHeight: 1.25,
              }}
            >
              {c.title}
            </div>
            <div
              style={{
                marginTop: "8px",
                fontSize: "11.5px",
                lineHeight: 1.5,
                color: "#8B94A1",
              }}
            >
              {c.desc}
            </div>
          </div>
        ))}
      </m.div>
    </RevealSection>
  );
}
