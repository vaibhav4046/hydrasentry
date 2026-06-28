import Link from "next/link";
import { CastellanEmblem } from "../castellan/CastellanEmblem";

/**
 * Observatory footer, a hairline-topped bar with the HydraSentry wordmark on the
 * left, persistent product links (Docs / Console) in the middle, and a mono
 * coordinate/atlas tagline on the right. Restrained, monochrome. The Docs link
 * keeps the docs reachable on mobile, where the header docs entry collapses.
 */
export function ObservatoryFooter() {
  return (
    <footer
      style={{
        position: "relative",
        zIndex: 2,
        borderTop: "1px solid rgba(234,240,250,0.07)",
        background: "rgba(2,3,4,0.6)",
      }}
    >
      <div
        className="obs-footer-row"
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "30px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <CastellanEmblem size={21} />
        <nav
          className="mono"
          style={{ display: "flex", alignItems: "center", gap: "20px" }}
        >
          <Link
            href="/docs"
            style={{
              fontSize: "10px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#8B94A1",
              textDecoration: "none",
            }}
          >
            Docs
          </Link>
          <Link
            href="/console"
            style={{
              fontSize: "10px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#8B94A1",
              textDecoration: "none",
            }}
          >
            Console
          </Link>
        </nav>
        <div
          className="mono"
          style={{ fontSize: "10px", letterSpacing: "0.16em", color: "#5F6875" }}
        >
HYDRASENTRY · GRAPH-NATIVE PROOF, NOT PROMPT VIBES · HYDRADB AGENTS
        </div>
      </div>
    </footer>
  );
}
