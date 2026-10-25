/**
 * seed.mjs — Seed database SQLite dari data/articles.json
 * Sumber data: hasil SBERT-BERTopic mode penuh (25.022 artikel).
 * Jalankan: bun scripts/seed.mjs
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "..", "data", "articles.json");

const prisma = new PrismaClient();

async function main() {
  const articles = JSON.parse(readFileSync(dataPath, "utf-8"));
  console.log(`Memuat ${articles.length} artikel dari articles.json ...`);

  await prisma.article.deleteMany();
  console.log("Tabel Article dibersihkan.");

  const CHUNK = 2000;
  for (let i = 0; i < articles.length; i += CHUNK) {
    const chunk = articles.slice(i, i + CHUNK).map((a) => ({
      id: a.id,
      ord: a.i,
      title: a.t || "(tanpa judul)",
      snippet: a.s || "",
      url: a.u || "",
      publisher: a.p || "",
      publishedAt: a.d || "",
      tahun: a.y ?? null,
      bulan: a.m || "",
      topicId: a.k,
      region: a.r || "",
      regionTidakPasti: !!a.ru,
      issueGroup: a.g || "",
    }));
    try {
      await prisma.article.createMany({ data: chunk });
    } catch (e) {
      const first = chunk[0];
      console.error(`\nGAGAL pada chunk ${i}. Contoh item:`, JSON.stringify(first, null, 2));
      console.error("Pesan error:", e.message?.slice(0, 2000));
      throw e;
    }
    process.stdout.write(`  seeded ${Math.min(i + CHUNK, articles.length)}/${articles.length}\r`);
  }
  console.log(`\nSelesai. Total baris: ${await prisma.article.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
