import type { NextConfig } from "next";

// "standalone" dipakai untuk hosting ber-Node (Render/VPS/sandbox).
// Di Vercel, output standalone tidak diperlukan — Vercel memakai build bawaannya.
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // Paket ber-binding native TIDAK boleh di-bundle webpack server — biarkan
  // dimuat dari node_modules (mencegah error modul native @libsql di Vercel).
  serverExternalPackages: ["@libsql/client", "libsql", "@prisma/adapter-libsql"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
