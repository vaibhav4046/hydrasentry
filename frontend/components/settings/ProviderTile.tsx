"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  CircleSlash,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { GlowButton } from "@/components/noir/GlowButton";
import { StatusPill } from "@/components/noir/StatusPill";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ProviderStatus } from "@/lib/types";

type TestState = "idle" | "testing" | "ok" | "fail";

interface ProviderTileProps {
  provider: ProviderStatus;
  onTest: () => Promise<boolean>;
  className?: string;
}

interface KeyStatus {
  configured?: boolean;
  fingerprint?: string | null;
  length?: number;
}

// Settings tile for one model provider. Shows configured status, role, base URL,
// model id, and the MASKED key fingerprint only (never the raw value). The Test
// button reflects idle/testing/ok/fail. A "where to get a key" link uses the
// provider-supplied get_key_url.
export function ProviderTile({ provider, onTest, className }: ProviderTileProps) {
  const [state, setState] = useState<TestState>("idle");

  const label =
    typeof provider.label === "string" ? provider.label : provider.name;
  const role = typeof provider.role === "string" ? provider.role : "";
  const baseUrl =
    typeof provider.base_url === "string" ? provider.base_url : "";
  const getKeyUrl =
    typeof provider.get_key_url === "string" ? provider.get_key_url : "";
  const keyStatus = (provider.key ?? {}) as KeyStatus;
  const fingerprint = keyStatus.fingerprint ?? null;
  const isLocal = provider.name === "local";

  async function handleTest() {
    setState("testing");
    try {
      setState((await onTest()) ? "ok" : "fail");
    } catch {
      setState("fail");
    }
  }

  return (
    <GlassPanel className={cn("flex flex-col gap-4 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold tracking-tight text-ink">
            {label}
          </div>
          {role && (
            <div className="mono mt-0.5 text-[10.5px] uppercase tracking-[0.14em] text-faint">
              {humanize(role)}
            </div>
          )}
        </div>
        <StatusPill
          tone={provider.configured ? "active" : "neutral"}
          label={provider.configured ? "configured" : "not set"}
        />
      </div>

      <dl className="flex flex-col gap-2">
        {provider.model && (
          <Row label="model" value={String(provider.model)} />
        )}
        {baseUrl && <Row label="base url" value={baseUrl} />}
        <div className="flex items-center justify-between gap-3">
          <dt className="mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
            key
          </dt>
          <dd className="mono flex items-center gap-1.5 text-[11.5px] text-ink/85">
            <KeyRound className="h-3 w-3 text-faint" strokeWidth={1.9} />
            {isLocal
              ? "localhost (no key)"
              : fingerprint
                ? fingerprint
                : "not set"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <GlowButton
          variant="secondary"
          size="sm"
          onClick={() => void handleTest()}
          disabled={state === "testing"}
        >
          {state === "testing" && (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
          )}
          {state === "testing" ? "Testing" : "Test connection"}
        </GlowButton>

        <div className="flex items-center gap-3">
          {state === "ok" && (
            <span className="mono inline-flex items-center gap-1.5 text-[11px] text-ink">
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} /> reachable
            </span>
          )}
          {state === "fail" && (
            <span className="mono inline-flex items-center gap-1.5 text-[11px] text-muted">
              <CircleSlash className="h-4 w-4" strokeWidth={1.8} /> failed
            </span>
          )}
          {getKeyUrl && (
            <a
              href={getKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono inline-flex items-center gap-1 text-[11px] text-muted transition hover:text-ink"
            >
              {isLocal ? "install" : "get key"}
              <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
            </a>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

interface RowProps {
  label: string;
  value: string;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
        {label}
      </dt>
      <dd className="mono max-w-[60%] truncate text-[11.5px] text-ink/85">
        {value}
      </dd>
    </div>
  );
}
