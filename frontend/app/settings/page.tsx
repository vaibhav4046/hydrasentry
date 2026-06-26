"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { getProviders, testProvider } from "@/lib/api";
import { C } from "@/lib/cockpit/derive";
import type { ProviderStatus } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

function str(p: ProviderStatus, key: string, fallback = "·"): string {
  const v = p[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/**
 * Configuration, ported 1:1 from the Castellan source. A two-column grid of
 * provider cards: a status dot + name + status pill, then BASE URL / MODEL /
 * API KEY (masked) / ROLE rows, a Test connection button and a get-key link.
 * Providers and their masked-key fingerprints come from the REAL
 * /settings/providers; Test connection hits the live /settings/providers/test.
 * Raw keys never reach the browser, only the sha256 fingerprint + length.
 */
/** Per-provider Test connection outcome. */
type TestState = "reachable" | "nokey" | "error";

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [tested, setTested] = useState<Record<string, TestState>>({});

  useEffect(() => {
    void getProviders().then((r) => {
      if (r.ok) setProviders(r.data);
    });
  }, []);

  async function handleTest(pv: ProviderStatus) {
    // A provider with no configured key can never be reachable: surface an
    // explicit "API key not set" state instead of silently doing nothing.
    if (!pv.configured) {
      setTested((prev) => ({ ...prev, [pv.name]: "nokey" }));
      return;
    }
    const r = await testProvider(pv.name);
    const ok = r.ok && Boolean(r.data.ok ?? r.data.reachable);
    setTested((prev) => ({ ...prev, [pv.name]: ok ? "reachable" : "error" }));
  }

  return (
    <PageShell>
      <div data-page data-stagger className="cockpit-2col" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
        {providers.map((pv) => {
          const testState = tested[pv.name];
          const isReachable = testState === "reachable";
          const rawStatus = isReachable
            ? "reachable"
            : str(pv, "status", pv.configured ? "online" : "idle");
          const status = rawStatus.toLowerCase();
          const on = status === "online" || status === "reachable";
          const statusCol = on ? C.accent : status === "offline" ? C.faint : C.muted;
          const statusBd = on ? "rgba(234,240,250,0.3)" : "rgba(255,255,255,0.12)";
          const dot = on ? C.accent : C.faint;
          const key = pv.masked_key ?? str(pv, "key", pv.configured ? "configured" : "not set");
          const keyCol = pv.configured ? C.silver : C.faint;
          const baseUrl = str(pv, "base_url", str(pv, "baseUrl"));
          const model = str(pv, "model");
          const role = str(pv, "role");
          const getKey = str(pv, "get_key", str(pv, "getKey", ""));

          return (
            <div
              key={pv.name}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "rgba(234,240,250,0.28)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
              style={{
                padding: 18,
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                background: "rgba(255,255,255,0.012)",
                transition: "transform .25s cubic-bezier(.22,.61,.36,1),border-color .25s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot, boxShadow: `0 0 8px ${dot}` }} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{pv.name}</span>
                </div>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: "9.5px",
                    letterSpacing: "0.1em",
                    color: statusCol,
                    border: `1px solid ${statusBd}`,
                    borderRadius: 999,
                    padding: "3px 9px",
                  }}
                >
                  {rawStatus.toUpperCase()}
                </span>
              </div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <KV k="BASE URL" v={baseUrl} vColor={C.muted} truncate />
                <KV k="MODEL" v={model} vColor={C.silver} />
                <KV k="API KEY" v={key} vColor={keyCol} />
                <KV k="ROLE" v={role} vColor={C.muted} />
              </div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => void handleTest(pv)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.32)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    }}
                    style={{
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 12,
                      padding: "8px 13px",
                      border: "1px solid rgba(255,255,255,0.16)",
                      borderRadius: 9,
                      background: "rgba(255,255,255,0.03)",
                      color: C.silver,
                      transition: "all .2s",
                    }}
                  >
                    {isReachable ? "Reachable ✓" : "Test connection"}
                  </button>
                  <span style={{ fontSize: 11, color: C.faint }}>{getKey}</span>
                </div>
                {testState === "nokey" && (
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.accent, lineHeight: 1.5 }}>
                    API key not set. Configure {pv.name} first.
                  </div>
                )}
                {testState === "error" && (
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>
                    Not reachable. Check the key and base URL.
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {providers.length === 0 && (
          <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, padding: 12 }}>
            No providers reported by the backend.
          </div>
        )}
      </div>
    </PageShell>
  );
}

function KV({ k, v, vColor, truncate }: { k: string; v: string; vColor: string; truncate?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{k}</span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: "10.5px",
          color: vColor,
          textAlign: "right",
          ...(truncate
            ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }
            : {}),
        }}
      >
        {v}
      </span>
    </div>
  );
}
