import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/articles — daftar berita dari dataset aktual (SQLite) dengan filter & paginasi.
 * Query params:
 *  - topicId    : number (opsional; -1 = outlier)
 *  - region     : string (opsional; nama kab/kota persis seperti dataset)
 *  - tahun      : number (opsional)
 *  - dateFrom   : string YYYY-MM-DD (opsional; batas awal tanggal publikasi, inklusif)
 *  - dateTo     : string YYYY-MM-DD (opsional; batas akhir tanggal publikasi, inklusif)
 *  - issueGroup : string (opsional; key issue_group dataset)
 *  - q          : string (opsional; pencarian kata kunci pada judul)
 *  - page       : number (default 1)
 *  - pageSize   : number (default 10, maks 50)
 *  - sort       : "tanggal_desc" | "tanggal_asc" | "penerbit" (default tanggal_desc)
 *  - excludeUncertain : "1" untuk mengecualikan dokumen dengan wilayah tidak pasti
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const topicId = sp.get("topicId");
    const region = sp.get("region")?.trim();
    const tahun = sp.get("tahun");
    const dateFrom = sp.get("dateFrom")?.trim();
    const dateTo = sp.get("dateTo")?.trim();
    const issueGroup = sp.get("issueGroup")?.trim();
    const q = sp.get("q")?.trim();
    const sort = sp.get("sort") || "tanggal_desc";
    const excludeUncertain = sp.get("excludeUncertain") === "1";

    let page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(sp.get("pageSize") || "10", 10) || 10));

    const where: Prisma.ArticleWhereInput = {};
    if (topicId !== null && topicId !== "" && !Number.isNaN(Number(topicId))) {
      where.topicId = Number(topicId);
    }
    if (region) where.region = region;
    if (tahun && !Number.isNaN(Number(tahun))) where.tahun = Number(tahun);
    if (issueGroup) where.issueGroup = issueGroup;
    if (q) {
      where.title = { contains: q };
    }
    if (excludeUncertain) where.regionTidakPasti = false;

    // Rentang tanggal publikasi (publishedAt disimpan sebagai string YYYY-MM-DD;
    // perbandingan leksikografis pada format ISO setara dengan perbandingan tanggal).
    const dateFilter: { gte?: string; lte?: string } = {};
    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) dateFilter.gte = dateFrom;
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) dateFilter.lte = dateTo;
    if (dateFilter.gte || dateFilter.lte) where.publishedAt = dateFilter;

    const orderBy: Prisma.ArticleOrderByWithRelationInput[] =
      sort === "tanggal_asc"
        ? [{ publishedAt: "asc" }, { ord: "asc" }]
        : sort === "penerbit"
          ? [{ publisher: "asc" }, { publishedAt: "desc" }]
          : [{ publishedAt: "desc" }, { ord: "desc" }];

    const [total, items] = await Promise.all([
      db.article.count({ where }),
      db.article.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          snippet: true,
          url: true,
          publisher: true,
          publishedAt: true,
          topicId: true,
          region: true,
          regionTidakPasti: true,
          issueGroup: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;

    return NextResponse.json({
      total,
      page,
      pageSize,
      totalPages,
      items,
    });
  } catch (err) {
    console.error("[api/articles] error:", err);
    return NextResponse.json(
      { error: "Gagal memuat data berita. Silakan coba lagi." },
      { status: 500 },
    );
  }
}
