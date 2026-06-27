/**
 * Supabase browser client for the HydraSentry SaaS console.
 *
 * This is the ONLY auth surface in the frontend. It uses the publishable
 * (anon) key — never a service-role / secret key — so it is safe to ship in the
 * client bundle (it can only do what an unauthenticated visitor can do until a
 * real magic-link session is established). The session is persisted by
 * supabase-js in localStorage and auto-refreshed, so a signed-in operator stays
 * signed in across reloads.
 *
 * If the two NEXT_PUBLIC_SUPABASE_* env vars are missing (e.g. a misconfigured
 * deploy) we return null rather than throw, so the public marketing/demo pages
 * still render. The console gate reads `isSupabaseConfigured()` and shows an
 * honest "auth not configured" notice instead of a blank crash.
 */
import {
  createClient,
  type SupabaseClient,
  type Session,
} from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when both public Supabase env vars are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Lazily-created singleton browser client. Created once on the client; never on
 * the server (createClient touching localStorage during SSR would throw). Guard
 * callers with `typeof window !== "undefined"` where they run at module scope.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;
  client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
  return client;
}

export type { Session };
