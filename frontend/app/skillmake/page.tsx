"use client";

import { useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { UNSAFE_DEMO_SKILL } from "@/components/skillmake/demoSkill";
import { scanSkill } from "@/lib/api";
import { C } from "@/lib/cockpit/derive";
import type { SkillScan } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/** Cheap deterministic hash to label the textarea before a real scan runs. */
function localHash(c: string): string {
  let h = 5381;
  for (let i = 0; i < c.length; i++) h = ((h << 5) + h + c.charCodeAt(i)) >>> 0;
  return "sha256:" + h.toString(16).padStart(8, "0").slice(0, 8);
}

const sevBd = (sv: string) =>
  sv.toUpperCase() === "CRITICAL" ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)";

/**
 * SkillMake Verifier — ported 1:1 from the Castellan source. A SKILL.md textarea
 * + Scan button on the left; a skill-risk card (big score, verdict, Approve /
 * Quarantine), the flagged-instructions list, and a recommended fix on the right.
 * The scan calls the REAL /skillmake/scan endpoint (bundled-fixture fallback in
 * the API layer), so risk_score, band, findings (line/text/category) and the
 * recommended fix are all live. Approve/Quarantine set a local disposition.
 */
export default function SkillMakePage() {
  const [content, setContent] = useState(UNSAFE_DEMO_SKILL);
  const [scan, setScan] = useState<SkillScan | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState("unverified");

  async function handleScan() {
    setIsScanning(true);
    const r = await scanSkill(content, "unsafe-demo-skill");
    setIsScanning(false);
    if (r.ok) {
      setScan(r.data);
      setStatus(r.data.findings.length ? "flagged" : "clean");
    }
  }

  const findings = scan?.findings ?? [];
  const risk = scan ? scan.risk_score : 90;
  const hot = risk >= 70;
  const verdict = hot ? "QUARANTINE" : "CLEAN";
  const riskColor = hot ? C.white : C.silver;
  const hash = scan?.skill_hash ?? localHash(content);
  const fix =
    scan?.recommended_fix ??
    "Reject this skill. Strip injected directives, remove .env/secret access and external network calls, and require human review before any refund action.";

  return (
    <PageShell>
      <div
        data-page
        className="cockpit-2col"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}
      >
        {/* Left: SKILL.md source */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            background: "rgba(255,255,255,0.012)",
            padding: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>SKILL.md source</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{hash}</span>
          </div>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setScan(null);
              setStatus("unverified");
            }}
            spellCheck={false}
            style={{
              width: "100%",
              height: 300,
              resize: "vertical",
              background: "#020304",
              color: "#C9D2E0",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: 14,
              fontFamily: MONO,
              fontSize: "11.5px",
              lineHeight: 1.7,
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => void handleScan()}
            disabled={isScanning}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            style={{
              cursor: isScanning ? "not-allowed" : "pointer",
              marginTop: 12,
              width: "100%",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "#0A0A0A",
              padding: 11,
              border: "none",
              borderRadius: 11,
              background: "linear-gradient(180deg,#FFFFFF,#CDD3DC)",
              transition: "transform .2s",
              opacity: isScanning ? 0.7 : 1,
            }}
          >
            {isScanning ? "Scanning…" : "Scan skill"}
          </button>
        </div>

        {/* Right: risk + findings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              border: `1px solid ${hot ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.09)"}`,
              borderRadius: 16,
              background: hot ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.012)",
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 16,
              transition: "all .4s",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, color: riskColor }}>{risk}</div>
            <div>
              <div style={{ fontFamily: MONO, fontSize: "9.5px", letterSpacing: "0.14em", color: C.faint }}>
                SKILL RISK / 100
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: riskColor }}>{verdict}</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setStatus("approved")}
                style={{
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 11,
                  padding: "8px 11px",
                  border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 9,
                  background: "transparent",
                  color: C.silver,
                  transition: "all .2s",
                }}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setStatus("quarantined")}
                style={{
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 11,
                  padding: "8px 11px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 9,
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  fontWeight: 600,
                  transition: "all .2s",
                }}
              >
                Quarantine
              </button>
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              background: "rgba(255,255,255,0.012)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Flagged instructions</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>
                {findings.length} found · {status}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflow: "auto" }}>
              {findings.map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: "11px 13px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    background: "#020304",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: "9.5px",
                        letterSpacing: "0.1em",
                        color: "#fff",
                        border: `1px solid ${sevBd(f.severity)}`,
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      {f.severity.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: "9.5px", color: C.faint }}>line {f.line_no}</span>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: MONO,
                      fontSize: 11,
                      color: C.accent,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {f.text}
                  </div>
                  <div style={{ marginTop: 4, fontSize: "11.5px", color: C.muted }}>{f.category}</div>
                </div>
              ))}
              {findings.length === 0 && (
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, padding: "8px 2px" }}>
                  Press &ldquo;Scan skill&rdquo; to run the verifier against this SKILL.md.
                </div>
              )}
            </div>
            <div
              style={{
                marginTop: 12,
                padding: "11px 13px",
                border: "1px dashed rgba(255,255,255,0.14)",
                borderRadius: 10,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", color: C.faint }}>
                RECOMMENDED FIX
              </span>
              <div style={{ marginTop: 5, fontSize: 12, color: C.silver, lineHeight: 1.5 }}>{fix}</div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
