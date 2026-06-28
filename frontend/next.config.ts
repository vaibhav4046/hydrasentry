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
 * Security response headers applied to every route.
 *
 * The Content-Security-Policy is NOT set here. It is owned by proxy.ts, which
 * emits a per-request `script-src 'self' 'nonce-{value}' 'strict-dynamic'`
 * policy (Next 16 stamps that nonce onto its inline hydration scripts during
 * SSR). Setting a second static CSP here would produce a conflicting duplicate
 * header, so this file emits only the static, non-nonce security headers below.
 * The connect-src allowlist (Supabase + backend) lives in proxy.ts alongside
 * the rest of the CSP directives.
 */
const SECURITY_HEADERS = [
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
