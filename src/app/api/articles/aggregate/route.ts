import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getTopics } from "@/lib/app-data";
import { classifyDbError } from "@/lib/db-errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/articles/aggregate — agregasi jumlah berita hasil filter aktif.
 * Dipakai halaman "Filter Topik dan Persebaran" agar peta, grafik wilayah, dan
 * daftar topik selalu konsisten dengan filter yang sama (satu dataset, satu filter).
 *
 * Query params:
 *  - by              : "region" | "topic" (wajib)
 *  - topicId, region, tahun, dateFrom, dateTo, issueGroup, q, excludeUncertain
 *                    : filter yang sama dengan /api/articles
 *  - limit           : maks baris agregasi (default 40, maks 100)
 *
 * Respons:
 *  - total           : jumlah seluruh berita yang lolos filter (independen dari `by`)
 *  - items           : [{ key, label, count }] urut jumlah terbanyak
 *
 * Catatan: untuk by=region, berita tanpa wilayah (string kosong) tidak ikut
 * dikelompokkan; untuk by=topic, outlier (topicId=-1) tidak ikut karena bukan
 * topik substantif (angka outlier tersedia di agregat Beranda).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const by = sp.get("by") === "topic" ? "topic" : "region";
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "40", 10) || 40));

    const topicId = sp.get("topicId");
    const region = sp.get("region")?.trim();
    const tahun = sp.get("tahun");
    const dateFrom = sp.get("dateFrom")?.trim();
    const dateTo = sp.get("dateTo")?.trim();
    const issueGroup = sp.get("issueGroup")?.trim();
    const q = sp.get("q")?.trim();
    const excludeUncertain = sp.get("excludeUncertain") === "1";

    const where: Prisma.ArticleWhereInput = {};
    if (topicId !== null && topicId !== "" && !Number.isNaN(Number(topicId))) {
      where.topicId = Number(topicId);
    }
    if (region) where.region = region;
    if (tahun && !Number.isNaN(Number(tahun))) where.tahun = Number(tahun);
    if (issueGroup) where.issueGroup = issueGroup;
    if (q) where.title = { contains: q };
    if (excludeUncertain) where.regionTidakPasti = false;

    const dateFilter: { gte?: string; lte?: string } = {};
    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) dateFilter.gte = dateFrom;
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) dateFilter.lte = dateTo;
    if (dateFilter.gte || dateFilter.lte) where.publishedAt = dateFilter;

    // Total berita yang lolos filter (untuk "jumlah hasil" di halaman)
    const total = await db.article.count({ where });

    let items: { key: string; label: string; count: number }[] = [];

    if (by === "region") {
      const grouped = await db.article.groupBy({
        by: ["region"],
        _count: { _all: true },
        where: { ...where, region: { not: "" } },
        orderBy: { _count: { region: "desc" } },
        take: limit,
      });
      items = grouped.map((g) => ({
        key: g.region,
        label: g.region,
        count: g._count._all,
      }));
    } else {
      const grouped = await db.article.groupBy({
        by: ["topicId"],
        _count: { _all: true },
        where: { ...where, topicId: { not: -1 } },
        orderBy: { _count: { topicId: "desc" } },
        take: limit,
      });
      // Label topik = label manual terbaru (label_topik_manual_gabungan.csv),
      // digabung berdasarkan topic_id asli — sumber yang sama dengan seluruh UI.
      const labelById = new Map(getTopics().map((t) => [t.id, t.label]));
      items = grouped.map((g) => ({
        key: String(g.topicId),
        label: labelById.get(g.topicId) ?? `Topik ${g.topicId}`,
        count: g._count._all,
      }));
    }

    return NextResponse.json({ by, total, items });
  } catch (err) {
    console.error("[api/articles/aggregate] error:", err);
    const info = classifyDbError(err);
    return NextResponse.json(
      { error: info.pesan, code: info.code },
      { status: info.code === "DB_NOT_CONFIGURED" || info.code === "DB_AUTH" || info.code === "DB_EMPTY" ? 503 : 500 },
    );
  }
}
