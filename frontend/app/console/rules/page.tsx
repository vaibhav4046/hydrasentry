"use client";

/**
 * Detection-rule store (Phase 5-FE). NO LOGIN WALL: the page is fully viewable
 * signed-out — it shows the DEMO tenant's REAL rules (GET /rules without a token
 * resolves the demo tenant on the backend) READ-ONLY, honestly labelled. A
 * signed-in operator manages their OWN tenant's rules: each rule is an EXAMPLE of
 * poisoned text whose embedding the detector stores, so paraphrases of the same
 * attack get caught for that tenant. The add/edit/delete/import controls only
 * appear (and the backend only accepts writes) for a signed-in user; the demo
 * ruleset is read-only on both sides. Never fabricates rows (operating rule #1).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ConsoleShell } from "@/components/auth/ConsoleShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { listRules } from "@/lib/consoleApi";
import { AddRuleForm } from "@/components/console/AddRuleForm";
import { RuleTable } from "@/components/console/RuleTable";
import { RuleImportExport } from "@/components/console/RuleImportExport";
import { TenantProvenanceBanner } from "@/components/console/TenantProvenanceBanner";
import type { DetectionRule } from "@/lib/consoleTypes";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

function RulesBody() {
  const { token, user } = useAuth();
  const isSignedIn = Boolean(user);
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

  // Load unconditionally: with a token -> the user's own tenant; without ->
  // the demo tenant's REAL rules (read-only). The previous `if (!token) return`
  // left the signed-out page stuck on the loading skeleton forever even though
  // the banner promised the demo tenant's rules. `token ?? undefined` keeps the
  // demo read anonymous so the backend resolves the shared demo tenant.
  const load = useCallback(() => {
    void listRules(token ?? undefined).then(apply);
  }, [token, apply]);

  useEffect(() => {
    let active = true;
    void listRules(token ?? undefined).then((r) => {
      if (active) apply(r);
    });
    return () => {
      active = false;
    };
  }, [token, apply]);

  return (
    <div data-page>
      <TenantProvenanceBanner
        isSignedIn={isSignedIn}
        subject="detection rules"
        signedOutHref="/console/keys"
      />

      <div
        className="console-rules-grid"
        style={{
          display: "grid",
          gridTemplateColumns: isSignedIn
            ? "minmax(0,1.4fr) minmax(0,1fr)"
            : "minmax(0,1fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* Rules column */}
        <div>
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
            token={token}
            readOnly={!isSignedIn}
            onChanged={load}
            onError={setError}
          />
        </div>

        {/* Add + import/export column — management is a signed-in action. The
            demo ruleset is read-only on both the backend and here. */}
        {isSignedIn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <AddRuleForm token={token} onCreated={load} onError={setError} />
            <RuleImportExport token={token} onImported={load} onError={setError} />
          </div>
        )}
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
