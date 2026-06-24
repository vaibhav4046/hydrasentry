"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { InlineError } from "@/components/shared/StateNotice";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { SectionHeader } from "@/components/noir/SectionHeader";
import { ProviderTile } from "@/components/settings/ProviderTile";
import { getProviders, testProvider } from "@/lib/api";
import type { ProviderStatus } from "@/lib/types";

// Provider Settings. Lists every configured model provider with its role, base
// URL, model, and a MASKED key fingerprint only. Each tile can test its
// connection and links to where a key is obtained. Raw keys are never rendered.
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
    <PageShell
      kicker="PROVIDER SETTINGS"
      title="Model Providers"
      statusLabel={
        loaded ? `${configuredCount}/${providers.length} configured` : "loading"
      }
      statusTone={configuredCount > 0 ? "active" : "neutral"}
    >
      <div className="flex flex-col gap-5">
        <SectionHeader
          kicker="ROUTING"
          title="Bring your own keys"
          description="HydraSentry routes each role to a provider, falling back to a deterministic local classifier when none is configured. Keys live in the backend environment and surface here only as masked fingerprints."
        />

        <div className="mono flex items-center gap-2 rounded-lg border border-hairline bg-white/[.03] px-3.5 py-2.5 text-[12px] text-muted">
          <Shield className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          Keys are never sent to the browser. Only a sha256 fingerprint and length
          are exposed; the raw value stays server-side.
        </div>

        {error && <InlineError message={error} />}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => (
            <ProviderTile
              key={provider.name}
              provider={provider}
              onTest={() => handleTest(provider.name)}
            />
          ))}
        </div>

        {loaded && providers.length === 0 && !error && (
          <GlassPanel className="p-8 text-center text-sm text-muted">
            No providers reported by the backend.
          </GlassPanel>
        )}
      </div>
    </PageShell>
  );
}
