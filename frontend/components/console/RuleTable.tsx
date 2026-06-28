"use client";

/**
 * Tenant detection-rule table: name, attack type, severity badge, an enabled
 * toggle (PATCH), and delete. Renders honest loading / empty / populated states
 * — never fabricated rows. The parent owns the rule list + reload; this is the
 * presentational + per-row mutation surface.
 */
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { updateRule, deleteRule } from "@/lib/consoleApi";
import { bandColor, bandBorder } from "./bandStyle";
import type { DetectionRule } from "@/lib/consoleTypes";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

interface RuleTableProps {
  rules: DetectionRule[] | null;
  token: string | null;
  /**
   * Read-only mode for the signed-out demo ruleset: rows render with a static
   * status pill instead of an interactive toggle, and the delete control is
   * hidden. Mirrors the backend, which rejects demo-tenant writes with 403.
   */
  readOnly?: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}

function SeverityBadge({ severity }: { severity: string }) {
  const label = (severity || "").toUpperCase() || "LOW";
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9.5,
        letterSpacing: "0.1em",
        padding: "3px 7px",
        borderRadius: 6,
        color: bandColor(label),
        border: `1px solid ${bandBorder(label)}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function EnabledToggle({
  rule,
  busy,
  onToggle,
}: {
  rule: DetectionRule;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={rule.enabled}
      aria-label={`${rule.enabled ? "Disable" : "Enable"} rule ${rule.name}`}
      onClick={onToggle}
      disabled={busy}
      style={{
        position: "relative",
        width: 38,
        height: 21,
        borderRadius: 999,
        flexShrink: 0,
        cursor: busy ? "wait" : "pointer",
        background: rule.enabled ? "rgba(234,240,250,0.22)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${rule.enabled ? "rgba(234,240,250,0.4)" : "rgba(255,255,255,0.14)"}`,
        transition: "background .18s, border-color .18s",
        padding: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: rule.enabled ? 19 : 2,
          width: 15,
          height: 15,
          borderRadius: "50%",
          background: rule.enabled ? C.white : C.faint,
          transition: "left .18s, background .18s",
        }}
      />
    </button>
  );
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9.5,
        letterSpacing: "0.1em",
        padding: "3px 8px",
        borderRadius: 6,
        flexShrink: 0,
        color: enabled ? C.silver : C.faint,
        border: `1px solid ${enabled ? "rgba(234,240,250,0.22)" : "rgba(255,255,255,0.1)"}`,
        whiteSpace: "nowrap",
      }}
    >
      {enabled ? "ENABLED" : "DISABLED"}
    </span>
  );
}

export function RuleTable({ rules, token, readOnly = false, onChanged, onError }: RuleTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  // Guard against writing state / triggering a reload after unmount: a PATCH or
  // DELETE can still be in flight when the operator navigates away.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function toggle(rule: DetectionRule) {
    if (!token || busyId) return;
    setBusyId(rule.id);
    const result = await updateRule(rule.id, { enabled: !rule.enabled }, token);
    if (!mountedRef.current) return;
    setBusyId(null);
    if (result.ok) onChanged();
    else onError(result.error);
  }

  async function remove(rule: DetectionRule) {
    if (!token || busyId) return;
    setBusyId(rule.id);
    const result = await deleteRule(rule.id, token);
    if (!mountedRef.current) return;
    setBusyId(null);
    if (result.ok) onChanged();
    else onError(result.error);
  }

  if (rules === null) {
    return (
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, padding: 12 }}>
        loading rules…
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div
        className="cockpit-card"
        style={{ padding: 18, fontSize: 12.5, lineHeight: 1.6, color: C.muted }}
      >
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: C.faint, marginBottom: 8 }}>
          NO RULES YET
        </div>
        {readOnly
          ? "The demo tenant has no detection rules to show. Connect your agent to surface signatures for your own incidents."
          : "Add a signature to tune detection for your tenant. Paste an example of the poisoned text you want caught — its paraphrases will be flagged too."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rules.map((rule) => {
        const busy = busyId === rule.id;
        return (
          <div
            key={rule.id}
            className="cockpit-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              opacity: rule.enabled ? 1 : 0.62,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {rule.name || "untitled rule"}
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: C.faint,
                  marginTop: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={rule.signature_text}
              >
                {rule.attack_type || "—"} · {rule.signature_text || "no signature"}
              </div>
            </div>
            <SeverityBadge severity={rule.severity} />
            {readOnly ? (
              <StatusPill enabled={rule.enabled} />
            ) : (
              <>
                <EnabledToggle rule={rule} busy={busy} onToggle={() => void toggle(rule)} />
                <button
                  type="button"
                  onClick={() => void remove(rule)}
                  disabled={busy}
                  className="hydra-button-danger"
                  aria-label={`Delete rule ${rule.name}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 11px",
                    borderRadius: 8,
                    fontSize: 11.5,
                    cursor: busy ? "wait" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
