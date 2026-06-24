import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app. The machine has multiple lockfiles
  // higher up the tree (D:\project), which otherwise makes Next infer the
  // wrong root and emit a warning.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
