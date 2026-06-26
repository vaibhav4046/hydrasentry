import {
  PRIMITIVES,
  FLOW_STEPS,
  FEATURES,
  ARCH_STAGES,
} from "./landingData";

/**
 * The static below-the-fold sections, ported 1:1 from the design source:
 * primitives strip, attack flow (9 steps), capabilities (6 cards), and
 * architecture (5 stages). Server-rendered (no client JS), card hover lift +
 * border-brighten is handled by the `.castellan-card` CSS class instead of the
 * source's per-card JS handlers, so these ship zero hydration cost. Copy, grid
 * shapes, sizes, and styles are verbatim from the source inline styles.
 */
export function CastellanSections() {
  return (
    <>
      {/* PRIMITIVES STRIP */}
      <section style={{ padding: "62px 0 24px" }}>
        <div
          data-reveal
          className="mono"
          style={{ textAlign: "center", fontSize: "10.5px", letterSpacing: "0.22em", color: "#5F6875" }}
        >
          BUILT ON THE PRIMITIVES THAT MATTER
        </div>
        <div
          data-reveal
          className="castellan-grid-4"
          style={{ marginTop: "26px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px" }}
        >
          {PRIMITIVES.map((p) => (
            <div
              key={p.tag}
              className="castellan-card"
              style={{
                padding: "18px 16px",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.014)",
              }}
            >
              <div className="mono" style={{ fontSize: "12px", color: "#EAF0FA" }}>
                {p.tag}
              </div>
              <div style={{ marginTop: "8px", fontSize: "14px", fontWeight: 600, color: "#F3F6FB" }}>
                {p.title}
              </div>
              <div style={{ marginTop: "5px", fontSize: "12.5px", lineHeight: 1.5, color: "#9BA3AF" }}>
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ATTACK FLOW */}
      <section id="flow" style={{ padding: "56px 0 40px" }}>
        <div data-reveal style={{ textAlign: "center" }}>
          <div className="mono" style={{ fontSize: "10.5px", letterSpacing: "0.22em", color: "#EAF0FA" }}>
            THE JUDGE DEMO · ONE CLICK
          </div>
          <h2
            style={{
              marginTop: "14px",
              fontSize: "clamp(28px,4vw,44px)",
              letterSpacing: "-0.03em",
              fontWeight: 700,
              color: "#F3F6FB",
            }}
          >
            The anatomy of a poisoned memory
          </h2>
          <p
            style={{
              marginTop: "14px",
              maxWidth: "56ch",
              marginLeft: "auto",
              marginRight: "auto",
              fontSize: "15px",
              lineHeight: 1.6,
              color: "#9BA3AF",
            }}
          >
            Promptfoo tells you a prompt failed. Constellan shows the graph
            anatomy of how poisoned context reached the agent, and stops it.
          </p>
        </div>
        <div
          data-reveal
          className="castellan-grid-3"
          style={{ marginTop: "36px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px" }}
        >
          {FLOW_STEPS.map((f) => (
            <div
              key={f.n}
              className="castellan-card"
              style={{
                padding: "18px",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "14px",
                background:
                  "linear-gradient(170deg,rgba(255,255,255,0.02),rgba(255,255,255,0.004))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="mono" style={{ fontSize: "11px", color: "#5F6875" }}>
                  {f.n}
                </span>
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: f.dot,
                    boxShadow: `0 0 8px ${f.dot}`,
                  }}
                />
              </div>
              <div style={{ marginTop: "12px", fontSize: "15px", fontWeight: 600, color: "#F3F6FB" }}>
                {f.title}
              </div>
              <div style={{ marginTop: "6px", fontSize: "12.5px", lineHeight: 1.5, color: "#9BA3AF" }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "44px 0" }}>
        <div
          data-reveal
          className="castellan-features-head"
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}
        >
          <div>
            <div className="mono" style={{ fontSize: "10.5px", letterSpacing: "0.22em", color: "#5F6875" }}>
              CAPABILITIES
            </div>
            <h2
              style={{
                marginTop: "12px",
                fontSize: "clamp(26px,3.6vw,40px)",
                letterSpacing: "-0.03em",
                fontWeight: 700,
              }}
            >
              A full security cockpit, not a test runner
            </h2>
          </div>
          <p style={{ maxWidth: "38ch", fontSize: "13.5px", lineHeight: 1.6, color: "#9BA3AF" }}>
            Eight coordinated agents test, replay, explain, block, quarantine,
            schedule, and refine, autonomously.
          </p>
        </div>
        <div
          data-reveal
          className="castellan-grid-3"
          style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px" }}
        >
          {FEATURES.map((c) => (
            <div
              key={c.icon}
              className="castellan-card"
              style={{
                padding: "22px",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px",
                background:
                  "linear-gradient(180deg,rgba(16,19,24,0.7),rgba(9,11,14,0.7))",
                minHeight: "188px",
              }}
            >
              <div
                className="mono"
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid rgba(234,240,250,0.22)",
                  background: "rgba(234,240,250,0.05)",
                  color: "#EAF0FA",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                {c.icon}
              </div>
              <div style={{ marginTop: "16px", fontSize: "16px", fontWeight: 600, color: "#F3F6FB" }}>
                {c.title}
              </div>
              <div style={{ marginTop: "8px", fontSize: "13px", lineHeight: 1.55, color: "#9BA3AF" }}>
                {c.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section id="architecture" style={{ padding: "52px 0" }}>
        <div
          data-reveal
          style={{
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: "20px",
            background:
              "linear-gradient(180deg,rgba(2,3,4,0.6),rgba(11,13,16,0.8))",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "32px 32px 8px" }}>
            <div className="mono" style={{ fontSize: "10.5px", letterSpacing: "0.22em", color: "#EAF0FA" }}>
              ARCHITECTURE
            </div>
            <h2
              style={{
                marginTop: "12px",
                fontSize: "clamp(24px,3.2vw,36px)",
                letterSpacing: "-0.03em",
                fontWeight: 700,
              }}
            >
              From task to evidence in one deterministic loop
            </h2>
          </div>
          <div
            className="castellan-grid-5"
            style={{
              padding: "18px 24px 32px",
              display: "grid",
              gridTemplateColumns: "repeat(5,1fr)",
              gap: "10px",
            }}
          >
            {ARCH_STAGES.map((a) => (
              <div
                key={a.n}
                style={{
                  padding: "16px 14px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.016)",
                }}
              >
                <div className="mono" style={{ fontSize: "10px", color: "#5F6875" }}>
                  {a.n}
                </div>
                <div style={{ marginTop: "8px", fontSize: "13.5px", fontWeight: 600, color: "#F3F6FB" }}>
                  {a.title}
                </div>
                <div style={{ marginTop: "5px", fontSize: "11.5px", lineHeight: 1.45, color: "#9BA3AF" }}>
                  {a.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
