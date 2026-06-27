import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/**
 * Short build id for the cockpit footer. Prefer Vercel's commit SHA, then a
 * local git rev, then a stable fallback. Resolved at build time and exposed as a
 * NEXT_PUBLIC_* var so it ships identically to server and client.
 */
function buildShort(): string {
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercel) return vercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "local";
  }
}

/**
 * Origins the app legitimately talks to at runtime. The console fetches the
 * deployed backend and Supabase auth/REST; Supabase realtime uses wss. Keeping
 * this list explicit means the CSP's connect-src stays tight (no blanket https:).
 */
const SUPABASE_ORIGIN = "https://gwytslpqvqfewsjcqmuj.supabase.co";
const SUPABASE_WSS = "wss://gwytslpqvqfewsjcqmuj.supabase.co";
const BACKEND_ORIGIN = "https://backend-three-puce-75.vercel.app";

/**
 * Content Security Policy for the whole app.
 *
 * - script-src: 'self' + 'unsafe-inline'. Next.js App Router injects inline
 *   bootstrap/hydration scripts and we do not run a per-request nonce middleware
 *   (which would risk breaking SSR + the demo). 'unsafe-eval' is deliberately
 *   omitted — nothing in the production bundle needs it (framer-motion, xyflow,
 *   and supabase-js all run without eval; eval is a dev-only HMR concern).
 * - style-src: 'unsafe-inline' is required — Tailwind v4 + Next inject inline
 *   styles and the graph flow renders an inline <style> for its edge animation.
 * - connect-src: self + Supabase (https + wss) + the backend origin only.
 * - img-src: self + data: (inline SVG/data-URI marks) + blob: (canvas exports).
 * - frame-ancestors 'none' mirrors X-Frame-Options: DENY for modern browsers.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WSS} ${BACKEND_ORIGIN}`,
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** Security response headers applied to every route. */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Pin the workspace root to this app. The machine has multiple lockfiles
  // higher up the tree (D:\project), which otherwise makes Next infer the
  // wrong root and emit a warning.
  turbopack: {
    root: __dirname,
  },
  // Do not advertise the framework via the x-powered-by header.
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BUILD_SHORT: buildShort(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
