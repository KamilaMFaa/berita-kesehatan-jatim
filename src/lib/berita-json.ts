/**
 * berita-json.ts — FALLBACK data berita dari data/articles.json (SERVER-side).
 *
 * Tujuan: bila database tidak dapat dihubungi (env Turso belum terpasang di
 * deployment, kredensial ditolak, tabel kosong, dsb.), API route tetap menyajikan
 * DATASET AKTUAL yang sama — bukan data karangan dan bukan halaman kosong.
 *
 * Sumber: data/articles.json hasil preprocessing CSV SBERT-BERTopic
 * (scripts/prepare_data.py) — file yang SAMA dengan isi tabel Article di
 * database (25.022 baris). Urutan `i` = ord (row_id) dataset.
 *
 * Pembacaan: utama lewat fs (mode Node/standalone). Bila fs gagal (bundling
 * serverless), jatuh ke salinan yang di-bundle lewat require() — isi identik.
 * Hasil parse di-cache di level modul (sekali per cold-start).
 *
 * Kunci ringkas pada articles.json:
 *  i = ord, id = news_id, t = judul, s = snippet, u = url, p = penerbit,
 *  d = tanggal (YYYY-MM-DD), y = tahun, m = bulan (YYYY-MM), k = topicId
 *  (-1 = outlier), r = wilayah (kab/kota), ru = wilayah tidak pasti,
 *  g = issue_group.
 */
import { readFileSync } from "fs";
import path from "path";
import { getTopics } from "@/lib/app-data";

export interface JsonArticleRow {
  i: number;
  id: string;
  t: string;
  s: string;
  u: string;
  p: string;
  d: string;
  y: number | null;
  m: string;
  k: number;
  r: string;
  ru: boolean;
  g: string;
}

let _articles: JsonArticleRow[] | null = null;

function loadBundled(): JsonArticleRow[] | null {
  try {
    // require() (bukan import statis) agar TypeScript tidak menyimpulkan tipe
    // literal dari JSON 16+ MB — biaya tsc terlalu besar. Webpack/Turbopack
    // tetap mengikutkan berkas ini ke bundle (path literal).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("../../data/articles.json");
    const rows = (mod && (mod.default ?? mod)) as JsonArticleRow[];
    return Array.isArray(rows) && rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

function loadArticles(): JsonArticleRow[] {
  if (_articles !== null) return _articles;
  try {
    const p = path.join(process.cwd(), "data", "articles.json");
    const parsed = JSON.parse(readFileSync(p, "utf-8")) as JsonArticleRow[];
    _articles = Array.isArray(parsed) && parsed.length > 0 ? parsed : loadBundled();
  } catch {
    _articles = loadBundled();
  }
  if (_articles === null) {
    throw new Error("FALLBACK_JSON_UNAVAILABLE");
  }
  return _articles;
}

/* ------------------------------------------------------------------ */
/* Filter — semantik identik dengan where-klause Prisma pada route     */
/* ------------------------------------------------------------------ */

export interface FilterParams {
  topicId?: number;
  region?: string;
  tahun?: number;
  dateFrom?: string;
  dateTo?: string;
  issueGroup?: string;
  q?: string;
  excludeUncertain?: boolean;
}

function matches(a: JsonArticleRow, f: FilterParams): boolean {
  if (f.topicId !== undefined && a.k !== f.topicId) return false;
  if (f.region !== undefined && (a.r ?? "") !== f.region) return false;
  if (f.tahun !== undefined && (a.y ?? -1) !== f.tahun) return false;
  if (f.issueGroup !== undefined && (a.g ?? "") !== f.issueGroup) return false;
  if (f.excludeUncertain && (a.ru ?? false)) return false;
  // Tanggal: string YYYY-MM-DD — perbandingan leksikografis setara tanggal
  // (baris dengan tanggal kosong gugur, sama seperti filter gte/lte di DB).
  if (f.dateFrom && !(a.d && a.d >= f.dateFrom)) return false;
  if (f.dateTo && !(a.d && a.d <= f.dateTo)) return false;
  // contains di connector Prisma+SQLite bersifat CASE-INSENSITIVE (ASCII) —
  // fallback JSON mengikuti perilaku yang sama.
  if (f.q && !(a.t ?? "").toLowerCase().includes(f.q.toLowerCase())) return false;
  return true;
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortRows(rows: JsonArticleRow[], sort: string): JsonArticleRow[] {
  if (sort === "tanggal_asc") {
    rows.sort((a, b) => cmpStr(a.d, b.d) || a.i - b.i);
  } else if (sort === "penerbit") {
    rows.sort((a, b) => cmpStr(a.p, b.p) || cmpStr(b.d, a.d));
  } else {
    // tanggal_desc (default): tanggal terbaru, lalu ord terbesar
    rows.sort((a, b) => cmpStr(b.d, a.d) || b.i - a.i);
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* API publik — bentuk respons SAMA PERSIS dengan route database       */
/* ------------------------------------------------------------------ */

export interface ArticleListItem {
  id: string;
  title: string;
  snippet: string;
  url: string;
  publisher: string;
  publishedAt: string;
  topicId: number;
  region: string;
  regionTidakPasti: boolean;
  issueGroup: string;
}

/** Daftar berita terfilter + paginasi — pengganti /api/articles dari JSON. */
export function listArticlesJson(
  opts: FilterParams & { page: number; pageSize: number; sort: string },
): {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: ArticleListItem[];
  sumber: "json";
} {
  const filtered = loadArticles().filter((a) => matches(a, opts));
  sortRows(filtered, opts.sort);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / opts.pageSize));
  const page = Math.min(opts.page, totalPages);
  // replikasi perilaku route DB: item diambil dari halaman yang DIMINTA
  // (bila melebihi total halaman, items kosong; nomor halaman tetap di-clamp)
  const start = (opts.page - 1) * opts.pageSize;
  const items: ArticleListItem[] = filtered
    .slice(start, start + opts.pageSize)
    .map((a) => ({
      id: a.id,
      title: a.t ?? "",
      snippet: a.s ?? "",
      url: a.u ?? "",
      publisher: a.p ?? "",
      publishedAt: a.d ?? "",
      topicId: a.k,
      region: a.r ?? "",
      regionTidakPasti: a.ru ?? false,
      issueGroup: a.g ?? "",
    }));

  return { total, page, pageSize: opts.pageSize, totalPages, items, sumber: "json" };
}

export interface AggregateItem {
  key: string;
  label: string;
  count: number;
}

/** Agregasi per wilayah / per topik — pengganti /api/articles/aggregate. */
export function aggregateJson(
  by: "region" | "topic",
  opts: FilterParams & { limit: number },
): { by: "region" | "topic"; total: number; items: AggregateItem[]; sumber: "json" } {
  const filtered = loadArticles().filter((a) => matches(a, opts));
  const total = filtered.length;

  const counts = new Map<string, number>();
  for (const a of filtered) {
    if (by === "region") {
      const key = a.r ?? "";
      if (key === "") continue; // berita tanpa wilayah tidak dikelompokkan
      counts.set(key, (counts.get(key) ?? 0) + 1);
    } else {
      if (a.k === -1) continue; // outlier bukan topik substantif
      const key = String(a.k);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  let items: AggregateItem[] = Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((x, y) => y.count - x.count || cmpStr(x.key, y.key))
    .slice(0, opts.limit);

  if (by === "topic") {
    const labelById = new Map(getTopics().map((t) => [t.id, t.label]));
    items = items.map((it) => ({
      key: it.key,
      label: labelById.get(Number(it.key)) ?? `Topik ${it.key}`,
      count: it.count,
    }));
  }

  return { by, total, items, sumber: "json" };
}

export interface NewsRowJson {
  title: string;
  publisher: string;
  publishedAt: string;
  region: string;
}

/** Berita terbaru terfilter — pengganti queryLatestNews() pada /api/chat. */
export function latestNewsJson(
  regions: string[] | null,
  titleKeyword: string | null,
  limit = 8,
): NewsRowJson[] {
  const filtered = loadArticles().filter((a) => {
    if (!a.d) return false; // publishedAt tidak boleh kosong
    if (regions && regions.length > 0 && !regions.includes(a.r ?? "")) return false;
    if (titleKeyword && !(a.t ?? "").toLowerCase().includes(titleKeyword.toLowerCase()))
      return false;
    return true;
  });
  sortRows(filtered, "tanggal_desc");
  return filtered.slice(0, limit).map((a) => ({
    title: a.t ?? "",
    publisher: a.p ?? "",
    publishedAt: a.d ?? "",
    region: a.r ?? "",
  }));
}
