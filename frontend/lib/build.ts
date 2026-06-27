/**
 * Short build identifier surfaced in the cockpit sidebar footer. Baked at build
 * time from NEXT_PUBLIC_BUILD_SHORT (set in next.config from the git short SHA);
 * falls back to a stable label so SSR and client render identically with no
 * hydration mismatch.
 */
export const BUILD_SHORT: string =
  process.env.NEXT_PUBLIC_BUILD_SHORT?.slice(0, 7) || "local";
