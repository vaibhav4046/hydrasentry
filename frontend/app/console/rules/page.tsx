"use client";

/**
 * Detection-rule store (Phase 5-FE). NO LOGIN: the page shows the shared public
 * DEMO tenant's REAL rules (GET /rules without a token resolves the demo tenant
 * on the backend) READ-ONLY, honestly labelled. Each rule is an EXAMPLE of
 * poisoned text whose embedding the detector stores, so paraphrases of the same
 * attack get caught. Never fabricates rows (operating rule #1).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ConsoleShell } from "@/components/auth/ConsoleShell";
import { listRules } from "@/lib/consoleApi";
import { RuleTable } from "@/components/console/RuleTable";
import { TenantProvenanceBanner } from "@/components/console/TenantProvenanceBanner";
import type { DetectionRule } from "@/lib/consoleTypes";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

function RulesBody() {
  const [rules, setRules] = useState<DetectionRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Drop any list response that settles after unmount so a slow reload can't
  // write state into a dead component (e.g. token refresh + navigate-away).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const apply = useCallback(
    (result: { ok: true; data: DetectionRule[] } | { ok: false; error: string }) => {
      if (!mountedRef.current) return;
      if (result.ok) {
        setRules(result.data);
        setError(null);
      } else {
        setError(result.error);
        setRules([]);
      }
    },
    [],
  );

  // Token-less read -> the shared public demo tenant's REAL rules (read-only).
  const load = useCallback(() => {
    void listRules().then(apply);
  }, [apply]);

  useEffect(() => {
    let active = true;
    void listRules().then((r) => {
      if (active) apply(r);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  return (
    <div data-page>
      <TenantProvenanceBanner subject="detection rules" />

      <div style={{ maxWidth: 820 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <ShieldCheck size={16} color={C.accent} />
          <h2 className="cockpit-display" style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>
            Detection rules
          </h2>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: C.muted, marginBottom: 16 }}>
          A rule is an example of poisoned text. The detector embeds the
          signature so paraphrases of the same attack get caught for the
          tenant — tune detection without retraining anything.
        </p>

        {error && (
          <div
            role="alert"
            className="cockpit-card"
            style={{ padding: 12, marginBottom: 14, fontFamily: MONO, fontSize: 11, color: C.silver }}
          >
            {error}
          </div>
        )}

        <RuleTable
          rules={rules}
          token={null}
          readOnly
          onChanged={load}
          onError={setError}
        />
      </div>
    </div>
  );
}

export default function RulesPage() {
  return (
    <ConsoleShell>
      <RulesBody />
    </ConsoleShell>
  );
}
