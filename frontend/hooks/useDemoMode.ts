"use client";

/**
 * Subscribe to the demo-fallback latch (lib/demoMode.ts). Returns true once the
 * app has served bundled demo data because no backend was reachable. SSR-safe:
 * the server snapshot is always false, so the indicator only appears after the
 * client confirms the fallback — no hydration mismatch.
 */
import { useSyncExternalStore } from "react";
import {
  getDemoModeServerSnapshot,
  isDemoFallbackActive,
  subscribeDemoMode,
} from "@/lib/demoMode";

export function useDemoMode(): boolean {
  return useSyncExternalStore(
    subscribeDemoMode,
    isDemoFallbackActive,
    getDemoModeServerSnapshot,
  );
}
