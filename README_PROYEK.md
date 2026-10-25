# Website Berita Kesehatan Jawa Timur — SBERT · BERTopic · LLM

Website eksplorasi hasil penelitian **"Identifikasi dan Analisis Tren Isu Kesehatan Masyarakat
Jawa Timur"**: 25.022 berita hasil scraping yang telah diproses dengan SBERT dan BERTopic
(mode penuh), disajikan dalam empat menu utama — **Beranda, Filter Topik dan Persebaran,
Chatbot, Tentang Proyek**.

> Website ini HANYA membaca hasil preprocessing & topic modeling yang sudah selesai.
> Tidak ada proses SBERT/embedding/UMAP/HDBSCAN/BERTopic yang dijalankan oleh aplikasi.
> Chatbot menggunakan LLM **tanpa RAG** dan **tanpa pencarian internet** (sesuai desain
> penelitian).

---

## 1. Struktur Proyek

```
├── prisma/schema.prisma        # Skema DB (tabel Article: 25.022 baris hasil BERTopic)
├── db/custom.db                # Database SQLite (hasil seed — siap pakai)
├── data/                       # Data siap web (DIHASILKAN dari CSV penelitian)
│   ├── articles.json           #   25.022 artikel (untuk seed DB)
│   ├── topics.json             #   87 topik + label manual terbaru + dokumen representatif
│   └── aggregates.json         #   Agregat (tren, wilayah, evaluasi, dsb.)
├── scripts/
│   ├── prepare_data.py         # CSV hasil pemodelan  -> data/*.json (gabung label manual via topic_id)
│   ├── seed.mjs                # data/articles.json   -> SQLite
│   └── audit_label_alignment.py# Audit keselarasan label manual vs run model
├── src/
│   ├── app/page.tsx            # Halaman utama (shell 4 menu)
│   ├── app/api/articles/route.ts   # API filter/pencarian/paginasi berita
│   ├── app/api/articles/aggregate/route.ts # API agregat untuk peta & kartu jumlah (ikut filter)
│   ├── app/api/chat/route.ts       # API chatbot LLM (Gemini/z-ai, gerbang topik pra-LLM)
│   ├── lib/llm.ts                  # Penyedia LLM (Gemini REST / z-ai SDK, perilaku identik)
│   ├── lib/db.ts                   # Prisma client (SQLite lokal / Turso-libSQL otomatis)
│   ├── components/site-shell.tsx   # Navigasi 4 menu + footer
│   ├── components/article-list.tsx # Daftar berita (filter, paginasi, error state)
│   ├── components/region-map.tsx   # Peta persebaran (Leaflet, bubble per kab/kota)
│   ├── components/views/eksplorasi-view.tsx # Menu "Filter Topik dan Persebaran" (filter + peta 1 halaman)
│   ├── lib/geo.ts                  # Koordinat pusat administratif 38 kab/kota
│   ├── lib/region-match.ts         # Deteksi wilayah dari teks pertanyaan chatbot
│   ├── lib/app-data.ts             # Loader JSON (server-only)
│   └── lib/app-types.ts            # Tipe & konstanta bersama
└── project_audit/data/results/penuh/ # (Sumber) CSV hasil pemodelan peneliti — tidak diubah
```

Sumber data tunggal: file hasil pemodelan peneliti (`project_audit/data/results/penuh/*.csv`
dan `bertopic_model/`). Seluruh angka pada website dihitung dari file tersebut; tidak ada
angka fiktif.

## 2. Cara Menjalankan

**Prasyarat**: Node.js/Bun, Python 3.10+ (hanya bila perlu memproses ulang data).

```bash
# 1) Instal dependensi
bun install          # atau: npm install

# 2) Siapkan database (skema + seed 25.022 artikel)
bun run db:push      # buat/selaraskan SQLite (db/custom.db)
bun scripts/seed.mjs # isi tabel Article dari data/articles.json

# 3) Jalankan aplikasi (mode pengembangan)
bun run dev          # buka http://localhost:3000
```

Bila mengganti data hasil pemodelan (CSV baru), jalankan ulang:
`python3 scripts/prepare_data.py` lalu `bun scripts/seed.mjs`.

## 3. Konfigurasi LLM (Chatbot)

- Chatbot diimplementasikan di **backend** (`src/app/api/chat/route.ts`) menggunakan
  `z-ai-web-dev-sdk`. Kredensial/authorization dikelola oleh SDK lewat environment —
  **tidak ada kunci API yang ditulis di kode frontend** maupun di repositori.
- Bila lingkungan penyebaran Anda memerlukan API key eksplisit, simpan sebagai environment
  variable, contoh di file `.env`:

```env
DATABASE_URL=file:../db/custom.db
# (opsional, sesuai kebutuhan penyedia LLM Anda)
# LLM_API_KEY=xxxx
```

> Path SQLite bersifat relatif terhadap lokasi `prisma/schema.prisma`. File `.env` bawaan
> proyek ini sudah memakai nilai di atas — tidak perlu diubah bila struktur folder dipertahankan.

- Perilaku yang sudah ditangani di backend: timeout (55 detik), respons kosong,
  batas pemakaian (rate limit sederhana per-IP: 20 permintaan/5 menit), dan pesan error
  berbahasa Indonesia yang dapat dipahami pengguna.
- Pembatasan topik diterapkan **SEBELUM LLM dipanggil**: gerbang validasi kata kunci
  deterministik menolak pertanyaan di luar cakupan (mis. "Apa perbedaan Python dan Java?")
  dengan pesan penolakan sopan + arahan kembali ke topik kesehatan/berita — pertanyaan
  tersebut tidak pernah dikirim ke model. System prompt hanya lapisan kedua (defense in depth).
- Pertanyaan berita terkini (mis. "Apa berita kesehatan terkini di Bangkalan?") dijawab dari
  dataset aplikasi melalui **query terstruktur** (filter wilayah/kata kunci + urut tanggal
  publikasi, maks. 8 berita terbaru). Ini BUKAN RAG: tanpa embedding, tanpa vector database,
  tanpa retrieval semantik, tanpa akses internet/Web Search API. Jawaban wajib menyebut
  tanggal berita dan menyatakan bahwa sumbernya adalah dataset proyek (bukan berita real-time).
- Batasan metodologis chatbot:
  - Dilarang mengarang judul/tanggal/lokasi/tautan/statistik berita.
  - Tidak melakukan RAG/retrieval semantik dan tidak melakukan pencarian internet.
  - Tidak memberi diagnosis/pengobatan individual; menyarankan konsultasi tenaga kesehatan.
  - Gerbang kata kunci dapat menolak pertanyaan dalam-cakupan yang tidak memuat istilah
    yang dikenali (false reject); keterbatasan ini diakui di kode dan UI.

## 4. Deploy ke Vercel + Turso (gratis)

Vercel tidak punya filesystem persisten, jadi database SQLite lokal diganti **Turso**
(SQLite di cloud, protokol libSQL). Kode sudah siap: bila `TURSO_DATABASE_URL` terpasang,
Prisma otomatis memakai adapter libSQL (`src/lib/db.ts`); tanpa variabel itu, aplikasi
memakai SQLite lokal seperti biasa — tidak ada perubahan perilaku.

### 4.1 Siapkan database Turso (± 10 menit)

1. Daftar di [turso.dev](https://turso.dev) (bisa login pakai GitHub).
2. Install CLI (Linux/macOS/WSL):
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
3. Buat database + token:
   ```bash
   turso auth login
   turso db create berita-jatim
   turso db tokens create berita-jatim
   turso db show berita-jatim --url   # contoh: libsql://berita-jatim-<nama>.turso.io
   ```
4. **Impor data** (dump 25.022 berita sudah disertakan di `db/turso_dump.sql`):
   ```bash
   turso db shell berita-jatim < db/turso_dump.sql
   ```
5. Simpan dua nilai berikut untuk Vercel: **URL** dan **token** dari langkah 3.

### 4.2 Deploy ke Vercel (± 10 menit)

1. **Push proyek ke GitHub**:
   ```bash
   git init && git add . && git commit -m "website berita kesehatan jatim"
   git branch -M main
   git remote add origin https://github.com/<USERNAME>/berita-kesehatan-jatim.git
   git push -u origin main
   ```
   (`.env` otomatis tidak ikut karena `.gitignore`; data & dump ikut karena dibutuhkan.)
2. Buka [vercel.com](https://vercel.com) → daftar dengan GitHub → **Add New → Project**
   → pilih repo → Framework otomatis terdeteksi **Next.js** → jangan deploy dulu.
3. Buka **Environment Variables**, tambahkan:
   | Nama | Nilai |
   |------|-------|
   | `TURSO_DATABASE_URL` | `libsql://berita-jatim-<nama>.turso.io` (langkah 4.1.3) |
   | `TURSO_AUTH_TOKEN` | token dari langkah 4.1.3 |
   | `GEMINI_API_KEY` | API key gratis dari [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — untuk chatbot |
4. Klik **Deploy** → tunggu build ± 2–3 menit → buka URL `xxx.vercel.app`.

### 4.3 Catatan penting di Vercel

- **Chatbot** memakai Gemini via `GEMINI_API_KEY` (model bawaan `gemini-3.5-flash-lite`,
  dapat diganti lewat `GEMINI_MODEL`, mis. `gemini-3.8-flash`). Semua batasan topik/etika
  tetap berlaku; tanpa key ini, menu chatbot akan menampilkan pesan error yang ramah — fitur
  lain tetap berfungsi normal.
- **Troubleshooting chatbot**: bila chatbot error, periksa **Vercel Dashboard → Logs**
  (fungsi `/api/chat`). Log menampilkan penyebab pasti:
  - `GEMINI_AUTH` → API key ditolak Google: cek `GEMINI_API_KEY` terpasang pada environment
    **Production** (bukan hanya Preview), lalu **deploy ulang** (perubahan env tidak berlaku
    tanpa redeploy).
  - `GEMINI_MODEL` → nama model tidak tersedia: Google memensiunkan model lama
    (`gemini-2.0-flash` mati 1 Juni 2026; `gemini-2.5-flash` dibatasi akses). Set
    `GEMINI_MODEL` ke model aktif atau hapus env agar memakai bawaan.
  - Jawaban berita gagal dengan kode `DB_*` → query dataset gagal sebelum LLM; ikuti
    tabel 4.4 (paling sering: env Turso belum terpasang pada deployment tersebut).
- **Beranda pertama kali** dapat terasa lambat beberapa detik (cold start serverless);
  akses berikutnya cepat.
- Paket gratis Turso (5 GB, 1 miliar row-read/bulan) dan Vercel (Hobby) lebih dari cukup
  untuk skala proyek ini.
- Untuk memperbarui data: jalankan `python3 scripts/prepare_data.py` + `bun scripts/seed.mjs`
  secara lokal, lalu `python3 scripts/make_turso_dump.py` dan impor ulang ke Turso.

### 4.4 Troubleshooting halaman Filter (database)

Bila halaman "Filter Topik dan Persebaran" gagal memuat data, API kini mengembalikan kode
penyebab yang tampil langsung di UI — petakan tindakannya:

| Kode | Penyebab | Tindakan pemilik situs |
|------|----------|------------------------|
| `DB_NOT_CONFIGURED` | `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` tidak terpasang (atau hanya di Preview) | Set keduanya pada environment **Production** di Vercel → **deploy ulang** |
| `DB_AUTH` | Token/URL tidak cocok atau token salah | Buat ulang token (`turso db tokens create`) dan cocokkan URL database |
| `DB_EMPTY` | Tabel tidak ditemukan — hampir selalu karena `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` tidak terpasang sehingga aplikasi jatuh ke berkas SQLite lokal kosong (bukan data yang hilang) | Set keduanya pada Environment Variables **Production** → deploy ulang; bila env sudah benar baru impor: `turso db shell <nama-db> < db/turso_dump.sql`, cek `SELECT COUNT(*) FROM Article` = 25022 |
| `DB_VERSION_MISMATCH` | Versi `@prisma/client`, `prisma`, dan `@prisma/adapter-libsql` tidak sama (protokol serialisasi query tidak cocok; muncul sebagai P2010 "invalid type: unit value, expected i32" di log) | Samakan ketiganya (saat ini **6.19.2**), pastikan `bun.lock` ikut ter-commit di repo, lalu **deploy ulang** |
| `DB_FILE` | Aplikasi jatuh ke SQLite lokal di serverless | Pastikan `TURSO_DATABASE_URL` terpasang (env var, bukan hanya file `.env`) |
| `DB_NETWORK` | Gangguan jaringan ke Turso | Coba lagi; cek status Turso |

> **Catatan env var:** menambah/mengubah Environment Variables di Vercel TIDAK berlaku
> pada deployment yang sudah berjalan — selalu **deploy ulang** setelahnya, dan pastikan
> variabel dipasang untuk environment **Production** (centang kotak Production saat
> menyimpan; Deployment Preview memakai env tersendiri).

> **PENTING — versi Prisma:** tiga paket ini WAJIB selalu versi sama dan ter-pin exact
> (tanpa `^`): `prisma`, `@prisma/client`, `@prisma/adapter-libsql` — saat ini **6.19.2**.
> Range `^` membuat Vercel memasang versi terbaru untuk salah satu paket saja dan
> protokol adapter tidak cocok → semua query gagal di Turso (tidak terlihat di SQLite
> lokal). Jangan menaikkan salah satunya secara terpisah; jika perlu upgrade, naikkan
> ketiganya bersamaan lalu uji dengan `bun scripts/repro_adapter.ts`.

Detail error lengkap selalu tercatat di **Vercel Dashboard → Logs** per fungsi
(`/api/articles`, `/api/articles/aggregate`) — tanpa kredensial.

## 5. Keputusan Teknis Penting (Audit Data)

1. **Label topik** yang ditampilkan berasal dari **label manual terbaru**
   `project_audit/data/results/penuh/label_topik_manual_gabungan.csv` (kolom
   `topic_label_baru`), digabung ke data topik berdasarkan **kunci `topic_id`** (bukan
   urutan baris). ID topik asli BERTopic dipertahankan untuk penggabungan data; label
   manual hanya berfungsi sebagai nama topik di semua tampilan (Beranda, filter, grafik,
   tabel, daftar berita, peta). Topik tanpa label manual memakai fallback
   `topic_label` (kata kunci model) dengan peringatan eksplisit — tidak ada label yang
   dikarang. Baris berstatus revisi "Perlu verifikasi" TIDAK dipakai sampai peneliti
   mengonfirmasi. Audit keselarasan label-vs-dokumen tersedia di
   `scripts/audit_label_alignment.py`.

   > Catatan riwayat: pada audit awal, label gabungan lama terverifikasi tidak selaras
   > dengan run model terakhir (contoh: topik 1 "kekeringan/air bersih" berlabel
   > "Pengelolaan sampah di TPS 3R"). Setelah file label terbaru disediakan peneliti,
   > seluruh tampilan bermigrasi ke label gabungan terbaru tersebut dengan verifikasi
   > keselarasan via kutipan dokumen representatif.
2. **Peta persebaran** memakai `region_analisis` (policy kandidat pertama, hasil peneliti)
   dan koordinat **pusat administratif** 38 kabupaten/kota (referensi geografis publik,
   `src/lib/geo.ts`). Titik peta bukan lokasi kejadian berita. Beberapa marker kota digeser
   sedikit agar tidak tumpang tindih dengan kabupaten induknya.
3. **Keterbatasan wilayah**: 4.584 berita berstatus wilayah "tidak pasti"
   (`region_tidak_pasti`) dan dapat dikecualikan via filter. Pemetaan otomatis juga dapat
   salah memetakan berita luar Jawa Timur (terverifikasi: berita "Batu Bara"/"Labuhanbatu"
   dari Sumatera Utara terpetakan ke Kota Batu). Dataset ditampilkan apa adanya; batasan
   ini dijelaskan di UI.
4. **Outlier** (topik -1; 9.334 dokumen, 37,3%) ditampilkan secara eksplisit, tidak
   disembunyikan dan tidak dianggap topik substantif.
5. Aplikasi lama (`app.py` Streamlit Bangkalan) tidak dapat dijalankan karena file
   `data/processed/` tidak disertakan, cakupannya Bangkalan (bukan Jatim), dan strukturnya
   5 menu tanpa chatbot/peta. Namun pola etika datanya (disclaimer label, perlakuan outlier)
   diwariskan ke website ini.

## 6. Keterbatasan Sistem (Ringkas)

- Label topik bukan ground truth; perlu verifikasi peneliti untuk publikasi.
- Korpus pemodelan = judul + snippet (full_text tidak tersedia).
- 37,3% dokumen outlier; silhouette cosine rendah (0,092) → topik dapat tumpang tindih.
- Angka persebaran deskriptif atas berita yang dianalisis — bukan indikator kesehatan
  masyarakat wilayah; terdapat risiko salah peta wilayah (lihat di atas).
- Chatbot: tanpa akses dataset/internet, pengetahuan bisa tidak mutakhir, bisa keliru;
  bukan pengganti tenaga kesehatan.
- URL berita adalah tautan redirect Google News RSS (apa adanya dari dataset).

## 7. Halaman & Fitur

| Menu | Fitur |
|------|-------|
| **Beranda** | Statistik dataset aktual (25.022 artikel, 87 topik, 38 kab/kota, 1.538 penerbit, periode 2016–2026), tren bulanan, komposisi kelompok isu, 10 topik terbesar, cuplikan berita, catatan interpretasi |
| **Filter Topik & Persebaran** | Daftar 87 topik + pencarian, detail topik (kata kunci, jumlah, contoh representatif), daftar berita per topik dengan filter wilayah/tahun/kelompok isu/kata kunci/paginasi; peta bubble persebaran, 15 wilayah teratas, rincian wilayah (3 topik teratas + daftar berita) |
| **Chatbot** | LLM (z-ai-web-dev-sdk) tanpa RAG/tanpa web search; riwayat sesi, indikator proses, penanganan error + coba lagi, batasan ditampilkan jelas |
| **Tentang Proyek** | Latar belakang, tujuan, dataset, SBERT, BERTopic, metrik evaluasi aktual (evaluasi_model.csv), keterbatasan |
