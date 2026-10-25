import type { NextConfig } from "next";

// "standalone" dipakai untuk hosting ber-Node (Render/VPS/sandbox).
// Di Vercel, output standalone tidak diperlukan — Vercel memakai build bawaannya.
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
