"use client";

/**
 * No-login bring-your-own-key (BYO) provider card.
 *
 * Flow: open the provider's own "Get your key" page (new tab) -> paste the key
 * (password field) -> pick/edit the model -> Test connection (a REAL upstream
 * validation, no auth, the key is never echoed back) -> Save. Saving writes the
 * key to THIS browser's localStorage only (lib/byoKey.ts); it is never sent to
 * our backend to be stored. A saved provider shows a masked key + Remove.
 */
import { useState } from "react";
import { Check, X, Loader2, Trash2, ExternalLink } from "lucide-react";
import { C } from "@/lib/cockpit/derive";
import {
  clearByoKey,
  maskKey,
  saveByoKey,
  type ByoProvider,
  type SavedByoKey,
} from "@/lib/byoKey";
import type { ApiResult, ProviderTestResult } from "@/lib/types";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

type Props = {
  provider: ByoProvider;
  /** The saved key for THIS provider, if it is the active one. */
  saved?: SavedByoKey;
  onTest: (apiKey: string, model: string) => Promise<ApiResult<ProviderTestResult>>;
};

type Busy = "idle" | "testing" | "saving";
type Verdict = { ok: boolean; label: string; detail?: string } | null;

export function ByoKeyCard({ provider, saved, onTest }: Props) {
  const [model, setModel] = useState(saved?.model ?? provider.defaultModel);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<Busy>("idle");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isActive = Boolean(saved);

  async function handleTest() {
    if (!apiKey.trim()) {
      setMessage("Paste a key to test.");
      return;
    }
    setBusy("testing");
    setMessage(null);
    const r = await onTest(apiKey.trim(), model.trim());
    setBusy("idle");
    if (!r.ok) {
      setVerdict({ ok: false, label: "unreachable", detail: r.error });
      return;
    }
    const data = r.data;
    const status = typeof data.status === "string" ? data.status : data.ok ? "valid" : "error";
    const httpStatus = typeof data.http_status === "number" ? ` (${data.http_status})` : "";
    const detail = typeof data.detail === "string" ? data.detail : undefined;
    setVerdict({ ok: Boolean(data.ok), label: `${status}${httpStatus}`, detail });
  }

  function handleSave() {
    if (!apiKey.trim()) {
      setMessage("Paste a key to save.");
      return;
    }
    setBusy("saving");
    saveByoKey({ provider: provider.id, model: model.trim() || provider.defaultModel, apiKey: apiKey.trim() });
    setApiKey(""); // write-only: never keep the raw key in the field after save
    setBusy("idle");
    setMessage("Saved in this browser. Your runs now use this key.");
  }

  function handleRemove() {
    clearByoKey();
    setApiKey("");
    setVerdict(null);
    setMessage("Removed. Falling back to the platform default.");
  }

  const verdictColor = verdict ? (verdict.ok ? C.accent : "#E8B4B4") : C.faint;

  return (
    <div
      style={{
        padding: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        background: isActive ? "rgba(234,240,250,0.03)" : "rgba(255,255,255,0.012)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{provider.label}</span>
        <a
          href={provider.getKeyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: C.accent, display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          Get your key <ExternalLink size={11} />
        </a>
      </div>

      {isActive && saved && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>SAVED KEY</span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.silver }}>{maskKey(saved.apiKey)}</span>
        </div>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>MODEL</span>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={provider.defaultModel}
          style={inputStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>
          API KEY {isActive ? "(paste to replace)" : ""}
        </span>
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={isActive ? "•••••••• (saved in this browser)" : provider.keyHint}
          style={inputStyle}
        />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => void handleTest()} disabled={busy !== "idle"} style={btnStyle}>
          {busy === "testing" ? <Loader2 size={13} className="spin" /> : null}
          Test connection
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy !== "idle"}
          style={{ ...btnStyle, color: C.ink, borderColor: "rgba(234,240,250,0.32)" }}
        >
          <Check size={13} />
          Save
        </button>
        {isActive && (
          <button type="button" onClick={handleRemove} disabled={busy !== "idle"} style={{ ...btnStyle, color: "#E8B4B4" }}>
            <Trash2 size={13} />
            Remove
          </button>
        )}
      </div>

      {verdict && (
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: verdictColor, display: "flex", alignItems: "center", gap: 5 }}>
          {verdict.ok ? <Check size={12} /> : <X size={12} />}
          {verdict.label}
          {verdict.detail ? ` · ${verdict.detail}` : ""}
        </div>
      )}
      {message && <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted }}>{message}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 12,
  padding: "8px 10px",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 8,
  background: "rgba(0,0,0,0.25)",
  color: C.silver,
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
  padding: "7px 12px",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 9,
  background: "rgba(255,255,255,0.03)",
  color: C.silver,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  transition: "all .2s",
};
