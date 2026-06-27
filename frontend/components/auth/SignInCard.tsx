"use client";

/**
 * Magic-link sign-in surface for the console. Calls
 * supabase.auth.signInWithOtp(email) — Supabase emails a one-time magic link;
 * clicking it lands back on the app with detectSessionInUrl establishing the
 * session. We also offer Google OAuth when the provider is enabled (it degrades
 * gracefully: a disabled provider surfaces the error honestly).
 *
 * HONEST UX: after requesting a link we show a "check your inbox" state. We do
 * NOT pretend the user is signed in — the email click is a separate step the UI
 * cannot complete for them.
 */
import { useState } from "react";
import { Mail, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

type Phase = "idle" | "sending" | "sent" | "error";

function emailLooksValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function SignInCard() {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      setPhase("error");
      setMessage("Auth is not configured for this deployment.");
      return;
    }
    if (!emailLooksValid(email)) {
      setPhase("error");
      setMessage("Enter a valid email address.");
      return;
    }
    setPhase("sending");
    setMessage("");
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/console` : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setPhase("error");
      setMessage(error.message);
      return;
    }
    setPhase("sent");
  }

  async function signInWithGoogle() {
    const supabase = getSupabase();
    if (!supabase) return;
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/console` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setPhase("error");
      setMessage(`Google sign-in unavailable: ${error.message}`);
    }
  }

  return (
    <div
      className="cockpit-card"
      style={{ maxWidth: 460, margin: "0 auto", padding: 28 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: C.accent,
            boxShadow: `0 0 8px ${C.accent}`,
          }}
        />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.18em",
            color: C.faint,
          }}
        >
          HYDRASENTRY / CONSOLE ACCESS
        </span>
      </div>
      <h1
        className="cockpit-display"
        style={{ fontSize: 22, fontWeight: 600, color: C.ink, margin: "4px 0 6px" }}
      >
        Sign in to your console
      </h1>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: C.muted, marginBottom: 18 }}>
        We send a one-time magic link. No password. Your agent&apos;s risky
        memories land in your private incident dashboard.
      </p>

      {phase === "sent" ? (
        <div
          role="status"
          style={{
            display: "flex",
            gap: 12,
            padding: 16,
            border: "1px solid rgba(234,240,250,0.2)",
            borderRadius: 12,
            background: "rgba(234,240,250,0.04)",
          }}
        >
          <CheckCircle2 size={20} color={C.accent} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>
              Check your inbox
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: C.muted, marginTop: 4 }}>
              A magic link is on the way to{" "}
              <span style={{ fontFamily: MONO, color: C.silver }}>{email.trim()}</span>.
              Click it to finish signing in. You can close this tab.
            </div>
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                setMessage("");
              }}
              className="hydra-button-ghost"
              style={{ marginTop: 12, fontSize: 12, padding: "6px 12px", borderRadius: 8 }}
            >
              Use a different email
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={sendMagicLink} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: C.faint }}>
              EMAIL
            </span>
            <div style={{ position: "relative" }}>
              <Mail
                size={15}
                color={C.faint}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                disabled={phase === "sending"}
                style={{
                  width: "100%",
                  fontFamily: MONO,
                  fontSize: 13,
                  color: C.ink,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 10,
                  padding: "11px 12px 11px 34px",
                  outline: "none",
                }}
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={phase === "sending"}
            className="hydra-button-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "11px 16px",
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: phase === "sending" ? "wait" : "pointer",
              opacity: phase === "sending" ? 0.7 : 1,
            }}
          >
            {phase === "sending" ? "Sending link…" : "Send magic link"}
            {phase !== "sending" && <ArrowRight size={15} strokeWidth={2} />}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>
            <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", color: C.ghost }}>
              OR
            </span>
            <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="hydra-button-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Continue with Google
          </button>

          {phase === "error" && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                fontFamily: MONO,
                fontSize: 11,
                lineHeight: 1.5,
                color: C.silver,
                marginTop: 2,
              }}
            >
              <AlertTriangle size={14} color={C.muted} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{message}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
