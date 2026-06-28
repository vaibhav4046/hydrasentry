"use client";

import { useEffect } from "react";
import { BACKEND_URL } from "@/lib/api";

/**
 * Fire-and-forget warm-up ping on app mount.
 *
 * The backend is serverless and can cold-start (scale-from-zero) on the first
 * request after idle. Pinging GET /health the moment the app mounts wakes the
 * function in the background so the user's first real run / query lands on an
 * already-warm instance instead of paying the cold-start latency inline.
 *
 * Deliberately silent: it ignores the response and swallows any error (a failed
 * warm-up changes nothing; the real call will simply wake the backend itself).
 * Renders no DOM. Runs once per mount, after first paint, so it never blocks
 * hydration or the value path.
 */
export function BackendWarmup() {
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .catch(() => {
        /* warm-up is best-effort; the real call will wake the backend anyway */
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);
  return null;
}
