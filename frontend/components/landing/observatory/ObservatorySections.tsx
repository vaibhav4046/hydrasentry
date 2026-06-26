import {
  PRIMITIVES,
  FLOW_STEPS,
  FEATURES,
  ARCH_STAGES,
} from "../castellan/landingData";

/**
 * Below-the-fold observatory sections — the product story reskinned to the
 * star-atlas language and kept fully server-rendered (zero hydration cost; card
 * hover is the .obs-card CSS class). Copy is preserved from landingData; only
 * the framing is cartographic: section markers are coordinate-style mono
 * small-caps, dividers are hairlines, the attack flow becomes an "observation
 * log", capabilities become "instruments", architecture becomes the "reduction
 * method". Pure monochrome.
 */

/** A small-caps coordinate section marker with a leading hairline + index. */
function SectionMarker({ index, label }: { index: string; label: string }) {
  return (
    <div
      data-reveal
      style={{ display: "flex", alignItems: "center", gap: "14px" }}
    >
      <span
        className="mono"
        style={{ fontSize: "10px", letterSpacing: "0.1em", color: "#5F6875" }}
      >
        {index}
      </span>
      <span
        aria-hidden
        style={{ width: "22px", height: "1px", background: "rgba(234,240,250,0.22)" }}
      />
      <span
        className="mono"
        style={{ fontSize: "10px", letterSpacing: "0.26em", color: "#9BA3AF" }}
      >
        {label}
      </span>
    </div>
  );
}

export function ObservatorySections() {
  return (
    <>
      {/* INSTRUMENT LEGEND — the primitives, as an atlas legend */}
      <section id="product" style={{ padding: "72px 0 28px" }}>
        <SectionMarker index="00" label="INSTRUMENT LEGEND" />
        <div
          data-reveal
          className="obs-grid-4"
          style={{
            marginTop: "28px",
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: "1px",
            background: "rgba(234,240,250,0.07)",
            border: "1px solid rgba(234,240,250,0.07)",
          }}
        >
          {PRIMITIVES.map((p, i) => (
            <div
              key={p.tag}
              className="obs-card"
              style={{
                padding: "22px 18px",
                background: "rgba(4,5,6,0.92)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span className="mono" style={{ fontSize: "11.5px", color: "#EAF0FA", letterSpacing: "0.02em" }}>
                  {p.tag}
                </span>
                <span className="mono" style={{ fontSize: "9px", color: "#5F6875" }}>
                  {String.fromCharCode(945 + i)}
                </span>
              </div>
              <div style={{ marginTop: "12px", fontSize: "13.5px", fontWeight: 600, color: "#F3F6FB" }}>
                {p.title}
              </div>
              <div style={{ marginTop: "6px", fontSize: "12px", lineHeight: 1.5, color: "#8B94A1" }}>
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* OBSERVATION LOG — the attack flow as a transit timeline */}
      <section id="flow" style={{ padding: "60px 0 44px" }}>
        <div
          className="obs-flow-head"
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "28px", flexWrap: "wrap" }}
        >
          <div data-reveal style={{ maxWidth: "30ch" }}>
            <SectionMarker index="01" label="OBSERVATION LOG" />
            <h2
              className="obs-display"
              style={{
                marginTop: "18px",
                fontSize: "clamp(28px,3.8vw,46px)",
                lineHeight: 1.02,
                letterSpacing: "-0.015em",
                fontWeight: 500,
                color: "#F3F6FB",
              }}
            >
              The transit of a{" "}
              <em style={{ fontStyle: "italic", fontWeight: 400, color: "#EAF0FA" }}>
                poisoned memory
              </em>
            </h2>
          </div>
          <p
            data-reveal
            style={{ maxWidth: "40ch", fontSize: "13.5px", lineHeight: 1.62, color: "#8B94A1" }}
          >
            Promptfoo tells you a prompt failed. Constellan charts the graph
            anatomy of how poisoned context reached the agent — nine recorded
            observations, one severed star.
          </p>
        </div>

        <div
          data-reveal
          className="obs-log"
          style={{ marginTop: "36px", borderTop: "1px solid rgba(234,240,250,0.08)" }}
        >
          {FLOW_STEPS.map((f) => (
            <div
              key={f.n}
              className="obs-log-row"
              style={{
                display: "grid",
                gridTemplateColumns: "64px 1fr 200px",
                alignItems: "baseline",
                gap: "20px",
                padding: "18px 4px",
                borderBottom: "1px solid rgba(234,240,250,0.06)",
              }}
            >
              <span className="mono" style={{ fontSize: "12px", color: "#5F6875", letterSpacing: "0.06em" }}>
                {f.n}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
                <span
                  aria-hidden
                  style={{
                    flex: "0 0 auto",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: f.dot,
                    boxShadow: `0 0 7px ${f.dot}`,
                  }}
                />
                <span style={{ fontSize: "15px", fontWeight: 600, color: "#F3F6FB" }}>
                  {f.title}
                </span>
              </div>
              <span className="obs-log-desc" style={{ fontSize: "12.5px", lineHeight: 1.5, color: "#8B94A1" }}>
                {f.desc}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* INSTRUMENTS — capabilities */}
      <section id="features" style={{ padding: "48px 0" }}>
        <div
          className="obs-feat-head"
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", flexWrap: "wrap" }}
        >
          <div data-reveal style={{ maxWidth: "30ch" }}>
            <SectionMarker index="02" label="INSTRUMENTS" />
            <h2
              className="obs-display"
              style={{
                marginTop: "18px",
                fontSize: "clamp(26px,3.4vw,42px)",
                lineHeight: 1.02,
                letterSpacing: "-0.015em",
                fontWeight: 500,
                color: "#F3F6FB",
              }}
            >
              A full observatory,
              <br />
              not a test runner
            </h2>
          </div>
          <p data-reveal style={{ maxWidth: "38ch", fontSize: "13px", lineHeight: 1.62, color: "#8B94A1" }}>
            Coordinated instruments replay, chart, block, quarantine, verify,
            schedule, and refine — every reading reproducible.
          </p>
        </div>

        <div
          data-reveal
          className="obs-grid-3"
          style={{
            marginTop: "30px",
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: "1px",
            background: "rgba(234,240,250,0.07)",
            border: "1px solid rgba(234,240,250,0.07)",
          }}
        >
          {FEATURES.map((c) => (
            <div
              key={c.icon}
              className="obs-card"
              style={{
                padding: "26px 22px",
                background: "rgba(4,5,6,0.92)",
                minHeight: "180px",
              }}
            >
              <div
                className="mono"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "2px",
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid rgba(234,240,250,0.2)",
                  color: "#EAF0FA",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                {c.icon}
              </div>
              <div style={{ marginTop: "18px", fontSize: "15.5px", fontWeight: 600, color: "#F3F6FB" }}>
                {c.title}
              </div>
              <div style={{ marginTop: "8px", fontSize: "12.5px", lineHeight: 1.55, color: "#8B94A1" }}>
                {c.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* REDUCTION METHOD — architecture */}
      <section id="architecture" style={{ padding: "52px 0 24px" }}>
        <SectionMarker index="03" label="REDUCTION METHOD" />
        <h2
          data-reveal
          className="obs-display"
          style={{
            marginTop: "18px",
            maxWidth: "20ch",
            fontSize: "clamp(24px,3.2vw,38px)",
            lineHeight: 1.04,
            letterSpacing: "-0.015em",
            fontWeight: 500,
            color: "#F3F6FB",
          }}
        >
          From task to evidence in one deterministic loop
        </h2>

        <div
          data-reveal
          className="obs-method"
          style={{
            marginTop: "30px",
            display: "grid",
            gridTemplateColumns: "repeat(5,1fr)",
            gap: "0",
            borderTop: "1px solid rgba(234,240,250,0.1)",
          }}
        >
          {ARCH_STAGES.map((a, i) => (
            <div
              key={a.n}
              className="obs-method-col"
              style={{
                padding: "22px 18px 22px 0",
                borderLeft: i === 0 ? "none" : "1px solid rgba(234,240,250,0.07)",
                paddingLeft: i === 0 ? 0 : "18px",
                position: "relative",
              }}
            >
              {/* node tick on the top rule */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: "-4px",
                  left: i === 0 ? 0 : "18px",
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: i === ARCH_STAGES.length - 1 ? "#fff" : "#5F6875",
                  boxShadow: i === ARCH_STAGES.length - 1 ? "0 0 8px #fff" : "none",
                }}
              />
              <div className="mono" style={{ fontSize: "10px", color: "#5F6875", letterSpacing: "0.08em" }}>
                {a.n}
              </div>
              <div style={{ marginTop: "10px", fontSize: "14px", fontWeight: 600, color: "#F3F6FB" }}>
                {a.title}
              </div>
              <div style={{ marginTop: "6px", fontSize: "11.5px", lineHeight: 1.5, color: "#8B94A1" }}>
                {a.desc}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
