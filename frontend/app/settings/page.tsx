"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { InlineError } from "@/components/shared/StateNotice";
import { CockpitCard } from "@/components/shell/CockpitCard";
import { ProviderTile } from "@/components/settings/ProviderTile";
import { getProviders, testProvider } from "@/lib/api";
import type { ProviderStatus } from "@/lib/types";

// Configuration. Lists every configured model provider with its role, base URL,
// model, and a MASKED key fingerprint only. Each tile can test its connection
// and links to where a key is obtained. Raw keys are never rendered. Reskinned
// to the flat-cockpit system to match Command.
export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void getProviders().then((result) => {
      if (!active) return;
      setLoaded(true);
      if (result.ok) setProviders(result.data);
      else setError(result.error);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleTest(name: string): Promise<boolean> {
    const result = await testProvider(name);
    return result.ok && Boolean(result.data.ok ?? result.data.reachable);
  }

  const configuredCount = providers.filter((p) => p.configured).length;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        {/* ===== ROUTING intro ===== */}
        <section className="cockpit-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="cockpit-eyebrow">Routing</div>
              <h2 className="mt-3 max-w-2xl text-[1.5rem] font-semibold leading-tight tracking-tight text-ink">
                Bring your own keys
              </h2>
              <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted">
                HydraSentry routes each role to a provider, falling back to a
                deterministic local classifier when none is configured. Keys live
                in the backend environment and surface here only as masked
                fingerprints.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 lg:flex-col lg:items-end">
              <span className="cockpit-eyebrow">Configured</span>
              <span className="text-[1.6rem] font-semibold leading-none tracking-tight text-ink tabular-nums">
                {loaded ? `${configuredCount}/${providers.length}` : "—"}
              </span>
            </div>
          </div>
          <div className="mono mt-5 flex items-center gap-2 rounded-lg border border-hairline bg-white/[.02] px-3.5 py-2.5 text-[12px] text-muted">
            <Shield className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            Keys are never sent to the browser. Only a sha256 fingerprint and
            length are exposed; the raw value stays server-side.
          </div>
        </section>

        {error && <InlineError message={error} />}

        {/* ===== provider cards ===== */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => (
            <ProviderTile
              key={provider.name}
              provider={provider}
              onTest={() => handleTest(provider.name)}
            />
          ))}
        </section>

        {loaded && providers.length === 0 && !error && (
          <CockpitCard className="p-8 text-center text-sm text-muted">
            No providers reported by the backend.
          </CockpitCard>
        )}
      </div>
    </PageShell>
  );
}
