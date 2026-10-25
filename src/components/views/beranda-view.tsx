"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Newspaper,
  Layers,
  MapPin,
  Building2,
  CalendarRange,
  ArrowRight,
  MessageCircleHeart,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { AggregateData, TopicItem } from "@/lib/app-types";
import type { ViewKey } from "@/components/site-shell";
import { fmtNum, fmtTanggal, fmtBulan } from "@/lib/format";

const PALETTE = ["#0f766e", "#059669", "#d97706", "#c2410c", "#4d7c0f", "#7c2d12", "#3f6212"];

interface LatestItem {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  region: string;
}

export function BerandaView({
  aggregates: agg,
  topics,
  goTo,
}: {
  aggregates: AggregateData;
  topics: TopicItem[];
  goTo: (v: ViewKey) => void;
}) {
  const [latest, setLatest] = useState<LatestItem[] | null>(null);
  const [latestError, setLatestError] = useState<string | null>(null);

  // Cuplikan berita dari dataset aktual (diurutkan tanggal terbaru yang TERSIMA di dataset)
  useEffect(() => {
    let alive = true;
    fetch("/api/articles?sort=tanggal_desc&pageSize=6")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("gagal"))))
      .then((j) => {
        if (alive) setLatest(j.items ?? []);
      })
      .catch(() => {
        if (alive) setLatestError("Cuplikan berita tidak dapat dimuat saat ini.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const monthlyChart = useMemo(
    () => agg.monthlyTotal.map((m) => ({ periode: m.periode, label: fmtBulan(m.periode), jumlah: m.jumlah })),
    [agg.monthlyTotal],
  );

  const issueChart = useMemo(
    () => agg.issueGroups.map((g) => ({ name: g.label, value: g.count })),
    [agg.issueGroups],
  );

  const topTopicsChart = useMemo(
    () =>
      agg.topTopics.slice(0, 10).map((t) => ({
        name: t.label.length > 34 ? t.label.slice(0, 34) + "…" : t.label,
        full: t.label,
        jumlah: t.count,
      })),
    [agg.topTopics],
  );

  const tickYears = useMemo(
    () =>
      monthlyChart
        .filter((_, i) => {
          const month = parseInt(monthlyChart[i].periode.slice(5, 7), 10);
          return month === 1;
        })
        .map((d) => d.label),
    [monthlyChart],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 space-y-10">
      {/* ================= HERO ================= */}
      <section className="rounded-2xl border bg-gradient-to-br from-secondary via-card to-accent/30 p-6 sm:p-10">
        <Badge variant="secondary" className="mb-4 gap-1.5">
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          Hasil pemodelan SBERT–BERTopic · mode penuh
        </Badge>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight max-w-3xl">
          Menjelajahi Berita Kesehatan Masyarakat & Lingkungan Jawa Timur
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
          Website penelitian ini menyajikan hasil pengolahan{" "}
          <span className="font-medium text-foreground">{fmtNum(agg.totalArticles)} berita</span>{" "}
          media daring Jawa Timur yang dianalisis menggunakan embedding semantik SBERT dan
          pemodelan topik BERTopic. Temukan isu seperti pengelolaan sampah, banjir, air bersih,
          dan pencemaran lingkungan melalui filter topik dan peta persebaran, atau tanyakan
          konsep kesehatan masyarakat pada chatbot.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button onClick={() => goTo("eksplorasi")} className="cursor-pointer gap-2">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Jelajahi Topik & Persebaran
          </Button>
          <Button variant="outline" onClick={() => goTo("chatbot")} className="cursor-pointer gap-2">
            <MessageCircleHeart className="h-4 w-4" aria-hidden="true" />
            Tanya Chatbot
          </Button>
        </div>
      </section>

      {/* ================= STATISTIK RINGKAS ================= */}
      <section aria-label="Statistik ringkas dataset">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {[
            { icon: Newspaper, label: "Artikel Berita", value: fmtNum(agg.totalArticles), sub: "dokumen dianalisis" },
            { icon: Layers, label: "Topik (BERTopic)", value: fmtNum(agg.nTopics), sub: `outlier ${fmtNum(agg.outlierCount)} dok (${agg.outlierPct}%)` },
            { icon: MapPin, label: "Kabupaten/Kota", value: fmtNum(agg.nRegions), sub: "wilayah Jawa Timur" },
            { icon: Building2, label: "Media/Penerbit", value: fmtNum(agg.nPublishers), sub: "sumber berita" },
            {
              icon: CalendarRange,
              label: "Periode Data",
              value: "2016–2026",
              sub: `${fmtTanggal(agg.dateMin)} – ${fmtTanggal(agg.dateMax)}`,
            },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <s.icon className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs font-medium">{s.label}</span>
                </div>
                <p className="mt-2 text-xl sm:text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ================= GRAFIK UTAMA ================= */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4" aria-label="Visualisasi statistik">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Perkembangan Jumlah Berita per Bulan</CardTitle>
            <CardDescription>
              Seluruh {fmtNum(agg.totalArticles)} artikel dalam dataset (termasuk outlier), 2016–2026.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChart} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradBulanan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e6" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => (tickYears.includes(v) ? v.slice(-4) : "")}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(l: string) => l}
                    formatter={(value) => [`${fmtNum(Number(value))} berita`, "Jumlah artikel"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="jumlah"
                    stroke="#0f766e"
                    strokeWidth={2}
                    fill="url(#gradBulanan)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Komposisi Kelompok Isu</CardTitle>
            <CardDescription>Kategori pencarian pada proses scraping dataset.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={issueChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="52%"
                    outerRadius="80%"
                    paddingAngle={2}
                    stroke="#fff"
                  >
                    {issueChart.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${fmtNum(Number(value))} berita`, name]} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconSize={9}
                    formatter={(value: string) => value}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ================= TOPIK TERBESAR ================= */}
      <section aria-label="Topik terbesar">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Topik Terbesar Hasil BERTopic</CardTitle>
            <CardDescription>
              10 topik reguler dengan jumlah dokumen terbanyak. Label diambil dari kata kunci
              karakteristik topik (bukan label ground truth).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTopicsChart} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={190}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(value) => [`${fmtNum(Number(value))} dokumen`, "Jumlah"]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.full ?? ""
                    }
                  />
                  <Bar dataKey="jumlah" fill="#0f766e" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Lihat seluruh 87 topik pada menu{" "}
              <button
                onClick={() => goTo("eksplorasi")}
                className="underline underline-offset-2 hover:text-primary inline-flex items-center gap-0.5 cursor-pointer"
              >
                Filter Topik & Persebaran <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
              .
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ================= CUPLIKAN BERITA ================= */}
      <section aria-label="Cuplikan berita">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold">Cuplikan Berita dalam Dataset</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Diurutkan berdasarkan tanggal publikasi terbaru yang tersedia dalam dataset (bukan
              berita real-time). Sebagian berita dalam dataset dapat berasal dari luar Jawa Timur
              karena mekanisme scraping berbasis kueri — data ditampilkan apa adanya.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 cursor-pointer" onClick={() => goTo("eksplorasi")}>
            Lihat Semua
          </Button>
        </div>

        {latestError && (
          <p className="text-sm text-muted-foreground py-6 text-center">{latestError}</p>
        )}
        {!latest && !latestError && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <div className="h-3.5 w-4/5 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-full bg-muted animate-pulse rounded" />
                  <div className="h-3 w-2/5 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {latest && latest.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Tidak ada berita untuk ditampilkan.
          </p>
        )}
        {latest && latest.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {latest.map((a) => (
              <Card key={a.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4 flex flex-col gap-2 h-full">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sm leading-snug hover:text-primary hover:underline underline-offset-2"
                  >
                    {a.title}
                  </a>
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{a.publisher || "(penerbit tidak tercatat)"}</span>
                    <span>{fmtTanggal(a.publishedAt)}</span>
                    {a.region && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{a.region}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ================= CATATAN / DISCLAIMER ================= */}
      <section aria-label="Catatan penting">
        <Card className="border-amber-200 bg-accent/40">
          <CardContent className="p-4 sm:p-5 flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs sm:text-sm text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground">Catatan Interpretasi</p>
              <p>
                Topik ditampilkan merupakan hasil klasterisasi teks (SBERT–BERTopic). Label topik
                diambil dari kata kunci karakteristik model dan <b>bukan</b> label ground truth.
                Topik -1 (outlier) berisi {fmtNum(agg.outlierCount)} dokumen ({agg.outlierPct}%)
                yang tidak masuk topik reguler mana pun.
              </p>
              <p>
                Angka persebaran wilayah menggambarkan jumlah berita yang dianalisis per
                kabupaten/kota — <b>bukan</b> indikator tingkat kesehatan masyarakat wilayah
                tersebut. Pemetaan wilayah otomatis juga dapat salah memetakan sebagian berita
                luar Jawa Timur (mis. nama &ldquo;Batu Bara&rdquo;/&ldquo;Labuhanbatu&rdquo;
                terpetakan ke Kota Batu); keterbatasan ini dijelaskan pada halaman Tentang
                Proyek.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
