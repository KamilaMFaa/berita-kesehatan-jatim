/**
 * e2e_turso_routes.ts — Uji end-to-end handler route API SECARA LANGSUNG
 * terhadap Turso remote (tanpa dev server), memakai kredensial dari .env.turso.
 *
 * Memverifikasi jalur produksi yang sebenarnya:
 *   1. GET  /api/articles              → total 25.022
 *   2. GET  /api/articles?topicId=2    → total 953 (regresi)
 *   3. GET  /api/articles/aggregate    → by=region, top-3 wilayah
 *   4. POST /api/chat out-of-scope     → ditolak gerbang pra-LLM
 *   5. POST /api/chat grounded (GEMINI terpasang) → query DB sukses, error LLM
 *      terklasifikasi (sandbox diblokir wilayah Google — DISENGAJA; di produksi
 *      jalur ini terbukti sukses)
 *   6. POST /api/chat grounded (tanpa GEMINI → z-ai) → jawaban grounded penuh
 *      dengan tanggal (verifikasi e2e lengkap)
 *
 * Pakai: bun scripts/e2e_turso_routes.ts
 *   E2E_SKIP_GEMINI=1 untuk lompati tahap 5 (uji dengan key).
 */
import { readFileSync } from "fs";

/* Muat .env.turso (variabel yang belum ada di env saja) */
try {
  for (const line of readFileSync(".env.turso", "utf8").split("\n")) {
    const m = /^([A-Z_0-9]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  console.error("File .env.turso tidak ditemukan — taruh kredensial di env.");
  process.exit(1);
}
if (!process.env.TURSO_DATABASE_URL) {
  console.error("TURSO_DATABASE_URL kosong.");
  process.exit(1);
}
console.log(
  "Mode DB: Turso remote —",
  process.env.TURSO_DATABASE_URL.replace(/libsql:\/\/([^.-]+).*/, "libsql://$1***"),
);

const { GET: getArticles } = await import("../src/app/api/articles/route");
const { GET: getAggregate } = await import("../src/app/api/articles/aggregate/route");
const { POST: postChat } = await import("../src/app/api/chat/route");
const { NextRequest } = await import("next/server");

let gagal = 0;
function cek(nama: string, ok: boolean, detail: string) {
  console.log(`${ok ? "LULUS" : "GAGAL"} — ${nama}${detail ? ` | ${detail}` : ""}`);
  if (!ok) gagal++;
}

/* 1-2) articles */
const r1 = await getArticles(
  new NextRequest("http://localhost/api/articles?pageSize=1"),
);
const j1 = await r1.json();
cek(
  "articles total=25022",
  r1.status === 200 && j1.total === 25022,
  `status=${r1.status} total=${j1.total ?? JSON.stringify(j1).slice(0, 120)}`,
);

const r2 = await getArticles(
  new NextRequest("http://localhost/api/articles?topicId=2&pageSize=1"),
);
const j2 = await r2.json();
cek(
  "articles topicId=2 total=953",
  r2.status === 200 && j2.total === 953,
  `status=${r2.status} total=${j2.total ?? "-"}`,
);

/* 3) aggregate by=region */
const r3 = await getAggregate(
  new NextRequest("http://localhost/api/articles/aggregate?by=region&limit=3"),
);
const j3 = await r3.json();
cek(
  "aggregate region top1=Kota Batu:2223",
  r3.status === 200 &&
    j3.items?.[0]?.key === "Kota Batu" &&
    j3.items?.[0]?.count === 2223,
  `status=${r3.status} top=${JSON.stringify(j3.items?.[0] ?? j3).slice(0, 100)}`,
);

/* 4) chat out-of-scope (gerbang pra-LLM, tanpa DB) */
const r4 = await postChat(
  new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Apa perbedaan Python dan Java?" }],
    }),
  }),
);
const j4 = await r4.json();
cek(
  "chat out-of-scope ditolak gerbang",
  r4.status === 200 && j4.outOfScope === true,
  `status=${r4.status} outOfScope=${j4.outOfScope ?? "-"}`,
);

/* 5) chat grounded DENGAN GEMINI key — query DB wajib sukses; error LLM
 *    (blokir wilayah sandbox) membuktikan alur sampai ke pemanggilan model. */
if (process.env.E2E_SKIP_GEMINI !== "1" && process.env.GEMINI_API_KEY) {
  const r5 = await postChat(
    new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Apa berita kesehatan terkini di Bangkalan?" },
        ],
      }),
    }),
  );
  const j5 = await r5.json();
  const dbOk = r5.status !== 503 && !j5.code;
  cek(
    "chat grounded (key): DB sukses, error hanya di LLM",
    dbOk && r5.status === 502,
    `status=${r5.status} code=${j5.code ?? "-"} error=${(j5.error ?? "").slice(0, 80)}`,
  );
}

/* 6) chat grounded TANPA GEMINI → jalur z-ai → jawaban grounded penuh */
delete process.env.GEMINI_API_KEY;
const r6 = await postChat(
  new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "user", content: "Apa berita kesehatan terkini di Bangkalan?" },
      ],
    }),
  }),
);
const j6 = await r6.json();
const adaTanggal = /\b\d{1,2} (Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember) \d{4}\b/.test(
  j6.reply ?? "",
);
cek(
  "chat grounded (z-ai): jawaban penuh + tanggal",
  r6.status === 200 &&
    j6.grounded === true &&
    j6.contextCount === 8 &&
    adaTanggal,
  `status=${r6.status} grounded=${j6.grounded ?? "-"} n=${j6.contextCount ?? "-"} tanggal=${adaTanggal} cuplikan="${(j6.reply ?? j6.error ?? "").slice(0, 140).replace(/\n/g, " ")}"`,
);

console.log(gagal === 0 ? ">>> SEMUA TAHAP LULUS" : `>>> ${gagal} TAHAP GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
