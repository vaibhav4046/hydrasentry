"use client";

import { useEffect } from "react";
import { useDemoStore } from "@/store/useDemoStore";

/**
 * Rehydrates the persisted demo run from sessionStorage on the client.
 *
 * The demo store uses `skipHydration: true` so server render and the first
 * client render both start from the empty baseline (no hydration mismatch). This
 * component, mounted once at the app root, triggers the deferred rehydrate after
 * mount so a persisted run (from a prior reload / another tab in the session)
 * repopulates the store and every page reflects the SAME run. Renders nothing.
 */
export function RunStoreHydrator() {
  useEffect(() => {
    void useDemoStore.persist.rehydrate();
  }, []);
  return null;
}
