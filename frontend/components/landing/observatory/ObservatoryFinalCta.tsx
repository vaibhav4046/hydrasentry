"use client";

import { useEffect, useRef, useState } from "react";
import { m, useInView } from "framer-motion";
import { TransitButton, SightButton } from "./ObservatoryButtons";
import { useRunJudgeDemo } from "../castellan/useRunJudgeDemo";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { scaleIn } from "@/lib/motion";

/**
 * Closing observation band. A framed plate (coordinate corners, a faint
 * meridian arc) with a Space Grotesk masthead and the two refined CTAs. Restrained,
 * monochrome, no glowing radial blob. The plate surfaces from the dark on
 * scroll (framer-motion scaleIn, once). The primary fires the real judge demo.
 *
 * Reveal is hash-load/reduced-motion safe (initial={false} + an in-view-on-mount
 * fallback) so the plate, and crucially the "Run Judge Demo" CTA inside it, is
 * never stuck at opacity:0 when the observer does not fire.
 */
export function ObservatoryFinalCta() {
  const { run, isRunning } = useRunJudgeDemo();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [mountedInView, setMountedInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < vh && r.bottom > 0) setMountedInView(true);
  }, []);
  const show = reduce || inView || mountedInView;

  return (
    <section style={{ padding: "56px 0 96px" }}>
      <m.div
        ref={ref}
        variants={scaleIn}
        initial={false}
        animate={show ? "show" : "hidden"}
        style={{
          position: "relative",
          padding: "clamp(40px,6vw,72px) clamp(28px,5vw,64px)",
          border: "1px solid rgba(234,240,250,0.1)",
          borderRadius: "2px",
          overflow: "hidden",
          background:
            "radial-gradient(110% 120% at 50% 0%, rgba(234,240,250,0.05), transparent 55%), linear-gradient(180deg, rgba(8,10,13,0.7), rgba(2,3,4,0.85))",
        }}
      >
        {/* faint meridian arc behind the copy */}
        <svg
          aria-hidden
          viewBox="0 0 800 400"
          preserveAspectRatio="xMidYMin slice"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.5,
          }}
        >
          <circle cx="400" cy="-120" r="360" fill="none" stroke="rgba(234,240,250,0.08)" strokeWidth="1" />
          <circle cx="400" cy="-120" r="280" fill="none" stroke="rgba(234,240,250,0.06)" strokeWidth="1" />
        </svg>

        {/* corner registration ticks */}
        {(
          [
            ["top", "left"],
            ["top", "right"],
            ["bottom", "left"],
            ["bottom", "right"],
          ] as const
        ).map(([v, h]) => (
          <span
            key={`${v}-${h}`}
            aria-hidden
            style={{
              position: "absolute",
              [v]: "12px",
              [h]: "12px",
              width: "12px",
              height: "12px",
              borderTop: v === "top" ? "1px solid rgba(234,240,250,0.34)" : "none",
              borderBottom: v === "bottom" ? "1px solid rgba(234,240,250,0.34)" : "none",
              borderLeft: h === "left" ? "1px solid rgba(234,240,250,0.34)" : "none",
              borderRight: h === "right" ? "1px solid rgba(234,240,250,0.34)" : "none",
            }}
          />
        ))}

        <div style={{ position: "relative", textAlign: "center" }}>
          <span
            className="mono"
            style={{ fontSize: "10px", letterSpacing: "0.26em", color: "#9BA3AF" }}
          >
            GET STARTED
          </span>
          <h2
            className="obs-display"
            style={{
              marginTop: "20px",
              fontSize: "clamp(28px,4.4vw,52px)",
              lineHeight: 1.02,
              letterSpacing: "-0.026em",
              fontWeight: 600,
              color: "#F3F6FB",
            }}
          >
            Catch the attack before
            <br />
            your users{" "}
            <em style={{ fontStyle: "normal", fontWeight: 400, color: "#EAF0FA" }}>
              ever do.
            </em>
          </h2>
          <p
            style={{
              marginTop: "18px",
              fontSize: "14px",
              lineHeight: 1.6,
              color: "#8B94A1",
              maxWidth: "46ch",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Graph-native context integrity for memory-powered agents. See exactly
            what your agent&apos;s memory does, and prove it is safe.
          </p>
          <div
            style={{
              marginTop: "34px",
              display: "flex",
              gap: "14px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <TransitButton onClick={run} disabled={isRunning}>
              {isRunning ? "Routing…" : "Run live attack"} →
            </TransitButton>
            <SightButton href="#architecture">See how it works</SightButton>
          </div>
        </div>
      </m.div>
    </section>
  );
}
