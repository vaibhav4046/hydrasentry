"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { SignInCard } from "@/components/auth/SignInCard";
import {
  getProvidersConfig,
  saveProvider,
  testProviderKey,
  deleteProvider,
} from "@/lib/consoleApi";
import { C } from "@/lib/cockpit/derive";
import { ProviderLogo } from "@/components/brand/ProviderLogos";
import {
  ProviderConfigCard,
  type ProviderOption,
} from "@/components/settings/ProviderConfigCard";
import type {
  ProvidersPayload,
  ProviderStatusRow,
  ProviderTestOutcome,
  TenantProviderCredential,
} from "@/lib/consoleTypes";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/** The providers a user may bring their own key for (mirrors backend
 *  provider_credentials.ALLOWED_PROVIDERS). Defaults come from the platform
 *  matrix the backend returns, so the model/get-key hints stay in one place. */
const BYO_PROVIDERS = ["groq", "openai", "anthropic", "gemini", "openrouter"];

function str(row: ProviderStatusRow | undefined, key: string, fallback = "·"): string {
  const v = row?.[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/**
 * Settings: bring-your-own-LLM-provider configuration.
 *
 * Signed in -> a WRITABLE config: add a provider + model + paste a key, Test
 * (real backend validation), Save (encrypted at rest), Remove. A configured
 * provider shows only its masked fingerprint -- the raw key is never rendered
 * back. Signed out -> the read-only platform status + a sign-in CTA, plus an
 * honest "using platform default" note. The platform matrix is always shown so
 * a judge sees what powers the public demo.
 */
export default function SettingsPage() {
  const { ready, configured: authConfigured, token, user } = useAuth();
  const [payload, setPayload] = useState<ProvidersPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return getProvidersConfig(token ?? undefined).then((r) => {
      if (r.ok) setPayload(r.data);
      setLoading(false);
    });
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void getProvidersConfig(token ?? undefined).then((r) => {
      if (!active) return;
      if (r.ok) setPayload(r.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [ready, token]);

  const platform = payload?.platform ?? [];
  const credByProvider = new Map<string, TenantProviderCredential>(
    (payload?.tenant_credentials ?? []).map((c) => [c.provider, c]),
  );
  const signedIn = Boolean(user && token);
  const canConfigure = Boolean(payload?.can_configure && token);

  // Build the BYO options from the platform matrix (model + get-key defaults).
  const options: ProviderOption[] = BYO_PROVIDERS.map((name) => {
    const row = platform.find((p) => p.name === name);
    return {
      name,
      label: str(row, "label", name),
      defaultModel: str(row, "model", ""),
      getKeyUrl: str(row, "get_key_url", ""),
    };
  });

  async function handleSave(provider: string, model: string, apiKey: string) {
    if (!token) return { ok: false, error: "sign in first" };
    const r = await saveProvider({ provider, model, api_key: apiKey }, token);
    if (r.ok) await refresh();
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  async function handleTest(
    provider: string,
    apiKey: string | undefined,
    model: string,
  ): Promise<ProviderTestOutcome | null> {
    if (!token) return null;
    const r = await testProviderKey(provider, token, apiKey, model);
    return r.ok ? r.data : { ok: false, status: "error", detail: r.error };
  }

  async function handleRemove(provider: string) {
    if (!token) return { ok: false, error: "sign in first" };
    const r = await deleteProvider(provider, token);
    if (r.ok) await refresh();
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  return (
    <PageShell>
      <div data-page data-stagger style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 className="cockpit-display" style={{ fontSize: 22, fontWeight: 650, color: C.ink }}>
            LLM provider
          </h1>
          <p style={{ fontSize: 13, color: C.muted, maxWidth: 620, lineHeight: 1.55 }}>
            Bring your own provider, model, and key. When you save a valid
            provider, your runs (the agent and the judge) route through it
            instead of the platform default. The key is encrypted at rest and
            never shown back to you.
          </p>
        </header>

        {/* Writable config: signed in only. */}
        {signedIn && canConfigure && (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionLabel icon={<ShieldCheck size={14} color={C.accent} />} text="Your providers" />
            {payload && !payload.encryption_available && (
              <Notice text="Encryption is not configured on this deployment; saving a key is disabled until ENCRYPTION_KEY (or APP_SECRET) is set." />
            )}
            <div className="cockpit-2col" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
              {options.map((opt) => (
                <ProviderConfigCard
                  key={opt.name}
                  option={opt}
                  saved={credByProvider.get(opt.name)}
                  onSave={(model, apiKey) => handleSave(opt.name, model, apiKey)}
                  onTest={(apiKey, model) => handleTest(opt.name, apiKey, model)}
                  onRemove={() => handleRemove(opt.name)}
                />
              ))}
            </div>
            {credByProvider.size === 0 && (
              <Notice text="No provider configured. Your runs currently use the platform default (Groq)." />
            )}
          </section>
        )}

        {/* Signed-out gate: read-only + sign-in CTA. */}
        {ready && !signedIn && (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                padding: 16,
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14,
                background: "rgba(255,255,255,0.02)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Lock size={16} color={C.faint} />
              <span style={{ fontSize: 12.5, color: C.muted }}>
                Sign in to configure your own provider. Until then, runs use the
                platform default (Groq).
              </span>
            </div>
            {authConfigured ? (
              <div style={{ maxWidth: 420 }}>
                <SignInCard />
              </div>
            ) : (
              <Notice text="Auth is not configured on this deployment, so the writable config is unavailable here. The platform default still powers the public demo." />
            )}
          </section>
        )}

        {/* Always: the read-only platform status matrix. */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionLabel text="Platform providers (powers the public demo)" />
          <div className="cockpit-2col" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
            {platform.map((pv) => (
              <PlatformTile key={pv.name} row={pv} />
            ))}
            {platform.length === 0 && !loading && (
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

function PlatformTile({ row }: { row: ProviderStatusRow }) {
  const keyState = row.key;
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

function Notice({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted, lineHeight: 1.5, padding: "8px 10px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
      {text}
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
