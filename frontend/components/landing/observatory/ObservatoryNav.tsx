"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CastellanEmblem } from "../castellan/CastellanEmblem";
import { useDemoStore } from "@/store/useDemoStore";

/**
 * Observatory announcement bar + sticky nav. Reskins the cockpit run-demo flow
 * into the atlas language: a hairline coordinate announcement strip, the
 * HydraSentry emblem/wordmark, mono small-caps nav links, and a refined transit
 * button (sharp 2px, not a rounded gradient pill). The nav fades to glass past
 * 24px of scroll.
 *
 * The announcement and the "Run Judge Demo" button both drive the visible
 * in-place 6-stage sequence on the homepage: they bump `judgeRunNonce` in the
 * shared demo store, which the hero's JudgeDemoController watches to play the
 * sequence and scroll the hero into view (no route change). The controller fires
 * the real backend in parallel to persist the canonical artifact.
 */

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Overview", href: "#product" },
  { label: "How it works", href: "#flow" },
  { label: "Capabilities", href: "#features" },
  { label: "Method", href: "#architecture" },
];

const LINK = "#8B94A1";
const LINK_HOVER = "#F3F6FB";

function hov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.color = LINK_HOVER;
}
function unhov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.color = LINK;
}
function ghov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "rgba(234,240,250,0.32)";
  e.currentTarget.style.color = "#F3F6FB";
}
function gunhov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "rgba(234,240,250,0.14)";
  e.currentTarget.style.color = "#D9DEE7";
}
function btnLift(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "translateY(-1px)";
}
function btnDrop(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "translateY(0)";
}

export function ObservatoryNav() {
  const [scrolled, setScrolled] = useState(false);
  const triggerJudgeRun = useDemoStore((s) => s.triggerJudgeRun);
  const isRunning = useDemoStore((s) => s.isRunning);
  const run = triggerJudgeRun;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* ANNOUNCEMENT, coordinate strip */}
      <button
        type="button"
        onClick={run}
        className="mono obs-announce"
        style={{
          position: "relative",
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          width: "100%",
          padding: "8px 20px",
          border: "none",
          borderBottom: "1px solid rgba(234,240,250,0.06)",
          background: "rgba(234,240,250,0.012)",
          textAlign: "center",
          cursor: "pointer",
          font: "inherit",
        }}
      >
        <span
          style={{
            fontSize: "9px",
            letterSpacing: "0.22em",
            color: "#EAF0FA",
            border: "1px solid rgba(234,240,250,0.26)",
            padding: "2px 7px",
          }}
        >
          LIVE RUN
        </span>
        <span
          style={{
            fontSize: "11px",
            letterSpacing: "0.05em",
            color: "#8B94A1",
          }}
        >
          Run a real poisoned-memory attack against the live backend ·{" "}
          <span style={{ color: "#D9DEE7" }}>
            {isRunning ? "running…" : "run it"}
          </span>
        </span>
        <span
          aria-hidden
          className="obs-announce-arrow"
          style={{ color: "#5F6875" }}
        >
          →
        </span>
      </button>

      {/* NAV */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: scrolled ? "rgba(4,5,6,0.82)" : "rgba(4,5,6,0)",
          borderBottom: `1px solid ${scrolled ? "rgba(234,240,250,0.09)" : "rgba(234,240,250,0)"}`,
          transition: "background .4s cubic-bezier(.22,.61,.36,1),border-color .4s",
        }}
      >
        <div
          className="obs-nav-inner"
          style={{
            maxWidth: "1240px",
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
            <CastellanEmblem size={24} />
          </a>

          <nav
            className="obs-navlinks mono"
            style={{ display: "flex", alignItems: "center", gap: "28px" }}
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
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
            {/* IA: a clear, always-visible route into the live product console.
                No login wall — the dashboard renders the real demo tenant. */}
            <Link
              href="/console"
              className="obs-console-btn mono"
              style={{
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#D9DEE7",
                textDecoration: "none",
                padding: "9px 14px",
                border: "1px solid rgba(234,240,250,0.14)",
                borderRadius: "2px",
                transition: "border-color .25s,color .25s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={ghov}
              onMouseLeave={gunhov}
            >
              Console
            </Link>
            <button
              type="button"
              onClick={run}
              disabled={isRunning}
              className="obs-btn-primary"
              style={{
                cursor: isRunning ? "default" : "pointer",
                fontFamily: "inherit",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "#080a0c",
                padding: "9px 16px",
                border: "1px solid rgba(255,255,255,0.9)",
                borderRadius: "2px",
                background: "linear-gradient(180deg,#FFFFFF,#D7DCE4)",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.12)",
                transition: "transform .2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={btnLift}
              onMouseLeave={btnDrop}
            >
              {isRunning ? "Running…" : "Run live attack"}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
