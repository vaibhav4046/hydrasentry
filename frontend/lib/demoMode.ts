/**
 * Tiny external store tracking whether the app is serving BUNDLED DEMO DATA
 * because the backend was unreachable (network error, timeout, CORS, non-2xx).
 *
 * lib/api.ts flips this on the first fallback. The UI reads it via
 * `useDemoMode()` (useSyncExternalStore, SSR-safe, always false on the server,
 * so first paint matches and there is no hydration mismatch) and shows a subtle,
 * honest "demo data" indicator. It never claims a live backend.
 *
 * This is a one-way latch: once any request falls back, the session is treated
 * as offline/demo until reload. A successful live request does NOT clear it,
 * because a mixed session (some live, some bundled) is still showing demo data
 * somewhere and the honest label should remain.
 */

type Listener = () => void;

let demoActive = false;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Mark that bundled demo data was served. Idempotent; notifies on transition. */
export function markDemoFallback(): void {
  if (demoActive) return;
  demoActive = true;
  emit();
}

/** Whether the session has fallen back to bundled demo data. */
export function isDemoFallbackActive(): boolean {
  return demoActive;
}

export function subscribeDemoMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Server snapshot is always false so SSR markup matches the first client paint. */
export function getDemoModeServerSnapshot(): boolean {
  return false;
}

/** Source of the data returned by an API call. */
export type ApiSource = "live" | "demo-fallback";
