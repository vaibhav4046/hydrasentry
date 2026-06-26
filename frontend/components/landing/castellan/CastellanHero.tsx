"use client";

import { HERO } from "./landingData";
import { useRunJudgeDemo } from "./useRunJudgeDemo";

/**
 * Castellan hero, ported 1:1 from the design source, the fold that must match
 * hero4.png. A mono kicker pill with a pulsing dot, a massive Inter Tight 700
 * display headline with a white->grey vertical gradient clipped to the text,
 * the subcopy, and the primary "Run Judge Demo" CTA + "View Architecture"
 * secondary. All sizes/spacing/gradients are verbatim from the source inline
 * styles. The primary CTA fires the real judge-demo flow.
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

export function CastellanHero() {
  const { run, isRunning } = useRunJudgeDemo();

  return (
    <section
      style={{
        padding: "74px 0 12px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* kicker pill */}
      <div
        data-reveal
        className="mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "11px",
          letterSpacing: "0.22em",
          color: "#9BA3AF",
          padding: "7px 16px",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "999px",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#EAF0FA",
            boxShadow: "0 0 10px #EAF0FA",
            animation: "hsPulseDot 2.4s ease-in-out infinite",
          }}
        />
        {HERO.kicker}
      </div>

      {/* display headline, white->grey gradient clipped to text */}
      <h1
        data-reveal
        style={{
          marginTop: "26px",
          fontSize: "clamp(40px,6.6vw,82px)",
          lineHeight: 0.97,
          letterSpacing: "-0.038em",
          fontWeight: 700,
          maxWidth: "13ch",
          background: "linear-gradient(180deg,#FFFFFF 26%,#A7AEBA)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textWrap: "balance",
        }}
      >
        {HERO.headline}
      </h1>

      {/* subcopy */}
      <p
        data-reveal
        style={{
          marginTop: "22px",
          maxWidth: "60ch",
          fontSize: "clamp(15px,1.5vw,18px)",
          lineHeight: 1.62,
          color: "#9BA3AF",
          textWrap: "pretty",
        }}
      >
        {HERO.subcopy}
      </p>

      {/* CTAs */}
      <div
        data-reveal
        style={{
          marginTop: "30px",
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          justifyContent: "center",
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
            padding: "14px 26px",
            border: "none",
            borderRadius: "14px",
            background: "linear-gradient(180deg,#FFFFFF,#CDD3DC)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.9),0 0 0 1px rgba(255,255,255,0.22),0 16px 40px -14px rgba(220,228,240,0.6)",
            transition: "transform .2s,box-shadow .3s",
          }}
          onMouseEnter={btnLift}
          onMouseLeave={btnDrop}
        >
          {isRunning ? "Running…" : "Run Judge Demo"} →
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
            backdropFilter: "blur(8px)",
            transition: "border-color .25s,background .25s",
          }}
          onMouseEnter={ghov}
          onMouseLeave={gunhov}
        >
          View Architecture
        </a>
      </div>
    </section>
  );
}
