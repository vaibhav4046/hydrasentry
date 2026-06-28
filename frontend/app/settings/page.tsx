"use client";

/**
 * Settings: SIMPLE no-login bring-your-own-LLM-key config.
 *
 * NO SIGN-IN, NO MINTING, NO SERVER PERSISTENCE. The user picks a provider,
 * opens that provider's own "Get your key" page in a new tab, pastes the key
 * (password field), picks/edits a model, Tests the connection (a REAL upstream
 * validation call -- no auth, the key is never echoed), and Saves. The key is
 * stored ONLY in this browser's localStorage (lib/byoKey.ts) and is sent
 * per-request on a run so THAT run uses their model + key. When no key is saved,
 * runs use the platform default (Groq) -- the public demo path -- shown honestly.
 *
 * The read-only platform provider matrix is still shown so a visitor sees what
 * powers the public demo.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Cpu, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { getProviders, testProviderKeyPublic } from "@/lib/api";
import { C } from "@/lib/cockpit/derive";
import { ProviderLogo } from "@/components/brand/ProviderLogos";
import { ByoKeyCard } from "@/components/settings/ByoKeyCard";
import {
  BYO_PROVIDERS,
  byoKeyServerSnapshot,
  byoKeySnapshot,
  maskKey,
  providerById,
  subscribeByoKey,
} from "@/lib/byoKey";
import type { ProviderStatus } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

function str(row: ProviderStatus | undefined, key: string, fallback = "·"): string {
  const v = row?.[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export default function SettingsPage() {
  const [platform, setPlatform] = useState<ProviderStatus[] | null>(null);
  // The saved BYO key is external browser state (localStorage). useSyncExternalStore
  // is the concurrent-safe way to read it and re-render the masked banner the
  // instant a card saves or removes a key (this tab or another tab).
  const saved = useSyncExternalStore(
    subscribeByoKey,
    byoKeySnapshot,
    byoKeyServerSnapshot,
  );

  useEffect(() => {
    let active = true;
    void getProviders().then((r) => {
      if (active && r.ok) setPlatform(r.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const savedProvider = saved ? providerById(saved.provider) : undefined;

  return (
    <PageShell>
      <div data-page data-stagger style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 className="cockpit-display" style={{ fontSize: 22, fontWeight: 650, color: C.ink }}>
            LLM provider key
          </h1>
          <p style={{ fontSize: 13, color: C.muted, maxWidth: 640, lineHeight: 1.55 }}>
            Bring your own provider, model, and key. No sign-in. Pick a provider,
            grab a key from their page, paste it, test it, and save. Your key
            stays in this browser only (never sent to us to store) and drives your
            runs. With nothing saved, runs use the platform default.
          </p>
        </header>

        {/* Current state banner: masked saved key, or "using platform default". */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
            background: saved ? "rgba(234,240,250,0.04)" : "rgba(255,255,255,0.018)",
          }}
        >
          <ShieldCheck size={16} color={saved ? C.accent : C.faint} />
          {saved && savedProvider ? (
            <span style={{ fontSize: 12.5, color: C.muted }}>
              Using{" "}
              <span style={{ color: C.ink, fontWeight: 600 }}>{savedProvider.label}</span>
              {" · "}
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.silver }}>
                {saved.model}
              </span>
              {" · key "}
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.silver }}>
                {maskKey(saved.apiKey)}
              </span>{" "}
              (stored in this browser).
            </span>
          ) : (
            <span style={{ fontSize: 12.5, color: C.muted }}>
              No key saved. Your runs use the{" "}
              <span style={{ color: C.ink }}>platform default (Groq)</span>.
            </span>
          )}
        </div>

        {/* The no-login BYO config cards: one per provider. */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionLabel icon={<Cpu size={14} color={C.accent} />} text="Your provider key" />
          <div className="cockpit-2col" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
            {BYO_PROVIDERS.map((opt) => (
              <ByoKeyCard
                key={opt.id}
                provider={opt}
                saved={saved?.provider === opt.id ? saved : undefined}
                onTest={(apiKey, model) => testProviderKeyPublic(opt.id, apiKey, model)}
              />
            ))}
          </div>
        </section>

        {/* Read-only platform matrix (powers the public demo). */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionLabel text="Platform providers (powers the public demo)" />
          <div className="cockpit-2col" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
            {(platform ?? []).map((pv) => (
              <PlatformTile key={pv.name} row={pv} />
            ))}
            {platform !== null && platform.length === 0 && (
              <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, padding: 12 }}>
                No providers reported by the backend.
              </div>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function PlatformTile({ row }: { row: ProviderStatus }) {
  const keyState = row.key as { configured?: boolean; fingerprint?: string | null } | undefined;
  const configured = Boolean(keyState?.configured ?? row.configured);
  const fingerprint = keyState?.fingerprint ?? (configured ? "configured" : "not set");
  return (
    <div
      style={{
        padding: 16,
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        background: "rgba(255,255,255,0.01)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <ProviderLogo name={row.name} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "0.1em",
            color: configured ? C.accentDim : C.faint,
          }}
        >
          {configured ? "READY" : "IDLE"}
        </span>
      </div>
      <KV k="MODEL" v={str(row, "model")} vColor={C.silver} />
      <KV k="KEY" v={fingerprint} vColor={configured ? C.silver : C.faint} />
    </div>
  );
}

function SectionLabel({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {icon}
      <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", color: C.faint, textTransform: "uppercase" }}>
        {text}
      </span>
    </div>
  );
}

function KV({ k, v, vColor }: { k: string; v: string; vColor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{k}</span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 10.5,
          color: vColor,
          textAlign: "right",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 200,
        }}
      >
        {v}
      </span>
    </div>
  );
}
