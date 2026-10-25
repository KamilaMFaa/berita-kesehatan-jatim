/**
 * region-match.ts — Pencocokan nama wilayah Jawa Timur untuk pertanyaan chatbot
 * (deteksi daerah pada pertanyaan berita terkini, mis. "berita terkini di Bangkalan").
 *
 * Cara kerja: pencocokan kata utuh (word boundary) terhadap nama kabupaten/kota
 * di dataset — BUKAN retrieval embedding/vektor, hanya pencocokan string.
 *
 * Catatan ambiguitas yang disengaja (dilaporkan di dokumentasi):
 * - "batu" tanpa prefiks TIDAK dipetakan (bisa berarti Kota Batu atau "batu bara"),
 *   harus ditulis "kota batu".
 * - Nama tanpa prefiks yang dipakai baik Kabupaten maupun Kota (mis. "malang")
 *   dipetakan ke KEDUA wilayah — query berita memakai daftar kandidat (IN).
 */

export interface RegionMatch {
  /** Nama wilayah lengkap persis seperti kolom region dataset */
  regions: string[];
  /** Teks wilayah yang terdeteksi pada pertanyaan (untuk ditampilkan) */
  matched: string;
}

const RAW_NAMES = [
  "Kabupaten Bangkalan",
  "Kabupaten Banyuwangi",
  "Kabupaten Blitar",
  "Kabupaten Bojonegoro",
  "Kabupaten Bondowoso",
  "Kabupaten Gresik",
  "Kabupaten Jember",
  "Kabupaten Jombang",
  "Kabupaten Kediri",
  "Kabupaten Lamongan",
  "Kabupaten Lumajang",
  "Kabupaten Madiun",
  "Kabupaten Magetan",
  "Kabupaten Malang",
  "Kabupaten Mojokerto",
  "Kabupaten Nganjuk",
  "Kabupaten Ngawi",
  "Kabupaten Pacitan",
  "Kabupaten Pamekasan",
  "Kabupaten Pasuruan",
  "Kabupaten Ponorogo",
  "Kabupaten Probolinggo",
  "Kabupaten Sampang",
  "Kabupaten Sidoarjo",
  "Kabupaten Situbondo",
  "Kabupaten Sumenep",
  "Kabupaten Trenggalek",
  "Kabupaten Tuban",
  "Kabupaten Tulungagung",
  "Kota Batu",
  "Kota Blitar",
  "Kota Kediri",
  "Kota Madiun",
  "Kota Malang",
  "Kota Mojokerto",
  "Kota Pasuruan",
  "Kota Probolinggo",
  "Kota Surabaya",
];

/** Nama pendek yang TIDAK boleh dipakai tanpa prefiks karena ambigu */
const AMBIGUOUS_SHORT = new Set(["batu"]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Deteksi wilayah pada teks pertanyaan.
 * Prioritas: nama lengkap ("kabupaten bangkalan") > nama pendek ("bangkalan").
 * Mengembalikan daftar kandidat wilayah dataset (bisa >1 untuk nama ambigu).
 */
export function detectRegion(text: string): RegionMatch | null {
  const t = text.toLowerCase();

  // 1) Coba nama lengkap dulu (paling spesifik)
  for (const name of RAW_NAMES) {
    const re = new RegExp(`\\b${escapeRegex(name.toLowerCase())}\\b`);
    if (re.test(t)) {
      return { regions: [name], matched: name };
    }
  }

  // 2) Nama pendek tanpa prefiks: kumpulkan kandidat Kabupaten + Kota
  for (const name of RAW_NAMES) {
    const short = name.replace(/^(Kabupaten|Kota)\s+/, "").toLowerCase();
    if (AMBIGUOUS_SHORT.has(short)) continue;
    const re = new RegExp(`\\b${escapeRegex(short)}\\b`);
    if (re.test(t)) {
      const candidates = RAW_NAMES.filter(
        (n) => n.replace(/^(Kabupaten|Kota)\s+/, "").toLowerCase() === short,
      );
      return { regions: candidates, matched: name.replace(/^(Kabupaten|Kota)\s+/, "") };
    }
  }

  return null;
}

/** Nama wilayah untuk ditampilkan pada pesan pengguna (mis. "Bangkalan") */
export function regionDisplayList(names: string[]): string {
  return names.map((n) => n.replace(/^(Kabupaten|Kota)\s+/, "")).join(" dan ");
}
