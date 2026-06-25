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
    return "demo";
  }
}

const nextConfig: NextConfig = {
  // Pin the workspace root to this app. The machine has multiple lockfiles
  // higher up the tree (D:\project), which otherwise makes Next infer the
  // wrong root and emit a warning.
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_BUILD_SHORT: buildShort(),
  },
};

export default nextConfig;
