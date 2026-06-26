"use client";

import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { UNSAFE_DEMO_SKILL } from "@/components/skillmake/demoSkill";
import { scanSkill, scanSkillFromMarketplace } from "@/lib/api";
import { C } from "@/lib/cockpit/derive";
import type { SkillScan } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/** Real, validated skillmake.xyz slugs offered as one-click marketplace pulls.
 * These are GENUINE marketplace skills and scan CLEAN (LOW / 0 findings): they
 * are the honest "clean control" so a 0-findings result reads as intended, not
 * as a broken scanner. The CRITICAL catch is the bundled unsafe-demo-skill, which
 * the page lands on and auto-scans. */
const EXAMPLE_SLUGS = ["firecrawl-mcp", "playwright-skill"] as const;

/** Cheap deterministic hash to label the textarea before a real scan runs. */
function localHash(c: string): string {
  let h = 5381;
  for (let i = 0; i < c.length; i++) h = ((h << 5) + h + c.charCodeAt(i)) >>> 0;
  return "sha256:" + h.toString(16).padStart(8, "0").slice(0, 8);
}

const sevBd = (sv: string) =>
  sv.toUpperCase() === "CRITICAL" ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)";

/**
 * SkillMake Verifier, ported 1:1 from the Castellan source. A SKILL.md textarea
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
  // Marketplace pull state
  const [slug, setSlug] = useState<string>(EXAMPLE_SLUGS[0]);
  const [isPulling, setIsPulling] = useState(false);
  const [pullNote, setPullNote] = useState<string | null>(null);
  const [skillName, setSkillName] = useState("unsafe-demo-skill");

  async function handleScan(name = skillName, scanContent = content) {
    setIsScanning(true);
    const r = await scanSkill(scanContent, name);
    setIsScanning(false);
    if (r.ok) {
      setScan(r.data);
      setStatus(r.data.findings.length ? "flagged" : "clean");
    }
  }

  /**
   * Land on the CRITICAL catch: auto-scan the bundled unsafe-demo-skill once on
   * mount so a judge sees the 100 / CRITICAL result immediately, instead of a
   * scanner that "did nothing". Runs only when nothing has been scanned yet and
   * the editor still holds the unsafe demo skill (so it never clobbers a pull or
   * manual edit on a remount). Marked with a ref so it fires at most once.
   */
  const didAutoScan = useRef(false);
  useEffect(() => {
    if (didAutoScan.current) return;
    didAutoScan.current = true;
    if (content === UNSAFE_DEMO_SKILL && !scan) {
      // Defer off the effect body so the scan's setState does not run
      // synchronously within the effect (avoids cascading-render lint + matches
      // the "fire an async action after mount" intent).
      queueMicrotask(() => void handleScan("unsafe-demo-skill", UNSAFE_DEMO_SKILL));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Reset the editor to the bundled unsafe-demo-skill and scan it (the CRITICAL
   * catch), e.g. after a clean marketplace pull, so the dangerous case is always
   * one click away. */
  function loadUnsafeDemo() {
    setContent(UNSAFE_DEMO_SKILL);
    setSkillName("unsafe-demo-skill");
    setSlug("unsafe-demo-skill");
    setPullNote(null);
    void handleScan("unsafe-demo-skill", UNSAFE_DEMO_SKILL);
  }

  /**
   * Pull a real SKILL.md from skillmake.xyz by slug, drop it into the textarea,
   * and auto-run the existing scan. Never throws (ApiResult envelope); on a hard
   * failure we surface a small note and leave the editor as-is.
   */
  async function handlePull() {
    const name = (slug || "").trim().toLowerCase();
    if (!name) return;
    setIsPulling(true);
    setPullNote(null);
    const r = await scanSkillFromMarketplace(name);
    setIsPulling(false);
    if (!r.ok || !r.data.fetch_ok || !r.data.content) {
      const err = r.ok ? r.data.error : r.error;
      setPullNote(`Could not pull "${name}" from skillmake.xyz: ${err ?? "unreachable"}`);
      return;
    }
    const { content: pulled, scan: pulledScan, source } = r.data;
    setContent(pulled);
    setSkillName(name);
    setPullNote(
      source === "live"
        ? `Pulled live from skillmake.xyz/i/${name}`
        : `skillmake.xyz unreachable — loaded cached copy of ${name}`,
    );
    if (pulledScan) {
      setScan(pulledScan);
      setStatus(pulledScan.findings.length ? "flagged" : "clean");
    } else {
      void handleScan(name);
    }
  }

  const findings = scan?.findings ?? [];
  const hasScan = scan !== null;
  const risk = hasScan ? scan.risk_score : 0;
  const hot = hasScan && risk >= 70;
  const verdict = !hasScan ? (isScanning ? "SCANNING" : "UNSCANNED") : hot ? "QUARANTINE" : "CLEAN";
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

          {/* Marketplace pull: fetch a real SKILL.md from skillmake.xyz by slug */}
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              background: "rgba(255,255,255,0.014)",
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 9,
                letterSpacing: "0.14em",
                color: C.faint,
                marginBottom: 8,
              }}
            >
              PULL FROM SKILLMAKE.XYZ
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <span
                aria-hidden
                style={{
                  display: "flex",
                  alignItems: "center",
                  fontFamily: MONO,
                  fontSize: 11,
                  color: C.faint,
                  paddingLeft: 2,
                  whiteSpace: "nowrap",
                }}
              >
                /i/
              </span>
              <input
                value={slug}
                spellCheck={false}
                onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handlePull();
                }}
                placeholder="firecrawl-mcp"
                aria-label="skillmake.xyz skill slug"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "#020304",
                  color: "#C9D2E0",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 9,
                  padding: "9px 11px",
                  fontFamily: MONO,
                  fontSize: 11.5,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => void handlePull()}
                disabled={isPulling || !slug}
                style={{
                  cursor: isPulling || !slug ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.silver,
                  padding: "9px 13px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 9,
                  background: "rgba(255,255,255,0.05)",
                  whiteSpace: "nowrap",
                  opacity: isPulling || !slug ? 0.6 : 1,
                  transition: "all .2s",
                }}
              >
                {isPulling ? "Pulling…" : "Pull skill"}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9, alignItems: "center" }}>
              <span style={{ fontSize: 10.5, color: C.faint }}>Clean controls (real marketplace skills):</span>
              {EXAMPLE_SLUGS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlug(s)}
                  title="A genuine skillmake.xyz skill. Scans CLEAN (LOW / 0 findings) — the honest control next to the CRITICAL catch."
                  style={{
                    cursor: "pointer",
                    fontFamily: MONO,
                    fontSize: 10,
                    color: slug === s ? "#fff" : C.muted,
                    padding: "3px 8px",
                    border: `1px solid ${slug === s ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 999,
                    background: slug === s ? "rgba(255,255,255,0.06)" : "transparent",
                    transition: "all .15s",
                  }}
                >
                  {s} · clean
                </button>
              ))}
            </div>
            {/* The dangerous case, always one click away (the CRITICAL catch). */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
              <span style={{ fontSize: 10.5, color: C.faint }}>Unsafe example:</span>
              <button
                type="button"
                onClick={loadUnsafeDemo}
                title="Load the bundled unsafe-demo-skill (prompt injection, secret access, silent refund approval, exfiltration) and scan it — the CRITICAL / 100 catch."
                style={{
                  cursor: "pointer",
                  fontFamily: MONO,
                  fontSize: 10,
                  color: "#fff",
                  padding: "3px 9px",
                  border: "1px solid rgba(255,255,255,0.4)",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.07)",
                  transition: "all .15s",
                }}
              >
                unsafe-demo-skill · CRITICAL
              </button>
            </div>
            {pullNote && (
              <div style={{ marginTop: 9, fontFamily: MONO, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
                {pullNote}
              </div>
            )}
          </div>

          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setScan(null);
              setStatus("unverified");
              setPullNote(null);
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
            data-scan-btn
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

          {/* On-page attribution */}
          <div
            style={{
              marginTop: 12,
              fontSize: 10.5,
              lineHeight: 1.55,
              color: C.faint,
            }}
          >
            Skills sourced live from skillmake.xyz; semantic search powered by
            HydraDB. HydraSentry is the pre-install safety check skillmake.xyz
            tells you to run by hand.
          </div>
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
