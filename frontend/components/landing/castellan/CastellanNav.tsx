"use client";

import { useEffect, useState } from "react";
import { CastellanEmblem } from "./CastellanEmblem";
import { ANNOUNCEMENT, NAV_LINKS } from "./landingData";
import { useRunJudgeDemo } from "./useRunJudgeDemo";

/**
 * Castellan announcement bar + sticky nav, ported 1:1 from the design source.
 * The nav background fades from transparent to glass once the page scrolls past
 * 24px (source: state.scrolled). Inline styles match the source exactly so the
 * fold is pixel-close to hero4.png. The white "Run Judge Demo" button and the
 * announcement bar both fire the real judge-demo flow; nav links anchor to the
 * homepage sections; "Docs" scrolls to #architecture (as in the source).
 */
const LINK = "#9BA3AF";
const LINK_HOVER = "#F3F6FB";

function hov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.color = LINK_HOVER;
}
function unhov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.color = LINK;
}
function ghov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.32)";
  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
}
function gunhov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
}
function btnLift(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "translateY(-2px)";
}
function btnDrop(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "translateY(0)";
}

export function CastellanNav() {
  const [scrolled, setScrolled] = useState(false);
  const { run, isRunning } = useRunJudgeDemo();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* ANNOUNCEMENT BAR */}
      <button
        type="button"
        onClick={run}
        style={{
          position: "relative",
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          width: "100%",
          padding: "9px 20px",
          border: "none",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.012)",
          textAlign: "center",
          cursor: "pointer",
          font: "inherit",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: "10px",
            letterSpacing: "0.18em",
            color: "#EAF0FA",
            border: "1px solid rgba(234,240,250,0.28)",
            borderRadius: "999px",
            padding: "2px 8px",
          }}
        >
          {ANNOUNCEMENT.pill}
        </span>
        <span style={{ fontSize: "12.5px", color: "#9BA3AF", letterSpacing: "0.01em" }}>
          {ANNOUNCEMENT.lead}{" "}
          <span className="mono" style={{ color: "#D9DEE7", fontSize: "11.5px" }}>
            {ANNOUNCEMENT.token}
          </span>
          {ANNOUNCEMENT.rest}
        </span>
        <span style={{ color: "#5F6875" }}>→</span>
      </button>

      {/* NAV */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: scrolled ? "rgba(4,5,6,0.8)" : "rgba(4,5,6,0)",
          borderBottom: `1px solid ${scrolled ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0)"}`,
          transition:
            "background .4s cubic-bezier(.22,.61,.36,1),border-color .4s",
        }}
      >
        <div
          className="castellan-nav-inner"
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "15px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
          }}
        >
          <a
            href="#top"
            style={{ display: "flex", alignItems: "center", textDecoration: "none" }}
          >
            <CastellanEmblem size={26} />
          </a>

          <nav
            className="castellan-navlinks"
            style={{ display: "flex", alignItems: "center", gap: "30px" }}
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{
                  fontSize: "13.5px",
                  color: LINK,
                  textDecoration: "none",
                  transition: "color .2s",
                }}
                onMouseEnter={hov}
                onMouseLeave={unhov}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <a
              href="#architecture"
              className="castellan-docs-btn"
              style={{
                fontSize: "13px",
                color: "#D9DEE7",
                textDecoration: "none",
                padding: "9px 14px",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: "11px",
                background: "rgba(255,255,255,0.03)",
                transition: "border-color .25s,background .25s",
              }}
              onMouseEnter={ghov}
              onMouseLeave={gunhov}
            >
              Docs
            </a>
            <button
              type="button"
              onClick={run}
              disabled={isRunning}
              style={{
                cursor: isRunning ? "default" : "pointer",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 600,
                color: "#0A0A0A",
                padding: "9px 16px",
                border: "none",
                borderRadius: "11px",
                background: "linear-gradient(180deg,#FFFFFF,#D5DBE3)",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.3),0 8px 22px -10px rgba(220,228,240,0.5)",
                transition: "transform .2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={btnLift}
              onMouseLeave={btnDrop}
            >
              {isRunning ? "Running…" : "Run Judge Demo"}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
