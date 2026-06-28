"use client";

/**
 * Writable bring-your-own-key (BYO) provider config card.
 *
 * For a signed-in user this lets them add a provider + model + paste a key
 * (password field), Test the connection (a REAL backend validation), Save
 * (encrypted at rest server-side), and Remove. The raw key is NEVER rendered
 * back: a saved provider shows only its masked sha256 fingerprint + status. The
 * key input is write-only (cleared after a successful save).
 */
import { useState } from "react";
import { KeyRound, Check, X, Loader2, Trash2, ExternalLink } from "lucide-react";
import { C } from "@/lib/cockpit/derive";
import type {
  ProviderTestOutcome,
  TenantProviderCredential,
} from "@/lib/consoleTypes";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/** A selectable provider option (the providers a user may bring a key for). */
export interface ProviderOption {
  name: string;
  label: string;
  defaultModel: string;
  getKeyUrl: string;
}

type Props = {
  option: ProviderOption;
  /** The saved (masked) credential for this provider, if any. */
  saved?: TenantProviderCredential;
  onSave: (model: string, apiKey: string) => Promise<{ ok: boolean; error?: string }>;
  onTest: (apiKey: string | undefined, model: string) => Promise<ProviderTestOutcome | null>;
  onRemove: () => Promise<{ ok: boolean; error?: string }>;
};

type Busy = "idle" | "saving" | "testing" | "removing";

export function ProviderConfigCard({ option, saved, onSave, onTest, onRemove }: Props) {
  const [model, setModel] = useState(saved?.model ?? option.defaultModel);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<Busy>("idle");
  const [test, setTest] = useState<ProviderTestOutcome | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const configured = Boolean(saved?.configured);

  async function handleTest() {
    setBusy("testing");
    setMessage(null);
    // Test the just-typed key if present; otherwise the saved one.
    const result = await onTest(apiKey.trim() || undefined, model.trim());
    setTest(result);
    setBusy("idle");
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      setMessage("Paste an API key to save.");
      return;
    }
    setBusy("saving");
    setMessage(null);
    const res = await onSave(model.trim(), apiKey.trim());
    setBusy("idle");
    if (res.ok) {
      setApiKey(""); // write-only: never keep the key in the field
      setMessage("Saved. Your runs now use this provider.");
    } else {
      setMessage(res.error ?? "Save failed.");
    }
  }

  async function handleRemove() {
    setBusy("removing");
    setMessage(null);
    const res = await onRemove();
    setBusy("idle");
    setTest(null);
    setMessage(res.ok ? "Removed. Falling back to the platform default." : res.error ?? "Remove failed.");
  }

  const testColor =
    test?.ok ? C.accent : test ? "#E8B4B4" : C.faint;
  const testLabel = test
    ? test.ok
      ? `valid${test.http_status ? ` (${test.http_status})` : ""}`
      : `${test.status ?? "error"}${test.http_status ? ` (${test.http_status})` : ""}`
    : null;

  return (
    <div
      style={{
        padding: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        background: configured ? "rgba(234,240,250,0.03)" : "rgba(255,255,255,0.012)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <KeyRound size={15} color={configured ? C.accent : C.faint} />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{option.label}</span>
        </div>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9.5,
            letterSpacing: "0.1em",
            color: configured ? C.accent : C.faint,
            border: `1px solid ${configured ? "rgba(234,240,250,0.3)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 999,
            padding: "3px 9px",
          }}
        >
          {configured ? "CONFIGURED" : "NOT SET"}
        </span>
      </div>

      {configured && saved && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <Row k="FINGERPRINT" v={saved.key_fingerprint} />
          <Row k="STATUS" v={saved.last_status} />
        </div>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>MODEL</span>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={option.defaultModel}
          style={inputStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>
          API KEY {configured ? "(paste to replace)" : ""}
        </span>
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={configured ? "•••••••• (stored, encrypted)" : "paste your key"}
          style={inputStyle}
        />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={handleTest} disabled={busy !== "idle"} style={btnStyle}>
          {busy === "testing" ? <Loader2 size={13} className="spin" /> : null}
          Test connection
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy !== "idle"}
          style={{ ...btnStyle, color: C.ink, borderColor: "rgba(234,240,250,0.32)" }}
        >
          {busy === "saving" ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
          Save
        </button>
        {configured && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy !== "idle"}
            style={{ ...btnStyle, color: "#E8B4B4" }}
          >
            {busy === "removing" ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
            Remove
          </button>
        )}
        <a
          href={option.getKeyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginLeft: "auto", fontSize: 11, color: C.faint, display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          Get a key <ExternalLink size={11} />
        </a>
      </div>

      {testLabel && (
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: testColor, display: "flex", alignItems: "center", gap: 5 }}>
          {test?.ok ? <Check size={12} /> : <X size={12} />}
          {testLabel}
          {test?.detail ? ` · ${test.detail}` : ""}
        </div>
      )}
      {message && (
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted }}>{message}</div>
      )}
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{k}</span>
      <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.silver }}>{v}</span>
    </div>
  );
}
