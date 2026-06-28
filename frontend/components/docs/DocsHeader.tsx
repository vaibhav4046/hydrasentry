"use client";

/**
 * Sticky top bar for the public /docs page. Mirrors the observatory nav language
 * (glass, hairline border, mono small-caps links) and carries the emblem home,
 * an in-page section nav, the active "Docs" link, and a route into the console.
 */
import Link from "next/link";
import { CastellanEmblem } from "../landing/castellan/CastellanEmblem";

const LINK = "#8B94A1";
const LINK_HOVER = "#F3F6FB";

const SECTION_LINKS: { label: string; href: string }[] = [
  { label: "Install", href: "#install" },
  { label: "Connect", href: "#connect" },
  { label: "MCP Tools", href: "#tools" },
  { label: "API", href: "#api" },
];

function hov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.color = LINK_HOVER;
}
function unhov(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.color = LINK;
}

export function DocsHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        background: "rgba(4,5,6,0.82)",
        borderBottom: "1px solid rgba(234,240,250,0.09)",
      }}
    >
      <div
        className="obs-nav-inner"
        style={{
          maxWidth: "980px",
          margin: "0 auto",
          padding: "15px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <CastellanEmblem size={24} />
        </Link>

        <nav
          className="obs-navlinks mono"
          style={{ display: "flex", alignItems: "center", gap: "26px" }}
        >
          {SECTION_LINKS.map((link) => (
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
          <span
            className="mono"
            aria-current="page"
            style={{
              fontSize: "11px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#EAF0FA",
            }}
          >
            Docs
          </span>
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
              whiteSpace: "nowrap",
            }}
          >
            Console
          </Link>
        </div>
      </div>
    </header>
  );
}
