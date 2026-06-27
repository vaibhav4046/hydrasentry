"use client";

/**
 * Console chrome wrapper. Reuses the cockpit PageShell (sidebar + top bar) and
 * injects the UserMenu into the top-bar actions. It does NOT hard-gate the whole
 * console: the incident dashboard is intentionally viewable signed-out (it shows
 * the DEMO tenant's real rows with a "sign in to see your own" prompt). Pages
 * that strictly require a user (API keys) gate themselves via `requireUser`.
 */
import type { ReactNode } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { useAuth } from "./AuthProvider";
import { UserMenu } from "./UserMenu";
import { SignInCard } from "./SignInCard";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

interface ConsoleShellProps {
  /** When true, the page content requires a signed-in user (e.g. API keys). */
  requireUser?: boolean;
  children: ReactNode;
}

export function ConsoleShell({ requireUser = false, children }: ConsoleShellProps) {
  const { ready, configured, user } = useAuth();

  const actions = user ? <UserMenu /> : null;

  let body: ReactNode;
  if (!configured) {
    body = (
      <div className="cockpit-card" style={{ maxWidth: 520, margin: "40px auto", padding: 28, textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
          Auth is not configured for this deployment. Set
          <br />
          <span style={{ color: C.silver }}>NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
          <span style={{ color: C.silver }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</span>.
        </div>
      </div>
    );
  } else if (!ready) {
    body = (
      <div style={{ display: "grid", placeItems: "center", minHeight: 240 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>loading session…</span>
      </div>
    );
  } else if (requireUser && !user) {
    body = (
      <div style={{ padding: "32px 0" }}>
        <SignInCard />
      </div>
    );
  } else {
    body = children;
  }

  return <PageShell actions={actions}>{body}</PageShell>;
}
