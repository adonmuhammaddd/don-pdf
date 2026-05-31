import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export → produces an `out/` folder of plain files you can
  // upload to any static host. The app is fully client-side and hash-routed,
  // and every PDF tool runs in the browser — no Node server, no uploads.
  output: "export",

  // Pin the workspace root — a stray lockfile in the home directory otherwise
  // makes Turbopack infer the wrong root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
