"use client";

import { useMemo } from "react";
import {
  Database,
  Brain,
  Layers,
  Compass,
  MessageCircleHeart,
  TriangleAlert,
  FlaskConical,
  Target,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AggregateData, TopicItem } from "@/lib/app-types";
import type { ViewKey } from "@/components/site-shell";
import { fmtNum, fmtTanggal } from "@/lib/format";

export function TentangView({
  aggregates: agg,
  topics,
  goTo,
}: {
  aggregates: AggregateData;
  topics: TopicItem[];
  goTo: (v: ViewKey) => void;
}) {
  const evalRows = useMemo(
    () =>
      Object.entries(agg.evaluation).map(([k, v]) => ({
        metrik: k,
        nilai: v.nilai ?? "-",
        catatan: v.catatan,
      })),
    [agg.evaluation],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-bold">Tentang Proyek</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Penjelasan latar belakang, data, metode, dan keterbatasan sistem. Seluruh angka pada
          halaman ini diambil dari file hasil pemodelan penelitian (mode penuh) tanpa
          perubahan.
        </p>
      </header>

      {/* ================= LATAR BELAKANG & TUJUAN ================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" aria-hidden="true" />
            Latar Belakang & Tujuan
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>
            Isu kesehatan masyarakat di Jawa Timur banyak terkait kondisi lingkungan: pengelolaan
            sampah, sanitasi, drainase dan banjir, ketersediaan air bersih, serta pencemaran.
            Berita daring menjadi sumber data yang kaya untuk memetakan isu-isu tersebut, tetapi
            jumlahnya besar sehingga sulit dibaca satu per satu. Penelitian ini mengolah{" "}
            {fmtNum(agg.totalArticles)} berita hasil scraping media daring Jawa Timur menggunakan
            pendekatan pemodelan topik otomatis, agar pola isu dapat diidentifikasi dan
            dijelajahi.
          </p>
          <p>
            Tujuan website ini adalah menjadi <b className="text-foreground">media eksplorasi
            hasil penelitian</b>: pengguna dapat menelusuri topik yang ditemukan model, melihat
            persebaran berita antar kabupaten/kota, memeriksa artikel aslinya melalui tautan, dan
            memanfaatkan chatbot LLM untuk memahami istilah kesehatan masyarakat. Website ini
            bukan aplikasi edukasi kesehatan, bukan aplikasi layanan posyandu, dan bukan alat
            diagnosis.
          </p>
        </CardContent>
      </Card>

      {/* ================= DATASET ================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" aria-hidden="true" />
            Dataset Berita
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
            <p>
              Dataset yang dipakai website adalah hasil pemodelan <b>mode penuh</b>:
              {fmtNum(agg.totalArticles)} artikel berita hasil scraping Google News RSS dari{" "}
              {fmtNum(agg.nPublishers)} media/penerbit, dengan tanggal publikasi{" "}
              {fmtTanggal(agg.dateMin)} hingga {fmtTanggal(agg.dateMax)}. Sebelum dimodelkan,
              dokumen melewati validasi teks, validasi tanggal, dan deduplikasi teks persis
              (dari 25.098 baris bersih menjadi 25.022 dokumen final menurut log pemodelan).
            </p>
            <p>
              Karena berkas teks lengkap (full_text) tidak tersedia, korpus pemodelan dibangun
              dari <b>judul + sisa snippet</b> berita. Atribut wilayah (kabupaten/kota) diperoleh
              dari pemetaan nama wilayah pada teks berita dengan policy &ldquo;kandidat
              pertama&rdquo;; {fmtNum(agg.regionUncertainCount)} dokumen di antaranya ditandai
              wilayahnya &ldquo;tidak pasti&rdquo; dan dapat dikecualikan lewat filter.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {agg.issueGroups.map((g) => (
              <div
                key={g.key}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{g.label}</span>
                <Badge variant="secondary" className="tabular-nums">
                  {fmtNum(g.count)}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Kelompok isu di atas berasal dari kolom <code>issue_group</code> dataset (kategori
            kueri scraping) — bukan hasil klasifikasi baru yang dibuat untuk website ini.
          </p>
        </CardContent>
      </Card>

      {/* ================= METODE ================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" aria-hidden="true" />
            Metode: SBERT dan BERTopic
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>
            <b className="text-foreground">SBERT (Sentence-BERT).</b> Setiap dokumen diubah
            menjadi vektor embedding semantik 384 dimensi menggunakan model{" "}
            <code>paraphrase-multilingual-MiniLM-L12-v2</code>. Embedding ini menangkap makna
            teks sehingga dokumen dengan topik serupa berada berdekatan meskipun kata
            persisnya berbeda.
          </p>
          <p>
            <b className="text-foreground">BERTopic.</b> Embedding direduksi dimensinya dengan
            UMAP (n_neighbors=15, n_components=5, min_dist=0, metric=cosine) lalu dikelompokkan
            dengan HDBSCAN (min_cluster_size=38, seed=42). Representasi kata tiap topik dibentuk
            dengan c-TF-IDF. Hasilnya {fmtNum(agg.nTopics)} topik reguler; dokumen yang tidak
            masuk klaster mana pun diberi label topik -1 (outlier) sebanyak{" "}
            {fmtNum(agg.outlierCount)} dokumen ({agg.outlierPct}%).
          </p>
          <p>
            <b className="text-foreground">Label topik</b> yang ditampilkan di website diambil
            dari kata kunci karakteristik tiap topik pada file{" "}
            <code>ringkasan_topik.csv</code> — sehingga selaras dengan model terakhir. Catatan
            penting: label deskriptif manual pada file hasil lainnya (
            <code>topic_label_final</code>) tidak selaras dengan run pemodelan terakhir
            (terverifikasi lewat dokumen representatif), sehingga <b>tidak digunakan</b> di
            website ini untuk menghindari mislabel.
          </p>
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Metrik evaluasi model (dari evaluasi_model.csv)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <tbody>
                  {evalRows.map((r) => (
                    <tr key={r.metrik} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-medium text-foreground whitespace-nowrap align-top">
                        {r.metrik}
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap align-top">
                        {r.nilai}
                      </td>
                      <td className="py-1.5 text-muted-foreground align-top">{r.catatan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================= FITUR WEBSITE ================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fitur Website</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FeatureRow
            icon={<Compass className="h-4 w-4 text-primary" aria-hidden="true" />}
            title="Filter Topik dan Persebaran"
            desc="Daftar 87 topik dengan kata kunci, jumlah dokumen, dan contoh judul representatif. Setiap topik dapat dibuka untuk melihat beritanya dengan filter wilayah, tahun, dan pencarian kata kunci. Peta persebaran menampilkan jumlah berita per kabupaten/kota beserta tiga topik teratas per wilayah."
            action={() => goTo("eksplorasi")}
            actionLabel="Buka halaman"
          />
          <Separator />
          <FeatureRow
            icon={<MessageCircleHeart className="h-4 w-4 text-primary" aria-hidden="true" />}
            title="Chatbot berbasis LLM (tanpa RAG)"
            desc="Chatbot menggunakan Large Language Model untuk menjelaskan konsep kesehatan masyarakat dan lingkungan dalam bahasa Indonesia. Sesuai desain penelitian, chatbot TIDAK menggunakan RAG/vector database maupun pencarian internet: jawaban dihasilkan murni dari pengetahuan model dengan konteks proyek yang statis."
            action={() => goTo("chatbot")}
            actionLabel="Buka halaman"
          />
        </CardContent>
      </Card>

      {/* ================= BATASAN ================= */}
      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-700" aria-hidden="true" />
            Keterbatasan Sistem
          </CardTitle>
          <CardDescription>
            Perhatikan batasan berikut sebelum menafsirkan hasil di website ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground leading-relaxed space-y-2.5 list-disc pl-5">
            <li>
              <b className="text-foreground">Label topik bukan ground truth.</b> Label berasal
              dari kata kunci model dan perlu diverifikasi peneliti untuk keperluan publikasi.
            </li>
            <li>
              <b className="text-foreground">Outlier tinggi ({agg.outlierPct}%).</b> Sebagian
              besar dokumen tidak masuk topik reguler; interpretasi hanya berlaku pada dokumen
              dalam topik.
            </li>
            <li>
              <b className="text-foreground">Korpus pendek.</b> Pemodelan memakai judul + snippet
              (bukan isi artikel penuh), sehingga topik merefleksikan tema pemberitaan, bukan isi
              lengkap artikel.
            </li>
            <li>
              <b className="text-foreground">Klaster tumpang tindih.</b> Silhouette cosine rendah
              (0,092) — wajar untuk teks pendek; topik dapat saling berkaitan.
            </li>
            <li>
              <b className="text-foreground">Wilayah bukan lokasi akurat.</b> Persebaran
              dihitung dari nama kabupaten/kota yang muncul di teks berita; {fmtNum(agg.regionUncertainCount)} berita
              berstatus wilayah tidak pasti. Titik peta memakai pusat administratif wilayah
              (referensi publik), bukan lokasi kejadian.
            </li>
            <li>
              <b className="text-foreground">Risiko salah peta wilayah.</b> Pemetaan otomatis
              berbasis nama wilayah dapat memetakan berita di luar Jawa Timur ke wilayah Jatim
              (contoh terverifikasi: berita &ldquo;Batu Bara&rdquo; dan &ldquo;Labuhanbatu&rdquo;
              di Sumatera Utara terpetakan ke Kota Batu karena kemiripan nama). Dataset
              ditampilkan apa adanya; gunakan filter wilayah dengan cermat.
            </li>
            <li>
              <b className="text-foreground">Angka persebaran deskriptif.</b> Jumlah berita per
              wilayah menggambarkan intensitas pemberitaan yang dianalisis — bukan indikator
              tingkat kesehatan masyarakat wilayah.
            </li>
            <li>
              <b className="text-foreground">Chatbot tanpa akses dataset & internet.</b> Chatbot
              tidak dapat mengambil berita tertentu, tidak mengetahui kejadian terbaru, dan bisa
              keliru; penjelasan kesehatan bersifat umum dan bukan pengganti tenaga kesehatan.
            </li>
            <li>
              <b className="text-foreground">Bukan alat diagnosis.</b> Seluruh konten website
              bersifat eksplorasi data berita dan penjelasan konsep umum.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* ================= CTA ================= */}
      <Card className="bg-secondary/60">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-semibold">Siap menjelajahi hasil penelitian?</p>
            <p className="text-muted-foreground mt-0.5">
              Mulai dari daftar topik atau peta persebaran wilayah.
            </p>
          </div>
          <Button onClick={() => goTo("eksplorasi")} className="gap-2 cursor-pointer">
            Buka Eksplorasi
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  desc,
  action,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action: () => void;
  actionLabel: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
      </div>
      <Button variant="outline" size="sm" className="h-8 shrink-0 cursor-pointer" onClick={action}>
        {actionLabel}
      </Button>
    </div>
  );
}
