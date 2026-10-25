/**
 * db-errors.ts — Pengklasifikasi error database menjadi pesan aman & dapat
 * ditindaklanjuti. Pesan yang ditampilkan ke klien TIDAK PERNAH memuat nilai
 * kredensial, URL internal, atau isi stack trace; detail lengkap tetap
 * dicatat di log server oleh pemanggil (console.error).
 */

export interface DbErrorInfo {
  /** Kode singkat untuk kategori error (dipakai frontend & pemilik situs). */
  code: string;
  /** Pesan ramah-pengguna yang boleh ditampilkan di UI. */
  pesan: string;
}

export function classifyDbError(err: unknown): DbErrorInfo {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.toLowerCase();

  // P2010 "invalid type: unit value, expected i32" = protokol serialisasi
  // parameter antara mesin query Prisma (mengikuti versi @prisma/client) dan
  // @prisma/adapter-libsql tidak cocok — biasanya karena versi kedua paket
  // berbeda (mis. client 6.19.2 vs adapter 6.11.1). Hanya muncul di jalur
  // remote (Turso), tidak di SQLite lokal.
  if (
    m.includes("invalid type: unit value") ||
    (m.includes("p2010") && m.includes("invalidarg"))
  ) {
    return {
      code: "DB_VERSION_MISMATCH",
      pesan:
        "Versi paket Prisma tidak konsisten pada deployment ini. " +
        "Pemilik situs perlu menyamakan versi @prisma/client, prisma, dan " +
        "@prisma/adapter-libsql (semua 6.19.2), memastikan bun.lock ikut " +
        "ter-commit, lalu deploy ulang.",
    };
  }

  // Env var tidak terpasang (mis. "Environment variable not found: DATABASE_URL")
  if (
    m.includes("environment variable not found") ||
    m.includes("turso_database_url") ||
    m.includes("database_url")
  ) {
    return {
      code: "DB_NOT_CONFIGURED",
      pesan:
        "Koneksi database belum dikonfigurasi pada server. " +
        "Pemilik situs perlu menyetel TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN " +
        "pada Environment Variables (Production) di Vercel, lalu deploy ulang.",
    };
  }

  // Kredensial ditolak Turso
  if (
    m.includes("unauthorized") ||
    m.includes("authentication") ||
    m.includes("forbidden") ||
    m.includes("invalid token") ||
    m.includes("jwt") ||
    m.includes("401")
  ) {
    return {
      code: "DB_AUTH",
      pesan:
        "Kredensial database ditolak oleh Turso. " +
        "Pemilik situs perlu memeriksa kecocokan TURSO_DATABASE_URL dan " +
        "TURSO_AUTH_TOKEN (token dibuat dengan `turso db tokens create`).",
    };
  }

  // Tabel/kolom tidak ada — umumnya fallback SQLite lokal kosong di serverless
  // (env Turso tidak terpasang), bukan database Turso yang memang kosong.
  if (m.includes("no such table") || m.includes("no such column")) {
    return {
      code: "DB_EMPTY",
      pesan:
        "Tabel database tidak ditemukan pada deployment ini. Penyebab paling " +
        "umum: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN belum terpasang pada " +
        "Environment Variables (Production) di Vercel sehingga aplikasi memakai " +
        "berkas SQLite lokal yang kosong — set keduanya lalu deploy ulang. " +
        "Bila env sudah benar, database memang belum diimpor: " +
        "`turso db shell <nama-db> < db/turso_dump.sql`.",
    };
  }

  // Berkas SQLite lokal tak bisa dibuka (fallback terpakai di serverless)
  if (
    m.includes("unable to open") ||
    m.includes("cantopen") ||
    m.includes("cannot open")
  ) {
    return {
      code: "DB_FILE",
      pesan:
        "Berkas database lokal tidak tersedia di server ini. " +
        "Pada hosting tanpa filesystem (Vercel), database harus diarahkan ke Turso " +
        "melalui TURSO_DATABASE_URL.",
    };
  }

  // Jaringan / DNS / timeout ke Turso
  if (
    m.includes("fetch failed") ||
    m.includes("network") ||
    m.includes("econn") ||
    m.includes("dns") ||
    m.includes("etimedout") ||
    m.includes("timeout")
  ) {
    return {
      code: "DB_NETWORK",
      pesan:
        "Server gagal menghubungi database (gangguan jaringan). " +
        "Silakan coba lagi beberapa saat.",
    };
  }

  return {
    code: "DB_ERROR",
    pesan:
      "Terjadi kesalahan pada server saat mengakses data. " +
      "Silakan coba lagi; bila berulang, periksa log fungsi server di Vercel.",
  };
}
