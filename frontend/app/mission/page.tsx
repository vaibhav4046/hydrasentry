"use client";

import { useMemo, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { useRunDemo } from "@/hooks/useRunDemo";
import { deriveCockpit, C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";
const AUTONOMY = ["Manual", "Copilot", "Autopilot"];

/**
 * Command (Observatory), the flagship cockpit surface, ported 1:1 from the
 * Castellan source. An ACTIVE MISSION banner with a Manual/Copilot/Autopilot
 * segmented toggle, a row of four big-number metric cards, the eight-agent crew,
 * and a live activity log. All values are wired to the REAL run via
 * deriveCockpit: an engaged judge-demo run flips the posture to poisoned and
 * drives risk / scans / agent statuses / the log; idle shows the nominal
 * baseline. The top-bar Run Demo button triggers the run and this page reacts.
 */
export default function MissionPage() {
  const { run, isRunning } = useRunDemo();
  const v = useMemo(() => deriveCockpit(run, { isRunning }), [run, isRunning]);
  const [autonomy, setAutonomy] = useState("Copilot");
  const p = v.poisoned;

  // When poisoned, Autopilot is forced on (mirrors the source).
  const activeAutonomy = p ? "Autopilot" : autonomy;

  return (
    <PageShell>
      <div data-page style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* ===== ACTIVE MISSION ===== */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            padding: "20px 22px",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 16,
            background:
              "radial-gradient(120% 140% at 0% 0%,rgba(20,24,30,0.7),rgba(6,8,10,0.6))",
          }}
        >
          <div style={{ minWidth: 240 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: C.faint }}>
              ACTIVE MISSION
            </div>
            <div style={{ marginTop: 6, fontSize: 19, fontWeight: 700, color: C.ink }}>
              Protect refund agent from poisoned memory and unsafe skills
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 6,
              padding: 5,
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              background: "rgba(0,0,0,0.3)",
            }}
          >
            {AUTONOMY.map((a) => {
              const on = activeAutonomy === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAutonomy(a)}
                  style={{
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "8px 14px",
                    border: "none",
                    borderRadius: 8,
                    background: on ? "linear-gradient(180deg,#fff,#CDD3DC)" : "transparent",
                    color: on ? "#0A0A0A" : C.muted,
                    transition: "all .2s",
                  }}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== METRIC ROW ===== */}
        <div
          data-stagger
          className="cockpit-metric-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}
        >
          {v.missionMetrics.map((m) => (
            <HoverCard key={m.label} padding={18}>
              <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.14em", color: C.faint }}>
                {m.label}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 28,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: m.color,
                }}
              >
                {m.value}
              </div>
              <div style={{ marginTop: 2, fontSize: "11.5px", color: C.muted }}>{m.sub}</div>
            </HoverCard>
          ))}
        </div>

        {/* ===== CREW + ACTIVITY ===== */}
        <div className="cockpit-2col-wide" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
          {/* Agent crew */}
          <div
            style={{
              padding: 20,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              background: "rgba(255,255,255,0.012)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Agent crew</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>8 AGENTS</span>
            </div>
            <div className="cockpit-crew-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {v.agents.map((ag) => (
                <HoverCard key={ag.name} padding="11px 12px" radius={11} borderless>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        flex: "none",
                        background: ag.dot,
                        boxShadow: `0 0 8px ${ag.dot}`,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 600,
                          color: C.ink,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {ag.name}
                      </div>
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: "9.5px",
                          color: C.muted,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {ag.status}
                      </div>
                    </div>
                  </div>
                </HoverCard>
              ))}
            </div>
          </div>

          {/* Activity log */}
          <div
            style={{
              padding: 20,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              background: "#020304",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Activity log</span>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: C.accent,
                  animation: "hsPulseDot 2s ease-in-out infinite",
                }}
              />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.95 }}>
              {v.activityLog.map((l, i) => (
                <div key={i} style={{ color: l.color }}>
                  <span style={{ color: C.faint }}>{l.t}</span> {l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/**
 * Hairline card with the source's hover lift (translateY + brighter border).
 * Inline handlers mirror the source's cardHov/cardUnhov.
 */
function HoverCard({
  children,
  padding = 18,
  radius = 14,
  borderless = false,
}: {
  children: React.ReactNode;
  padding?: number | string;
  radius?: number;
  borderless?: boolean;
}) {
  return (
    <div
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = "rgba(234,240,250,0.28)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = borderless
          ? "rgba(255,255,255,0.07)"
          : "rgba(255,255,255,0.08)";
      }}
      style={{
        padding,
        border: `1px solid ${borderless ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: radius,
        background: borderless ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.015)",
        transition:
          "transform .25s cubic-bezier(.22,.61,.36,1),border-color .25s,box-shadow .25s",
      }}
    >
      {children}
    </div>
  );
}
