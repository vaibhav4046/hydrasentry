import { CastellanEmblem } from "./CastellanEmblem";

/**
 * Castellan footer — ported 1:1 from the design source: a hairline-topped bar
 * with the wordmark on the left and the mono tagline on the right.
 */
export function CastellanFooter() {
  return (
    <footer
      style={{
        position: "relative",
        zIndex: 2,
        borderTop: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(2,3,4,0.6)",
      }}
    >
      <div
        className="castellan-footer-row"
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "34px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <CastellanEmblem size={22} />
        <div className="mono" style={{ fontSize: "11px", color: "#5F6875" }}>
          Graph-native context integrity · built for the memory layer
        </div>
      </div>
    </footer>
  );
}
