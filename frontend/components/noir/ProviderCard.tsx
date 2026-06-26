"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, CircleSlash } from "lucide-react";
import { GlassPanel } from "./GlassPanel";
import { GlowButton } from "./GlowButton";
import { StatusPill } from "./StatusPill";
import { cn } from "@/lib/cn";

export type ProviderTestState = "idle" | "testing" | "ok" | "fail";

interface ProviderCardProps {
  name: string;
  configured: boolean;
  model?: string;
  maskedKey?: string;
  /** Async test handler; resolves true on success. */
  onTest?: () => Promise<boolean>;
  className?: string;
}

/**
 * Settings tile for one model provider: name, configured status, model id,
 * masked key, and a Test button that reflects idle/testing/ok/fail state.
 * Stateless about the provider list, parent owns data; this owns test UI.
 */
export function ProviderCard({
  name,
  configured,
  model,
  maskedKey,
  onTest,
  className,
}: ProviderCardProps) {
  const [state, setState] = useState<ProviderTestState>("idle");

  async function handleTest() {
    if (!onTest) return;
    setState("testing");
    try {
      const ok = await onTest();
      setState(ok ? "ok" : "fail");
    } catch {
      setState("fail");
    }
  }

  return (
    <GlassPanel className={cn("flex flex-col gap-4 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold tracking-tight text-ink">
            {name}
          </div>
          {model && (
            <div className="mono mt-1 text-xs text-muted">{model}</div>
          )}
        </div>
        <StatusPill
          tone={configured ? "active" : "neutral"}
          label={configured ? "configured" : "not set"}
        />
      </div>

      <div className="mono rounded-lg border border-hairline bg-black/30 px-3 py-2 text-xs text-faint">
        {maskedKey || "key: ----"}
      </div>

      <div className="flex items-center justify-between gap-3">
        <GlowButton
          variant="secondary"
          size="sm"
          onClick={handleTest}
          disabled={!onTest || state === "testing"}
        >
          {state === "testing" && (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
          )}
          {state === "testing" ? "Testing" : "Test connection"}
        </GlowButton>
        {state === "ok" && (
          <span className="mono inline-flex items-center gap-1.5 text-xs text-ink">
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} /> reachable
          </span>
        )}
        {state === "fail" && (
          <span className="mono inline-flex items-center gap-1.5 text-xs text-muted">
            <CircleSlash className="h-4 w-4" strokeWidth={1.8} /> failed
          </span>
        )}
      </div>
    </GlassPanel>
  );
}
