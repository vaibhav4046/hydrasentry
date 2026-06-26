"use client";

import { useRunJudgeDemo } from "./useRunJudgeDemo";

/**
 * Final CTA band, ported 1:1 from the design source: a radial-glow panel with a
 * slow orbiting ring, the gradient headline "Run the attack before your users
 * do.", subcopy, and two CTAs. The primary "Run Demo" fires the real judge-demo
 * flow (routes into the cockpit); "Read the docs" anchors to #architecture.
 */
function ghov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.32)";
  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
}
function gunhov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
}
function btnLift(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "translateY(-2px)";
}
function btnDrop(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "translateY(0)";
}

export function CastellanFinalCta() {
  const { run, isRunning } = useRunJudgeDemo();

  return (
    <section style={{ padding: "36px 0 92px" }}>
      <div
        data-reveal
        style={{
          position: "relative",
          textAlign: "center",
          padding: "60px 32px",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "24px",
          overflow: "hidden",
          background:
            "radial-gradient(700px 360px at 50% 0%,rgba(220,228,240,0.09),transparent 60%),linear-gradient(180deg,rgba(16,19,24,0.9),rgba(2,3,4,0.96))",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-160px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "520px",
            height: "520px",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "50%",
            animation: "hsRadar 90s linear infinite",
          }}
        />
        <h2
          style={{
            position: "relative",
            fontSize: "clamp(30px,4.6vw,52px)",
            letterSpacing: "-0.035em",
            fontWeight: 700,
            background: "linear-gradient(180deg,#fff,#A7AEBA)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Run the attack before your users do.
        </h2>
        <p
          style={{
            position: "relative",
            marginTop: "16px",
            fontSize: "15px",
            color: "#9BA3AF",
            maxWidth: "48ch",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Graph-native context integrity for memory-powered AI agents. Trust your
          agent&apos;s memory, prove it.
        </p>
        <div
          style={{
            position: "relative",
            marginTop: "30px",
            display: "flex",
            gap: "14px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={run}
            disabled={isRunning}
            style={{
              cursor: isRunning ? "default" : "pointer",
              fontFamily: "inherit",
              fontSize: "15px",
              fontWeight: 600,
              color: "#0A0A0A",
              padding: "14px 28px",
              border: "none",
              borderRadius: "14px",
              background: "linear-gradient(180deg,#FFFFFF,#CDD3DC)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.9),0 16px 40px -14px rgba(220,228,240,0.6)",
              transition: "transform .2s",
            }}
            onMouseEnter={btnLift}
            onMouseLeave={btnDrop}
          >
            {isRunning ? "Running…" : "Run Demo"} →
          </button>
          <a
            href="#architecture"
            style={{
              fontSize: "15px",
              fontWeight: 500,
              color: "#F3F6FB",
              textDecoration: "none",
              padding: "14px 24px",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.03)",
            }}
            onMouseEnter={ghov}
            onMouseLeave={gunhov}
          >
            Read the docs
          </a>
        </div>
      </div>
    </section>
  );
}
