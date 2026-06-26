import { CastellanEmblem } from "../castellan/CastellanEmblem";

/**
 * Observatory footer, a hairline-topped bar with the Constellan wordmark on the
 * left and a mono coordinate/atlas tagline on the right. Restrained, monochrome.
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
        <div
          className="mono"
          style={{ fontSize: "10px", letterSpacing: "0.16em", color: "#5F6875" }}
        >
CONSTELLAN · GRAPH-NATIVE CONTEXT INTEGRITY FOR HYDRADB AGENTS
        </div>
      </div>
    </footer>
  );
}
