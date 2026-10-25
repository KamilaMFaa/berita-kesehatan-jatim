/**
 * db.ts — Prisma client tunggal untuk seluruh aplikasi.
 *
 * Dua mode koneksi (dipilih otomatis lewat environment variable):
 * 1. TURSO_DATABASE_URL terpasang  -> libSQL/Turso (dipakai di Vercel).
 *    Contoh: libsql://berita-jatim-xxx.turso.io + TURSO_AUTH_TOKEN.
 *    ( authToken opsional bila URL menunjuk file lokal — dipakai untuk pengujian. )
 * 2. Tanpa TURSO_DATABASE_URL      -> SQLite file lokal db/custom.db via
 *    DATABASE_URL di .env (dipakai saat pengembangan & hosting ber-filesystem
 *    seperti Render).
 *
 * Skema dan query sama persis di kedua mode — hanya driver koneksinya berbeda.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;

  if (tursoUrl) {
    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
    });
    return new PrismaClient({ adapter });
  }

  return new PrismaClient({
    ...(process.env.NODE_ENV !== "production" ? { log: ["query" as const] } : {}),
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

// Cache instance di semua mode (serverless pun memanfaatkan instance hang).
globalForPrisma.prisma = db;
