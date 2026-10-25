"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  MapPin,
  ListFilter,
  BarChart3,
  TriangleAlert,
  Quote,
  Layers,
  CalendarRange,
  RotateCcw,
  Loader2,
  SearchX,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AggregateData, TopicItem } from "@/lib/app-types";
import { ISSUE_GROUP_LABELS } from "@/lib/app-types";
import { fmtNum, fmtTanggal } from "@/lib/format";
import { ArticleList, type ArticleQuery } from "@/components/article-list";
import type { MapRegion } from "@/components/region-map";

const RegionMap = dynamic(() => import("@/components/region-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] sm:h-[440px] rounded-lg border bg-muted animate-pulse flex items-center justify-center">
      <span className="text-sm text-muted-foreground">Memuat peta…</span>
    </div>
  ),
});

/* ------------------------------------------------------------------ */
/* State filter gabungan (satu sumber kebenaran untuk seluruh panel)   */
/* ------------------------------------------------------------------ */

interface FilterState {
  region: string;
  topicId: number | null;
  dateFrom: string;
  dateTo: string;
  issueGroup: string;
  q: string;
  excludeUncertain: boolean;
}

const EMPTY_FILTERS: FilterState = {
  region: "",
  topicId: null,
  dateFrom: "",
  dateTo: "",
  issueGroup: "",
  q: "",
  excludeUncertain: false,
};

interface AggResponse {
  by: string;
  total: number;
  items: { key: string; label: string; count: number }[];
  error?: string;
}

const OUTLIER_ID = -1;

/**
 * Halaman "Filter Topik dan Persebaran" — SATU halaman terpadu:
 * filter (wilayah + topik + rentang tanggal + kelompok isu + kata kunci)
 * diterapkan pada dataset yang sama, lalu memperbarui peta, jumlah hasil,
 * agregat wilayah/topik, dan daftar berita secara serentak.
 */
export function FilterPersebaranView({
  aggregates: agg,
  topics,
}: {
  aggregates: AggregateData;
  topics: TopicItem[];
}) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [qInput, setQInput] = useState("");

  // Debounce kata kunci judul (400 ms) agar tidak memanggil API tiap ketikan
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === qInput.trim() ? f : { ...f, q: qInput.trim() }));
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const baseParams = useMemo<ArticleQuery>(() => {
    const p: ArticleQuery = {};
    if (filters.topicId !== null) p.topicId = filters.topicId;
    if (filters.region) p.region = filters.region;
    if (filters.dateFrom) p.dateFrom = filters.dateFrom;
    if (filters.dateTo) p.dateTo = filters.dateTo;
    if (filters.issueGroup) p.issueGroup = filters.issueGroup;
    if (filters.q) p.q = filters.q;
    if (filters.excludeUncertain) p.excludeUncertain = true;
    return p;
  }, [filters]);
  const paramKey = JSON.stringify(baseParams);

  /* ---------------- Agregasi hasil filter (peta + grafik) ---------------- */
  const [regionAgg, setRegionAgg] = useState<AggResponse | null>(null);
  const [topicAgg, setTopicAgg] = useState<AggResponse | null>(null);
  const [aggLoading, setAggLoading] = useState(true);
  const [aggError, setAggError] = useState<string | null>(null);

  const fetchAggregates = useCallback(async () => {
    setAggLoading(true);
    setAggError(null);
    const qs = new URLSearchParams();
    const bp = JSON.parse(paramKey) as ArticleQuery;
    if (bp.topicId !== undefined) qs.set("topicId", String(bp.topicId));
    if (bp.region) qs.set("region", bp.region);
    if (bp.dateFrom) qs.set("dateFrom", bp.dateFrom);
    if (bp.dateTo) qs.set("dateTo", bp.dateTo);
    if (bp.issueGroup) qs.set("issueGroup", bp.issueGroup);
    if (bp.q) qs.set("q", bp.q);
    if (bp.excludeUncertain) qs.set("excludeUncertain", "1");

    try {
      const [regRes, topRes] = await Promise.all([
        fetch(`/api/articles/aggregate?by=region&limit=40&${qs.toString()}`),
        fetch(`/api/articles/aggregate?by=topic&limit=6&${qs.toString()}`),
      ]);
      const regJson: AggResponse = await regRes.json();
      const topJson: AggResponse = await topRes.json();
      if (!regRes.ok || !topRes.ok) {
        throw new Error(regJson.error || topJson.error || "gagal");
      }
      setRegionAgg(regJson);
      setTopicAgg(topJson);
    } catch {
      setAggError("Agregasi hasil filter gagal dimuat. Silakan coba lagi.");
      setRegionAgg(null);
      setTopicAgg(null);
    } finally {
      setAggLoading(false);
    }
  }, [paramKey]);

  useEffect(() => {
    fetchAggregates();
  }, [fetchAggregates]);

  const total = regionAgg?.total ?? null;
  const isEmpty = !aggLoading && !aggError && total === 0;

  const mapRegions: MapRegion[] = useMemo(
    () => (regionAgg?.items ?? []).map((i) => ({ name: i.key, count: i.count })),
    [regionAgg],
  );

  const barData = useMemo(
    () =>
      (regionAgg?.items ?? []).slice(0, 15).map((i) => ({
        name: i.key.replace("Kabupaten ", "Kab. "),
        full: i.key,
        jumlah: i.count,
      })),
    [regionAgg],
  );

  const topTopicItems = topicAgg?.items ?? [];
  const selectedTopic = topics.find((t) => t.id === filters.topicId) ?? null;
  const nFilterAktif = [
    filters.region,
    filters.topicId !== null ? "t" : "",
    filters.dateFrom || filters.dateTo ? "d" : "",
    filters.issueGroup,
    filters.q,
    filters.excludeUncertain ? "u" : "",
  ].filter(Boolean).length;

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setQInput("");
  };

  const toggleRegion = (name: string) =>
    setFilters((f) => ({ ...f, region: f.region === name ? "" : name }));
  const toggleTopic = (id: number) =>
    setFilters((f) => ({ ...f, topicId: f.topicId === id ? null : id }));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-5">
      <header>
        <h1 className="text-xl sm:text-2xl font-bold">Filter Topik dan Persebaran</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-3xl leading-relaxed">
          Terapkan filter <b className="text-foreground">wilayah</b>,{" "}
          <b className="text-foreground">topik</b>, dan{" "}
          <b className="text-foreground">rentang tanggal publikasi</b> pada{" "}
          {fmtNum(agg.totalArticles)} berita hasil pemodelan SBERT–BERTopic. Peta, jumlah hasil,
          agregat, dan daftar berita selalu diperbarui bersamaan dari dataset yang sama.
        </p>
      </header>

      {/* ==================== PANEL FILTER GABUNGAN ==================== */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Wilayah (kabupaten/kota)
              </label>
              <Select
                value={filters.region || "semua"}
                onValueChange={(v) => setFilter("region", v === "semua" ? "" : v)}
              >
                <SelectTrigger className="mt-1 h-9 bg-background w-full">
                  <SelectValue placeholder="Semua wilayah" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="semua">Semua wilayah ({fmtNum(agg.nRegions)})</SelectItem>
                  {agg.regions.map((r) => (
                    <SelectItem key={r.name} value={r.name}>
                      {r.name} ({fmtNum(r.count)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                Topik (label manual peneliti)
              </label>
              <Select
                value={filters.topicId === null ? "semua" : String(filters.topicId)}
                onValueChange={(v) =>
                  setFilter("topicId", v === "semua" ? null : Number(v))
                }
              >
                <SelectTrigger className="mt-1 h-9 bg-background w-full">
                  <SelectValue placeholder="Semua topik" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="semua">Semua topik ({fmtNum(agg.nTopics)})</SelectItem>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.label.length > 60 ? `${t.label.slice(0, 60)}…` : t.label} ({fmtNum(t.count)})
                    </SelectItem>
                  ))}
                  <SelectItem value="-1">Outlier — di luar topik (topik -1)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
                Rentang tanggal publikasi
              </label>
              <div className="flex items-center gap-1.5 mt-1">
                <Input
                  type="date"
                  value={filters.dateFrom}
                  min={agg.dateMin ?? undefined}
                  max={agg.dateMax ?? undefined}
                  onChange={(e) => setFilter("dateFrom", e.target.value)}
                  className="h-9 bg-background"
                  aria-label="Tanggal mulai"
                />
                <span className="text-xs text-muted-foreground shrink-0">s.d.</span>
                <Input
                  type="date"
                  value={filters.dateTo}
                  min={agg.dateMin ?? undefined}
                  max={agg.dateMax ?? undefined}
                  onChange={(e) => setFilter("dateTo", e.target.value)}
                  className="h-9 bg-background"
                  aria-label="Tanggal selesai"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Dataset: {fmtTanggal(agg.dateMin)} – {fmtTanggal(agg.dateMax)}
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                Kata kunci judul
              </label>
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="mis. banjir, TPS 3R…"
                className="mt-1 h-9 bg-background"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Kelompok isu</label>
              <Select
                value={filters.issueGroup || "semua"}
                onValueChange={(v) => setFilter("issueGroup", v === "semua" ? "" : v)}
              >
                <SelectTrigger className="mt-1 h-9 bg-background w-full">
                  <SelectValue placeholder="Semua kelompok isu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua kelompok isu</SelectItem>
                  {Object.entries(ISSUE_GROUP_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={filters.excludeUncertain}
                  onChange={(e) => setFilter("excludeUncertain", e.target.checked)}
                  className="h-3.5 w-3.5 accent-teal-700"
                />
                Kecualikan berita wilayah &ldquo;tidak pasti&rdquo;
              </label>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {nFilterAktif > 0
                    ? `${nFilterAktif} filter aktif — hasil diperbarui otomatis`
                    : "Belum ada filter aktif"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 cursor-pointer"
                  onClick={resetFilters}
                  disabled={nFilterAktif === 0}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ==================== JUMLAH HASIL ==================== */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ListFilter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {aggLoading ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menghitung hasil…
          </span>
        ) : aggError ? (
          <span className="text-destructive inline-flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" /> {aggError}
            <Button size="sm" variant="outline" className="h-7" onClick={fetchAggregates}>
              Coba Lagi
            </Button>
          </span>
        ) : (
          <>
            <span>
              <span className="font-semibold text-foreground">{fmtNum(total ?? 0)}</span>{" "}
              berita lolos filter
            </span>
            <Badge variant="secondary" className="text-[11px] font-normal">
              peta & daftar di bawah mencerminkan filter yang sama
            </Badge>
          </>
        )}
      </div>

      {/* ==================== DETAIL TOPIK TERPILIH ==================== */}
      {filters.topicId === OUTLIER_ID && (
        <Card className="border-amber-200 bg-accent/40">
          <CardContent className="p-4 flex items-start gap-3">
            <TriangleAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-amber-900">
                Topik -1 · Outlier: {fmtNum(agg.outlierCount)} dokumen ({agg.outlierPct}%)
              </p>
              <p className="mt-1">
                Dokumen outlier tidak masuk ke topik reguler mana pun hasil klasterisasi
                BERTopic — bukan berarti dokumen tersebut membahas topik kesehatan tertentu.
                Angka ini ditampilkan apa adanya, tidak disembunyikan.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {selectedTopic && <TopicDetailCard topic={selectedTopic} />}

      {/* ==================== PETA + GRAFIK ==================== */}
      {isEmpty ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <SearchX className="h-10 w-10 mx-auto text-muted-foreground/60" aria-hidden="true" />
            <p className="font-medium">Tidak ada berita yang cocok dengan filter</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Peta dan grafik tidak menampilkan apa pun karena tidak ada data yang lolos.
              Coba longgarkan filter (mis. hapus kata kunci, perlebar rentang tanggal, atau
              pilih &ldquo;Semua topik&rdquo;), lalu hasil akan diperbarui otomatis.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <Card className="lg:col-span-7">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Peta Persebaran Berita (hasil filter)</CardTitle>
              <CardDescription>
                Ukuran lingkaran sebanding dengan jumlah berita yang lolos filter. Klik
                wilayah untuk memakainya sebagai filter.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aggLoading ? (
                <div className="h-[380px] sm:h-[440px] rounded-lg border bg-muted animate-pulse flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">Memuat peta…</span>
                </div>
              ) : (
                <RegionMap
                  regions={mapRegions}
                  selected={filters.region || null}
                  onSelect={toggleRegion}
                />
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-5 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  Wilayah Terbanyak (hasil filter)
                </CardTitle>
                <CardDescription>Klik batang untuk memilih wilayah.</CardDescription>
              </CardHeader>
              <CardContent>
                {barData.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">
                    Tidak ada berita berwilayah pada hasil filter ini.
                  </p>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={barData}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 4, bottom: 0 }}
                        onClick={(state) => {
                          const label = state?.activeLabel;
                          if (label) {
                            const found = barData.find((b) => b.name === label);
                            if (found) toggleRegion(found.full);
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e6" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value) => [`${fmtNum(Number(value))} berita`, "Jumlah"]}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                        />
                        <Bar
                          dataKey="jumlah"
                          fill={filters.region ? "#94a3b8" : "#0f766e"}
                          radius={[0, 4, 4, 0]}
                          barSize={13}
                          className="cursor-pointer"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Topik terbanyak pada hasil filter — klik untuk memakai filter topik */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" aria-hidden="true" />
                  Topik Terbanyak (hasil filter)
                </CardTitle>
                <CardDescription>
                  Klik untuk memakai topik sebagai filter — label dari sumber manual yang
                  sama dengan seluruh halaman.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topTopicItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Tidak ada topik reguler pada hasil filter ini (mis. seluruh hasil adalah
                    outlier).
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {topTopicItems.map((t) => (
                      <li key={t.key}>
                        <button
                          onClick={() => toggleTopic(Number(t.key))}
                          aria-pressed={filters.topicId === Number(t.key)}
                          className={cn(
                            "w-full text-left rounded-md border px-3 py-2 flex items-center justify-between gap-2 transition-colors cursor-pointer",
                            filters.topicId === Number(t.key)
                              ? "border-primary bg-secondary"
                              : "hover:bg-muted/70 border-transparent",
                          )}
                        >
                          <span className="text-[13px] font-medium leading-snug line-clamp-1">
                            {t.label}
                          </span>
                          <Badge
                            variant="secondary"
                            className="shrink-0 tabular-nums text-[11px]"
                          >
                            {fmtNum(t.count)}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ==================== DAFTAR BERITA HASIL FILTER ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Berita Hasil Filter</CardTitle>
          <CardDescription>
            Judul, tanggal, wilayah, penerbit, dan tautan sumber diambil apa adanya dari
            dataset. Urutan default: tanggal publikasi terbaru yang tersedia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArticleList baseParams={baseParams} withFilters={false} pageSize={10} />
        </CardContent>
      </Card>

      {/* ==================== DISCLAIMER METODOLOGIS ==================== */}
      <Card className="border-amber-200 bg-accent/40">
        <CardContent className="p-4 flex items-start gap-3">
          <TriangleAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <b className="text-foreground">Cara membaca peta:</b> jumlah artikel per wilayah
            dihitung dari pemetaan nama kabupaten/kota pada teks berita (policy kandidat
            pertama). {fmtNum(agg.regionUncertainCount)} berita memiliki wilayah
            &ldquo;tidak pasti&rdquo; dan dapat dikecualikan melalui filter. Titik peta
            menempati <b className="text-foreground">pusat administratif</b> kabupaten/kota
            (referensi geografis publik) — bukan lokasi kejadian tiap berita. Pemetaan
            otomatis dapat salah memetakan sebagian berita luar Jawa Timur (mis.
            &ldquo;Batu Bara&rdquo;/&ldquo;Labuhanbatu&rdquo; terpetakan ke Kota Batu) — angka
            ditampilkan apa adanya sebagai keterbatasan dataset. Label topik bersumber dari{" "}
            <code>label_topik_manual_gabungan.csv</code> (label manual peneliti, digabung
            berdasarkan <code>topic_id</code>) dan bukan ground truth. Visualisasi ini
            bersifat deskriptif atas dokumen yang dianalisis, bukan indikator kesehatan
            masyarakat wilayah.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kartu detail topik terpilih                                         */
/* ------------------------------------------------------------------ */
function TopicDetailCard({ topic }: { topic: TopicItem }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg leading-snug">{topic.label}</CardTitle>
        <CardDescription className="mt-1.5">
          Topik ID {topic.id} · {fmtNum(topic.count)} dokumen ({topic.percentage}% dari
          seluruh dataset) · label manual peneliti
        </CardDescription>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {topic.keywords.map((k) => (
            <Badge key={k} variant="outline" className="text-[11px] font-normal">
              {k}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {topic.representatives.length > 0 && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Quote className="h-3.5 w-3.5" aria-hidden="true" />
              Contoh judul representatif (dokumen terdekat ke pusat klaster):
            </p>
            <ul className="space-y-1">
              {topic.representatives.map((r, i) => (
                <li key={i} className="text-xs leading-relaxed">
                  &ldquo;{r.kutipan}&rdquo;
                  <span className="text-muted-foreground">
                    {" "}
                    — {r.wilayah || "wilayah tidak tercatat"},{" "}
                    {r.penerbit || "penerbit tidak tercatat"}
                    {r.tanggal ? ` (${r.tanggal})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
