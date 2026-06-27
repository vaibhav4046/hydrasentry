"use client";

/**
 * Auth context for the HydraSentry console.
 *
 * Owns the Supabase session lifecycle: reads the persisted session on mount,
 * subscribes to auth state changes, and on every fresh sign-in calls
 * POST /auth/sync (Bearer JWT) so the backend gets-or-creates the user + tenant.
 * Exposes the access token and signed-in user to the console surfaces via
 * useAuth(). The public marketing/demo pages do not mount this provider, so they
 * never touch Supabase.
 *
 * Fail-closed: if Supabase is not configured (missing env), `configured` is
 * false and the console shows an honest notice rather than crashing.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { authSync } from "@/lib/consoleApi";

interface AuthContextValue {
  /** True once the initial session read has resolved. */
  ready: boolean;
  /** True when Supabase env is present. */
  configured: boolean;
  session: Session | null;
  user: User | null;
  token: string | null;
  /** Resolved tenant id from /auth/sync, when available. */
  tenantId: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  // Track which access tokens we have already synced, so /auth/sync fires once
  // per session, not on every token refresh tick.
  const syncedTokens = useRef<Set<string>>(new Set());

  const runSync = useCallback(async (accessToken: string) => {
    if (syncedTokens.current.has(accessToken)) return;
    syncedTokens.current.add(accessToken);
    const result = await authSync(accessToken);
    if (result.ok) setTenantId(result.data.tenant_id);
  }, []);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    if (!supabase) {
      // Defensive: configured but no client. Resolve ready off the sync path.
      const t = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(t);
    }

    let active = true;
    // getSession resolves async, so setState here is not synchronous-in-effect.
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
      if (data.session?.access_token) void runSync(data.session.access_token);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      if (next?.access_token) {
        void runSync(next.access_token);
      } else {
        setTenantId(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [configured, runSync]);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setTenantId(null);
    syncedTokens.current.clear();
  }, []);

  const value: AuthContextValue = {
    ready,
    configured,
    session,
    user: session?.user ?? null,
    token: session?.access_token ?? null,
    tenantId,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
