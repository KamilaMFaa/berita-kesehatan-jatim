"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, MapPin, SearchX, TriangleAlert, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtNum, fmtTanggal } from "@/lib/format";
import { ISSUE_GROUP_LABELS } from "@/lib/app-types";

export interface ArticleItem {
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

export interface ArticleQuery {
  topicId?: number;
  region?: string;
  tahun?: number;
  dateFrom?: string;
  dateTo?: string;
  issueGroup?: string;
  q?: string;
  sort?: string;
  excludeUncertain?: boolean;
}

interface ApiResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: ArticleItem[];
  error?: string;
}

export interface ArticleListProps {
  baseParams: ArticleQuery;
  /** Tampilkan panel filter (kata kunci, wilayah, tahun, kelompok isu, urutan) */
  withFilters?: boolean;
  /** Daftar wilayah untuk filter (dari agregat aktual) */
  regionOptions?: string[];
  /** Daftar tahun untuk filter */
  yearOptions?: number[];
  pageSize?: number;
  compact?: boolean;
  emptyMessage?: string;
  className?: string;
}

/**
 * Daftar berita dari dataset aktual via /api/articles — dengan paginasi,
 * filter opsional, loading skeleton, dan penanganan kondisi kosong/error.
 */
export function ArticleList({
  baseParams,
  withFilters = false,
  regionOptions = [],
  yearOptions = [],
  pageSize = 10,
  compact = false,
  emptyMessage,
  className,
}: ArticleListProps) {
  const [filters, setFilters] = useState({
    q: "",
    region: "",
    tahun: "",
    issueGroup: "",
    sort: "tanggal_desc",
    excludeUncertain: false,
  });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Reset ke halaman 1 setiap baseParams atau filter berubah
  const paramKey = JSON.stringify(baseParams);
  useEffect(() => {
    setPage(1);
  }, [paramKey, applied]);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    const bp = JSON.parse(paramKey) as ArticleQuery;
    if (bp.topicId !== undefined) params.set("topicId", String(bp.topicId));
    if (bp.region) params.set("region", bp.region);
    if (applied.region) params.set("region", applied.region);
    if (bp.dateFrom) params.set("dateFrom", bp.dateFrom);
    if (bp.dateTo) params.set("dateTo", bp.dateTo);
    if (applied.tahun) params.set("tahun", applied.tahun);
    if (bp.tahun !== undefined && !applied.tahun) params.set("tahun", String(bp.tahun));
    if (applied.issueGroup) params.set("issueGroup", applied.issueGroup);
    if (bp.issueGroup && !applied.issueGroup) params.set("issueGroup", bp.issueGroup);
    if (applied.q) params.set("q", applied.q);
    params.set("sort", applied.sort || bp.sort || "tanggal_desc");
    if (applied.excludeUncertain || bp.excludeUncertain) params.set("excludeUncertain", "1");
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const res = await fetch(`/api/articles?${params.toString()}`);
      const json: ApiResponse = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal memuat data berita.");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi dan coba lagi.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [paramKey, applied, page, pageSize]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const submitFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setApplied(filters);
    setPage(1);
  };

  const gotoPage = (p: number) => {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={cn("space-y-4", className)} ref={topRef}>
      {withFilters && (
        <form
          onSubmit={submitFilters}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-3 rounded-lg border bg-muted/40"
          aria-label="Filter berita"
        >
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="q-berita">
              Kata kunci judul
            </label>
            <Input
              id="q-berita"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="mis. banjir, TPS 3R…"
              className="mt-1 h-9 bg-background"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Wilayah</label>
            <Select
              value={filters.region || "semua"}
              onValueChange={(v) => setFilters((f) => ({ ...f, region: v === "semua" ? "" : v }))}
            >
              <SelectTrigger className="mt-1 h-9 bg-background w-full">
                <SelectValue placeholder="Semua wilayah" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="semua">Semua wilayah</SelectItem>
                {regionOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tahun</label>
            <Select
              value={filters.tahun || "semua"}
              onValueChange={(v) => setFilters((f) => ({ ...f, tahun: v === "semua" ? "" : v }))}
            >
              <SelectTrigger className="mt-1 h-9 bg-background w-full">
                <SelectValue placeholder="Semua tahun" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="semua">Semua tahun</SelectItem>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Kelompok Isu</label>
            <Select
              value={filters.issueGroup || "semua"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, issueGroup: v === "semua" ? "" : v }))
              }
            >
              <SelectTrigger className="mt-1 h-9 bg-background w-full">
                <SelectValue placeholder="Semua kelompok isu" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="semua">Semua kelompok isu</SelectItem>
                {Object.entries(ISSUE_GROUP_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex items-end">
            <Button type="submit" size="sm" className="h-9 w-full cursor-pointer">
              Terapkan Filter
            </Button>
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={filters.excludeUncertain}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, excludeUncertain: e.target.checked }))
                }
                className="h-3.5 w-3.5 accent-teal-700"
              />
              Kecualikan berita dengan wilayah tidak pasti
            </label>
            <span className="text-xs text-muted-foreground">
              Pencarian pada judul berita; filter bersumber dari atribut dataset.
            </span>
          </div>
        </form>
      )}

      {/* Ringkasan jumlah */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat…
            </span>
          ) : data ? (
            <>
              <span className="font-semibold text-foreground">{fmtNum(data.total)}</span>{" "}
              berita ditemukan
              {data.totalPages > 1 && (
                <span className="ml-1">
                  · halaman {data.page} dari {fmtNum(data.totalPages)}
                </span>
              )}
            </>
          ) : (
            "—"
          )}
        </p>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Card className="border-destructive/40">
          <CardContent className="p-5 flex items-start gap-3">
            <TriangleAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium">Gagal memuat berita</p>
              <p className="text-sm text-muted-foreground mt-0.5">{error}</p>
              <Button size="sm" variant="outline" className="mt-3 h-8" onClick={fetchArticles}>
                Coba Lagi
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kosong */}
      {!loading && !error && data && data.items.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <SearchX className="h-8 w-8 mx-auto text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm font-medium">Tidak ada berita yang cocok</p>
            <p className="text-sm text-muted-foreground">
              {emptyMessage ||
                "Coba ubah kata kunci, longgarkan filter, atau pilih topik/wilayah lain."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Daftar berita */}
      {!loading && !error && data && data.items.length > 0 && (
        <ul className="space-y-3">
          {data.items.map((a) => (
            <li key={a.id}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className={compact ? "p-3.5" : "p-4"}>
                  <div className="flex flex-col gap-1.5">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold leading-snug text-sm sm:text-[15px] hover:text-primary hover:underline underline-offset-2"
                    >
                      {a.title}
                      <ExternalLink
                        className="inline h-3.5 w-3.5 ml-1.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </a>
                    {!compact && a.snippet && (
                      <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
                        {a.snippet}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" aria-hidden="true" />
                        {a.publisher || "(penerbit tidak tercatat)"}
                      </span>
                      <span>{fmtTanggal(a.publishedAt)}</span>
                      {a.region && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {a.region}
                          {a.regionTidakPasti && (
                            <span
                              className="text-[10px] italic opacity-75"
                              title="Wilayah hasil pemetaan otomatis dengan tingkat kepastian rendah"
                            >
                              (tidak pasti)
                            </span>
                          )}
                        </span>
                      )}
                      {a.issueGroup && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                          {ISSUE_GROUP_LABELS[a.issueGroup] ?? a.issueGroup}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Paginasi */}
      {!loading && !error && data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={data.page <= 1}
            onClick={() => gotoPage(data.page - 1)}
          >
            Sebelumnya
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            Halaman {data.page} / {fmtNum(data.totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={data.page >= data.totalPages}
            onClick={() => gotoPage(data.page + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}
    </div>
  );
}
