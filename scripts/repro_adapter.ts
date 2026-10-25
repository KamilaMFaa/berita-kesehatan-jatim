/**
 * repro_adapter.ts — Uji jalur adapter libSQL (jalur yang dipakai produksi
 * Vercel+Turso) secara lokal memakai URL file:, untuk memeriksa apakah
 * kombinasi versi @prisma/client dan @prisma/adapter-libsql kompatibel.
 *
 * Latar: produksi melaporkan P2010 "invalid type: unit value, expected i32"
 * pada SEMUA query ketika @prisma/client (range ^6.11.1) terpasang 6.19.2
 * sementara @prisma/adapter-libsql ter-pin 6.11.1.
 *
 * Pakai: bun scripts/repro_adapter.ts
 * (opsional) REPRO_DB_URL=file:/path/ke/db.sqlite bun scripts/repro_adapter.ts
 */
import fs from "fs";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

function versi(pkg: string): string {
  try {
    const j = JSON.parse(fs.readFileSync(`node_modules/${pkg}/package.json`, "utf8"));
    return j.version as string;
  } catch {
    return "?";
  }
}

console.log(
  "Versi terpasang:",
  `@prisma/client=${versi("@prisma/client")}`,
  `prisma=${versi("prisma")}`,
  `@prisma/adapter-libsql=${versi("@prisma/adapter-libsql")}`,
);

const url = process.env.REPRO_DB_URL ?? "file:/home/z/my-project/db/custom.db";
console.log("Adapter URL:", url.replace(/\/\/.*@/, "//***@"));

async function main() {
  const adapter = new PrismaLibSQL({
    url,
    ...(process.env.REPRO_DB_AUTH ? { authToken: process.env.REPRO_DB_AUTH } : {}),
  });
  const db = new PrismaClient({ adapter });

  const total = await db.article.count();
  console.log("count total          =", total);

  const t2 = await db.article.count({ where: { topicId: 2 } });
  console.log("count topicId=2      =", t2);

  const out = await db.article.count({ where: { topicId: -1 } });
  console.log("count topicId=-1     =", out);

  const rows = await db.article.findMany({
    where: { publishedAt: { not: "" } },
    orderBy: [{ publishedAt: "desc" }, { ord: "desc" }],
    take: 3,
    select: { title: true, publisher: true, publishedAt: true, region: true },
  });
  console.log(
    "findMany terbaru     =",
    rows.length,
    "baris; judul[0]:",
    rows[0]?.title?.slice(0, 60),
  );

  const grouped = await db.article.groupBy({
    by: ["region"],
    _count: { _all: true },
    where: { region: { not: "" } },
    orderBy: { _count: { region: "desc" } },
    take: 3,
  });
  console.log(
    "groupBy region top3  =",
    grouped.map((g) => `${g.region}:${g._count._all}`).join(", "),
  );

  console.log(">>> SEMUA QUERY OK — kombinasi versi KOMPATIBEL.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(
      ">>> REPRO GAGAL — kombinasi versi TIDAK kompatibel:",
      e instanceof Error ? e.message.split("\n").slice(0, 6).join(" | ") : e,
    );
    process.exit(1);
  });
