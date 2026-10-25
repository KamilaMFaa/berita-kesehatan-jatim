import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/env-check — diagnostik ketersediaan environment variable di runtime.
 * HANYA boolean/kategori — TIDAK PERNAH mengembalikan nilai kredensial.
 * Dipakai pemilik situs untuk memastikan apakah env var Vercel (Production)
 * benar-benar sampai ke runtime deployment.
 */
export function GET() {
  return NextResponse.json({
    tursoUrl: Boolean(process.env.TURSO_DATABASE_URL),
    tursoToken: Boolean(process.env.TURSO_AUTH_TOKEN),
    geminiKey: Boolean(process.env.GEMINI_API_KEY),
    databaseUrl: Boolean(process.env.DATABASE_URL),
    nodeEnv: process.env.NODE_ENV ?? null,
    vercel: Boolean(process.env.VERCEL),
  });
}
