"use client";

/**
 * API-key management + connect-your-agent (Phase 2-FE). Requires a signed-in
 * user (ConsoleShell requireUser gates it; the SignInCard renders when signed
 * out). Lists the user's keys (GET /api-keys), creates one (POST -> the raw
 * hs_live_ key is shown ONCE in the copy-once modal), and revokes (DELETE).
 */
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { ConsoleShell } from "@/components/auth/ConsoleShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { listApiKeys, createApiKey, revokeApiKey } from "@/lib/consoleApi";
import { RawKeyModal } from "@/components/console/RawKeyModal";
import { ConnectAgentPanel } from "@/components/console/ConnectAgentPanel";
import type { ApiKey } from "@/lib/consoleTypes";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

function fmt(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}

function KeysBody() {
  const { token } = useAuth();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);

  // setState only inside the .then callback (never synchronously in the effect).
  const apply = useCallback((result: { ok: true; data: ApiKey[] } | { ok: false; error: string }) => {
    if (result.ok) {
      setKeys(result.data);
      setError(null);
    } else {
      setError(result.error);
      setKeys([]);
    }
  }, []);

  const load = useCallback(() => {
    if (!token) return;
    void listApiKeys(token).then(apply);
  }, [token, apply]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void listApiKeys(token).then((r) => {
      if (active) apply(r);
    });
    return () => {
      active = false;
    };
  }, [token, apply]);

  async function handleCreate() {
    if (!token || creating) return;
    setCreating(true);
    setError(null);
    const result = await createApiKey(name.trim() || "agent key", token);
    setCreating(false);
    if (result.ok) {
      setRawKey(result.data.raw_key);
      setName("");
      void load();
    } else {
      setError(result.error);
    }
  }

  async function handleRevoke(id: string) {
    if (!token) return;
    const result = await revokeApiKey(id, token);
    if (result.ok) void load();
    else setError(result.error);
  }

  const activeKeys = (keys ?? []).filter((k) => !k.revoked);

  return (
    <div data-page style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18, alignItems: "start" }} className="console-keys-grid">
      {/* Keys column */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <KeyRound size={16} color={C.accent} />
          <h2 className="cockpit-display" style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>
            API keys
          </h2>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: C.muted, marginBottom: 16 }}>
          A key authenticates your agent&apos;s MCP server to your tenant. The full
          key is shown once at creation, then stored only as a hash.
        </p>

        {/* Create row */}
        <div className="cockpit-card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Key label (e.g. prod-refund-agent)"
              maxLength={120}
              style={{ flex: 1, fontFamily: MONO, fontSize: 12, color: C.ink, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "9px 11px", outline: "none" }}
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating}
              className="hydra-button-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: creating ? "wait" : "pointer", flexShrink: 0 }}
            >
              <Plus size={14} strokeWidth={2} />
              {creating ? "Creating…" : "Create key"}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="cockpit-card" style={{ padding: 12, marginBottom: 14, fontFamily: MONO, fontSize: 11, color: C.silver }}>
            {error}
          </div>
        )}

        {keys === null ? (
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, padding: 12 }}>loading keys…</div>
        ) : activeKeys.length === 0 ? (
          <div className="cockpit-card" style={{ padding: 16, fontFamily: MONO, fontSize: 11.5, color: C.faint }}>
            No active keys. Create one to connect your agent.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeKeys.map((k) => (
              <div key={k.id} className="cockpit-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {k.name || "agent key"}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, marginTop: 4 }}>
                    {k.prefix}…· created {fmt(k.created_at)} · last used {fmt(k.last_used_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRevoke(k.id)}
                  className="hydra-button-danger"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 8, fontSize: 11.5, cursor: "pointer", flexShrink: 0 }}
                >
                  <Trash2 size={13} />
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connect column */}
      <ConnectAgentPanel />

      {rawKey && <RawKeyModal rawKey={rawKey} onClose={() => setRawKey(null)} />}
    </div>
  );
}

export default function KeysPage() {
  return (
    <ConsoleShell requireUser>
      <KeysBody />
    </ConsoleShell>
  );
}
