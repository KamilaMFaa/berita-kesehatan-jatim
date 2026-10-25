import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAggregates } from "@/lib/app-data";
import { detectRegion, regionDisplayList } from "@/lib/region-match";
import { chatComplete } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/chat — Chatbot LLM dengan CAKUPAN TERBATAS (Tahap perbaikan).
 *
 * Desain (sesuai instruksi peneliti):
 * 1. PEMBATASAN TOPIK DILAKUKAN SEBELUM LLM dipanggil: validasi relevansi berbasis
 *    kata kunci (deterministik) pada pesan terakhir. Pertanyaan di luar cakupan
 *    (mis. "Apa perbedaan Python dan Java?") DITOLAK DI SINI — tidak pernah sampai
 *    ke model. System prompt hanya lapisan kedua (defense in depth).
 * 2. PERTANYAAN BERITA TERKINI dijawab dari DATASET APLIKASI melalui QUERY
 *    TERSTRUKTUR (filter kolom wilayah/kata kunci/judul + urut tanggal publikasi).
 *    Ini BUKAN RAG: tidak ada embedding, vector database, atau retrieval semantik,
 *    dan TIDAK ADA akses internet/Web Search API. Hasil query (maks. 8 berita
 *    terbaru beserta tanggalnya) disisipkan sebagai konteks eksplisit untuk LLM,
 *    yang wajib menyebut tanggal dan sumbernya (dataset proyek).
 * 3. TANPA RAG / vector DB / embedding retrieval / web search / pelatihan model.
 * 4. Penyedia LLM dipilih otomatis di src/lib/llm.ts: GEMINI_API_KEY (Vercel)
 *    atau z-ai-web-dev-sdk (lingkungan Z.ai). Perilaku identik.
 *
 * Keterbatasan yang diakui: gate kata kunci dapat menolak pertanyaan dalam-cakupan
 * yang tidak memuat istilah yang dikenali (false reject) atau melewatkan pertanyaan
 * borderline ke lapisan system prompt. Pendekatan kata kunci dipilih karena
 * deterministik, dapat diaudit, dan tidak menambah panggilan model.
 */

/* ------------------------------------------------------------------ */
/* System prompt                                                       */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `Kamu adalah "Asisten Eksplorasi" pada website "Berita Kesehatan Jawa Timur" — website penelitian untuk menjelajahi 25.022 berita kesehatan-lingkungan Jawa Timur yang diproses dengan SBERT dan BERTopic.

CAKUPANMU SANGAT TERBATAS. Kamu HANYA membahas:
1. Kesehatan masyarakat & kesehatan lingkungan: sanitasi, kebersihan, sampah & pengelolaannya (TPS/TPA/TPS 3R/bank sampah), banjir & genangan, air bersih & PDAM, limbah & pencemaran (air/udara/tanah), drainase, kekeringan, asap & bau.
2. Penjelasan KONSEP & ISTILAH kesehatan umum dengan bahasa sederhana: gizi, stunting, imunisasi, kesehatan ibu dan anak, DBD, diare, ISPA, dan istilah serupa.
3. Berita yang ADA di dataset proyek ini — dan hanya bila konteks beritanya diberikan kepada kamu pada pesan sistem (lihat bawah).

DI LUAR CAKUPAN — TOLAK DENGAN SOPAN:
- Pengetahuan umum non-kesehatan/lingkungan: pemrograman (Python, Java, dll.), teknologi, matematika, olahraga, politik, hiburan, sejarah, curhat pribadi, dan sejenisnya.
- Jika ditanya hal di luar cakupan: mohon maaf dengan sopan, jelaskan bahwa kamu hanya membahas kesehatan masyarakat, kesehatan lingkungan, dan berita dalam dataset proyek ini, lalu ajukan contoh topik yang bisa kamu bantu. JANGAN menjawab isi pertanyaannya.

ATURAN BERITA (WAJIB PATUH):
- Kamu TIDAK memiliki akses internet, tidak bisa mencari berita, dan TIDAK mengetahui berita yang terbit hari ini. Jangan pernah mengaku mengetahui kejadian terkini di luar dataset.
- Kamu HANYA boleh menyebut judul, tanggal, wilayah, atau penerbit berita yang TERTULIS pada blok "KONTEKS BERITA DATASET" di pesan sistem. Jika blok itu tidak ada, jangan menyebut berita spesifik apa pun — jelaskan keterbatasanmu dan arahkan ke menu "Filter Topik dan Persebaran" di website.
- Saat menjawab dari konteks berita: sebutkan TANGGAL publikasi tiap berita dan nyatakan bahwa jawabanmu berdasarkan dataset proyek (bukan berita real-time). Jangan mengarang judul, tanggal, lokasi, sumber, statistik, atau tautan. Tautan artikel tidak tersedia untukmu.
- Jika konteks berita tidak menjawab pertanyaan pengguna (atau kosong), katakan dengan jujur bahwa dataset tidak memiliki data yang mendukung, jelaskan keterbatasannya, dan sarankan menu "Filter Topik dan Persebaran".

BATASAN LAIN:
- Kamu BUKAN tenaga medis. JANGAN memberi diagnosis, resep, dosis, atau keputusan pengobatan individual; sarankan konsultasi ke puskesmas/dokter untuk keluhan pribadi.
- Jangan mengarang jadwal imunisasi, pedoman resmi, atau statistik kesehatan yang tidak kamu yakini; sarankan sumber resmi (mis. Kemenkes) bila informasi bergantung pada pedoman terbaru.
- Jika tidak tahu, katakan jujur kamu tidak mengetahuinya.
- Jawab selalu dalam bahasa Indonesia yang ramah, ringkas, dan terstruktur (poin-poin bila perlu). Maksimal sekitar 250 kata kecuali pengguna meminta lebih rinci.

KONTEKS PROYEK (fakta statis dataset, boleh disebut bila relevan):
- 25.022 berita media daring Jawa Timur, periode 2 Januari 2016 – 18 Oktober 2026 (tanggal terbaru yang TERSIMBUL di dataset).
- SBERT + BERTopic menghasilkan 87 topik reguler; 37,3% dokumen outlier. Isu dominan: sampah & limbah, banjir & genangan, air bersih, limbah & pencemaran, sanitasi, bau & pencemaran udara.
- Persebaran 38 kabupaten/kota; wilayah terbanyak antara lain Kota Batu, Kota Surabaya, Kabupaten Sidoarjo, Kabupaten Malang.
- Pengguna menjelajah berita lewat menu "Filter Topik dan Persebaran".`;

/* ------------------------------------------------------------------ */
/* Pembatasan topik: kata kunci cakupan (dipakai SEBELUM LLM)          */
/* ------------------------------------------------------------------ */

/** Kata kunci kesehatan masyarakat, lingkungan, dan penyakit (bahasa Indonesia). */
const HEALTH_KEYWORDS: string[] = [
  // istilah umum
  "kesehatan", "sehat", "sakit", "penyakit", "gejala", "paparan", "wabah", "epidemi", "endemi",
  "outbreak", "kekebalan", "imun", "imunisasi", "vaksin", "vaksinasi", "gizi", "gizi buruk",
  "stunting", "wasting", "nutrisi", "asupan", "garam", "yodium", "anemia", "cacingan", "skabies",
  "keracunan", "racun", "higienis", "higiene", "sanitasi", "kebersihan", "cuci tangan", "jamban",
  "mck", "toilet", "septik", "septictank", "tinja", "kotoran", "feces", "ecoli", "e. coli",
  // penyakit & vektor
  "dbd", "dengue", "demam", "malaria", "diare", "muntah", "tifus", "kolera", "hepatitis",
  "leptospirosis", "tbc", "tuberkulosis", "pneumonia", "ispa", "iritasi", "gatal", "ruam",
  "kulit", "asma", "alergi", "batuk", "flu", "persalinan", "kehamilan", "ibu hamil", "ibu",
  "anak", "bayi", "balita", "lansia", "menyusui", "asi", "mpasi", "puskesmas", "rumah sakit",
  "dokter", "nakes", "tenaga kesehatan", "posyandu", "kader", "pengobatan", "penyuluhan",
  "edukasi kesehatan", "germas", "jentik", "nyamuk", "fogging", "larvasida",
  // lingkungan & isu inti proyek
  "sampah", "persampahan", "plastik", "limbah", "tps", "tpa", "tps3r", "tps 3r", "tpst",
  "bank sampah", "daur ulang", "recycle", "pembuangan", "menumpuk", "b3", "medis", "feses",
  "sludge", "fecal", "slump", "pencemaran", "tercemar", "polusi", "asap", "bau", "bau busuk",
  "gas", "metana", "emisi", "udara", "partikulat", "pm2.5", "pm10", "air bersih", "air",
  "pdam", "sumur", "mata air", "air bakar", "kekeringan", "kemarau", "kekering", "sungai",
  "kali", "danau", "waduk", "laut", "pantai", "pesisir", "brantas", "drainase", "saluran",
  "got", "gorong", "selokan", "tergenang", "genangan", "banjir", "rob", "luapan", "hujan",
  "cuaca", "iklim", "pemanasan", "kebakaran", "karhutla", "lahan", "longsor", "erupsi",
  "lahar", "semeru", "pabrik", "industri", "pltu", "tambang", "batu bara", "jamur", "tungau",
  "kelembaban", "ventilasi", "rumah sehat", "permukiman", "kumuh", "kawasan", "taman",
  "penghijauan", "lingkungan", "alam", "ekosistem",
];

/** Nama wilayah (varian pendek) — pertanyaan berita per daerah diizinkan. */
const REGION_SHORTS: string[] = [
  "bangkalan", "banyuwangi", "blitar", "bojonegoro", "bondowoso", "gresik", "jember",
  "jombang", "kediri", "lamongan", "lumajang", "madiun", "magetan", "malang", "mojokerto",
  "nganjuk", "ngawi", "pacitan", "pamekasan", "pasuruan", "ponorogo", "probolinggo",
  "sampang", "sidoarjo", "situbondo", "sumenep", "trenggalek", "tuban", "tulungagung",
  "surabaya", "kota batu", "jawa timur", "jatim",
];

/** Kata kunci spesifik proyek/website (bukan istilah umum seperti "website" saja). */
const PROJECT_KEYWORDS: string[] = [
  "sbert", "bertopic", "topic modeling", "pemodelan topik", "dataset", "data proyek",
  "25.022", "25.022 berita", "topik", "peta", "persebaran", "berita kesehatan",
  "filter topik", "menu", "beranda", "tentang proyek", "penelitian", "proyek ini",
  "website ini", "situs ini", "aplikasi ini", "chatbot ini", "asisten ini", "chatbot",
  "grafik", "statistik", "outlier", "cluster", "klaster",
];

const NEWS_INTENT_KEYWORDS: string[] = [
  "berita", "kabar", "informasi", "info", "terkini", "terbaru", "kejadian", "peristiwa",
  "hari ini", "kemarin", "minggu ini", "bulan ini", "tahun ini", "apa yang terjadi",
  "ada apa", "guguran", "liputan",
];

const GREETINGS: string[] = [
  "halo", "hai", "hello", "hi", "assalamualaikum", "salam", "pagi", "siang", "sore", "malam",
  "terima kasih", "makasih", "thanks", "oke", "ok", "baik", "siap",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsWord(text: string, keyword: string): boolean {
  return new RegExp(`\\b${escapeRegex(keyword)}\\b`).test(text);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Apakah konteks percakapan sebelumnya menyentuh cakupan kesehatan/lingkungan/proyek? */
function historyHasHealthContext(history: ChatMessage[]): boolean {
  const joined = history
    .slice(0, -1)
    .map((m) => m.content.toLowerCase())
    .join(" ");
  if (!joined) return false;
  return (
    HEALTH_KEYWORDS.some((k) => containsWord(joined, k)) ||
    REGION_SHORTS.some((k) => containsWord(joined, k)) ||
    PROJECT_KEYWORDS.some((k) => containsWord(joined, k))
  );
}

/**
 * PEMERIKSAAN RELEVANSI (dipanggil SEBELUM LLM).
 * Mengembalikan true bila pesan terakhir aman diteruskan ke model.
 */
function isWithinScope(question: string, history: ChatMessage[]): boolean {
  const q = question.toLowerCase().replace(/[^\p{L}\p{N}\s.%-]/gu, " ");

  // Sapaan & basa-basi pendek selalu diizinkan (model akan memandu ke cakupan)
  if (GREETINGS.some((g) => q.trim() === g || q.trim().startsWith(`${g} `))) return true;

  if (HEALTH_KEYWORDS.some((k) => containsWord(q, k))) return true;
  if (REGION_SHORTS.some((k) => containsWord(q, k))) return true;
  if (PROJECT_KEYWORDS.some((k) => containsWord(q, k))) return true;
  if (NEWS_INTENT_KEYWORDS.some((k) => containsWord(q, k))) return true;

  // Follow-up pendek setelah percakapan yang berada dalam cakupan → izinkan
  // (model tetap dilarang keluar topik oleh system prompt)
  if (wordCount(question) <= 8 && history.length >= 2 && historyHasHealthContext(history)) {
    return true;
  }

  return false;
}

/* ------------------------------------------------------------------ */
/* Intent berita & query dataset terstruktur (BUKAN RAG)               */
/* ------------------------------------------------------------------ */

/** Kata kunci isu → filter pencarian judul (diurutkan dari frasa terpanjang). */
const ISSUE_TITLE_KEYWORDS: string[] = [
  "air bersih", "sampah plastik", "bank sampah", "tps 3r", "banjir rob", "batu bara",
  "pencemaran", "kekeringan", "kemarau", "limbah", "sanitasi", "kebersihan",
  "drainase", "genangan", "banjir", "kebakaran", "longsor", "polusi", "sungai", "plastik",
  "pdam", "tpa", "tps", "sampah", "hujan", "udara", "air",
];

function detectNewsIntent(q: string): boolean {
  return NEWS_INTENT_KEYWORDS.some((k) => containsWord(q, k));
}

function detectIssueTitleFilter(q: string): string | null {
  for (const k of ISSUE_TITLE_KEYWORDS) {
    if (containsWord(q, k)) return k;
  }
  return null;
}

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmtTanggalID(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mi = parseInt(m[2], 10) - 1;
  if (mi < 0 || mi > 11) return iso;
  return `${parseInt(m[3], 10)} ${MONTHS_ID[mi]} ${m[1]}`;
}

interface NewsRow {
  title: string;
  publisher: string;
  publishedAt: string;
  region: string;
}

/**
 * Query TERSTRUKTUR berita terbaru dari dataset (SQLite):
 * filter kolom wilayah + kata kunci judul, urut tanggal publikasi terbaru.
 * Tidak ada embedding/vektor — murni filter kolom (sesuai batasan desain).
 */
async function queryLatestNews(
  regions: string[] | null,
  titleKeyword: string | null,
  limit = 8,
): Promise<NewsRow[]> {
  const where: { publishedAt: { not: string }; region?: object; title?: object } = {
    publishedAt: { not: "" },
  };
  if (regions && regions.length > 0) where.region = { in: regions };
  if (titleKeyword) where.title = { contains: titleKeyword };

  return db.article.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { ord: "desc" }],
    take: limit,
    select: { title: true, publisher: true, publishedAt: true, region: true },
  });
}

function buildNewsContextBlock(
  rows: NewsRow[],
  regions: string[] | null,
  titleKeyword: string | null,
  dateMax: string,
): string {
  const parts: string[] = [];
  parts.push("KONTEKS BERITA DATASET (untuk pertanyaan ini):");
  parts.push(
    `Berita terbaru yang tersedia di dataset proyek${
      regions ? ` untuk wilayah: ${regionDisplayList(regions)}` : ""
    }${titleKeyword ? `, dengan kata kunci judul: "${titleKeyword}"` : ""} — diurutkan dari tanggal publikasi TERBARU yang tersedia di dataset (dataset BUKAN berita real-time; tanggal berita terbaru dalam dataset: ${fmtTanggalID(dateMax)}):`,
  );
  rows.forEach((r, i) => {
    parts.push(
      `${i + 1}. [${fmtTanggalID(r.publishedAt)}] "${r.title}" — ${
        r.publisher || "penerbit tidak tercatat"
      }${r.region ? ` — ${r.region}` : " — wilayah tidak tercatat"}`,
    );
  });
  parts.push(
    "ATURAN: Jawab HANYA berdasarkan daftar di atas. Sebutkan tanggal setiap berita yang kamu sebut dan nyatakan bahwa jawaban berdasarkan dataset proyek ini. DILARANG menambah berita lain, mengarang judul/tanggal/sumber/statistik/tautan. Tautan artikel tidak tersedia. Jika daftar ini tidak menjawab pertanyaan pengguna, katakan jujur dan jelaskan keterbatasannya.",
  );
  return `\n\n${parts.join("\n")}`;
}

/* ------------------------------------------------------------------ */
/* Util umum (rate limit, sanitize)                                    */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 16;
const MAX_CONTENT_LEN = 4000;
const TIMEOUT_MS = 55_000;

const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 5 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const msgs: ChatMessage[] = [];
  for (const m of input) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim().slice(0, MAX_CONTENT_LEN);
    if (!trimmed) continue;
    msgs.push({ role, content: trimmed });
  }
  return msgs.slice(-MAX_HISTORY);
}

const OUT_OF_SCOPE_REPLY = `Maaf, pertanyaan Anda berada di luar cakupan saya, jadi tidak saya jawab. 🙏

Saya hanya dapat membantu topik dalam lingkup proyek ini:
• **Kesehatan masyarakat & lingkungan** — mis. sanitasi, sampah (TPS/TPA/TPS 3R), banjir, air bersih, limbah & pencemaran, udara, drainase;
• **Penjelasan istilah kesehatan** — mis. stunting, gizi, imunisasi, DBD, diare, kesehatan ibu & anak;
• **Berita dalam dataset proyek** — mis. "Apa berita kesehatan terkini di Bangkalan?" (dijawab dari berita terbaru yang tersedia di dataset, lengkap dengan tanggalnya).

Silakan ajukan pertanyaan seputar topik tersebut, atau jelajahi berita langsung melalui menu **Filter Topik dan Persebaran**.`;

const NEWS_EMPTY_REPLY = (
  filters: string[],
  dateMax: string,
) => `Saya menelusuri dataset proyek (${filters.join(", ")}) namun **tidak menemukan berita yang cocok**.

Beberapa hal yang perlu diketahui:
• Dataset ini memuat 25.022 berita dengan tanggal publikasi 2 Januari 2016 – ${fmtTanggalID(dateMax)} (bukan berita real-time, jadi saya tidak bisa memberi berita hari ini).
• Dataset bukan arsip lengkap seluruh media — tidak semua kombinasi wilayah/kata kunci memiliki artikel.
• Sebagian berita mungkin berada di luar topik (outlier) sehingga tidak terwakili di pencarian ini.

Coba kata kunci yang lebih umum (mis. "sampah", "banjir", "air bersih"), pilih wilayah lain, atau gunakan menu **Filter Topik dan Persebaran** untuk menelusuri langsung dengan filter wilayah, topik, dan rentang tanggal.`;

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      {
        error:
          "Jumlah pertanyaan mencapai batas sementara. Mohon tunggu beberapa menit sebelum mencoba lagi.",
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Format permintaan tidak valid." },
      { status: 400 },
    );
  }

  const history = sanitizeMessages((body as { messages?: unknown })?.messages);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Pertanyaan tidak boleh kosong. Silakan tulis pertanyaan Anda." },
      { status: 400 },
    );
  }

  const question = history[history.length - 1].content;
  const questionLower = question.toLowerCase();

  /* ---------- 1) PEMBATASAN TOPIK SEBELUM LLM ---------- */
  if (!isWithinScope(question, history)) {
    return NextResponse.json({ reply: OUT_OF_SCOPE_REPLY, outOfScope: true });
  }

  /* ---------- 2) Intent berita → query dataset terstruktur ---------- */
  let systemPrompt = SYSTEM_PROMPT;
  let grounded = false;
  let contextCount = 0;

  if (detectNewsIntent(questionLower)) {
    const regionHit = detectRegion(question);
    const issueKeyword = detectIssueTitleFilter(questionLower);
    // Branch berita hanya aktif bila pertanyaan benar-benar meminta berita:
    // ada wilayah / kata kunci isu / kata "berita"|"kabar" secara eksplisit.
    // (mencegah pertanyaan konsep seperti "informasi tentang stunting" disisipi
    //  konteks berita yang tidak relevan)
    const explicitNewsWord =
      containsWord(questionLower, "berita") || containsWord(questionLower, "kabar");

    if (regionHit || issueKeyword || explicitNewsWord) {
      const rows = await queryLatestNews(regionHit?.regions ?? null, issueKeyword);
      const dateMax = getAggregates().dateMax ?? "";

      if (rows.length === 0) {
        // Data tidak tersedia → jawaban jujur deterministik (tanpa LLM)
        const filters: string[] = [];
        if (regionHit) filters.push(`wilayah: ${regionDisplayList(regionHit.regions)}`);
        if (issueKeyword) filters.push(`kata kunci judul: "${issueKeyword}"`);
        return NextResponse.json({
          reply: NEWS_EMPTY_REPLY(filters.length > 0 ? filters : ["seluruh dataset"], dateMax),
          noData: true,
          dateMax,
        });
      }

      systemPrompt += buildNewsContextBlock(
        rows,
        regionHit?.regions ?? null,
        issueKeyword,
        dateMax,
      );
      grounded = true;
      contextCount = rows.length;
    }
  }

  /* ---------- 3) Panggil LLM ---------- */
  try {
    const reply = await chatComplete(systemPrompt, history, TIMEOUT_MS);

    if (!reply) {
      return NextResponse.json(
        {
          error:
            "Model mengembalikan jawaban kosong. Silakan coba lagi atau ubah rumusan pertanyaan Anda.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      reply,
      ...(grounded ? { grounded: true, contextCount } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/chat] error:", msg);

    if (msg === "TIMEOUT") {
      return NextResponse.json(
        {
          error:
            "Waktu tunggu jawaban habis (model terlalu lama merespons). Silakan coba lagi.",
        },
        { status: 504 },
      );
    }

    // Klasifikasi untuk PEMILIK SITUS via log server (pesan pengguna tetap
    // generik — tidak membocorkan detail konfigurasi).
    if (msg.startsWith("GEMINI_AUTH") || msg.startsWith("GEMINI_MODEL")) {
      console.error(
        "[api/chat] PETUNJUK PEMILIK SITUS: " +
          msg +
          " | Cek juga Vercel Dashboard → Project → Settings → Environment " +
          "Variables (environment Production) lalu deploy ulang.",
      );
      return NextResponse.json(
        {
          error:
            "Layanan chatbot sedang tidak dapat dihubungi. Silakan coba lagi nanti.",
        },
        { status: 502 },
      );
    }
    if (msg === "CHAT_PROVIDER_UNAVAILABLE") {
      console.error(
        "[api/chat] PETUNJUK PEMILIK SITUS: tidak ada penyedia LLM aktif. " +
          "Set GEMINI_API_KEY (gratis: aistudio.google.com/apikey) pada " +
          "Environment Variables Production di Vercel, lalu deploy ulang.",
      );
      return NextResponse.json(
        {
          error:
            "Layanan chatbot sedang tidak dapat dihubungi. Silakan coba lagi nanti.",
        },
        { status: 503 },
      );
    }

    const lower = msg.toLowerCase();
    if (lower.includes("rate") || lower.includes("limit") || lower.includes("quota")) {
      return NextResponse.json(
        {
          error:
            "Layanan chatbot sedang sibuk atau mencapai batas penggunaan. Coba lagi beberapa saat lagi.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Terjadi kendala saat menghubungi model bahasa. Silakan coba lagi. Jika berulang, muat ulang halaman.",
      },
      { status: 502 },
    );
  }
}
