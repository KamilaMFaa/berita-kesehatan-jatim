#!/usr/bin/env python3
"""
prepare_data.py — Tahap pra-implementasi (Tahap 2/3)
Mengubah hasil pemodelan BERTopic (mode penuh) menjadi data siap web:
  1. data/articles.json    : 25.022 artikel (kolom minimal untuk DB seed)
  2. data/topics.json      : 87 topik + outlier (LABEL MANUAL TERBARU dari
                             label_topik_manual_gabungan.csv, digabung berdasarkan
                             kunci topic_id — bukan urutan baris)
  3. data/aggregates.json  : agregat untuk Beranda/Persebaran/Tentang (dihitung dari data aktual)

SUMBER TUNGGAL: project_audit/data/results/penuh/*.csv (hasil SBERT-BERTopic peneliti).
Tidak ada angka yang dikarang; semua dihitung dari file sumber.
CATATAN LABEL: kolom 'topic_label_baru' (label manual gabungan) dipakai apa adanya.
Kolom 'topic_label_baru_revisi' hanya terisi pada 6 topik dan seluruhnya berstatus
"Perlu verifikasi" — TIDAK dipakai sampai peneliti mengonfirmasi. ID topik asli
dipertahankan untuk penggabungan data; label manual hanya berfungsi sebagai nama topik.
"""
import json
from pathlib import Path
from collections import Counter, defaultdict

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent  # akar proyek (portabel, tanpa path absolut)
SRC = ROOT / "project_audit" / "data" / "results" / "penuh"
OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)

# ---------------------------------------------------------------- load CSV
print("Memuat berita_dengan_topik.csv ...")
bd = pd.read_csv(SRC / "berita_dengan_topik.csv", low_memory=False)
rk = pd.read_csv(SRC / "ringkasan_topik.csv")
dr = pd.read_csv(SRC / "dokumen_representatif.csv")
ev = pd.read_csv(SRC / "evaluasi_model.csv")

assert len(bd) == 25022, f"Jumlah baris berubah: {len(bd)}"

# ---------------------------------------------------------------- label manual
# SUMBER LABEL TOPIK MANUAL TERBARU (instruksi peneliti):
#   results/penuh/label_topik_manual_gabungan.csv — digabung berdasarkan topic_id.
print("Memuat label_topik_manual_gabungan.csv (label manual terbaru) ...")
gm = pd.read_csv(SRC / "label_topik_manual_gabungan.csv")

# --- Validasi kunci penggabungan (laporkan, jangan didiamkan) ---
assert gm["topic_id"].is_unique, "DUPLIKASI topic_id pada label_topik_manual_gabungan.csv!"
dup_labels = gm["topic_label_baru"][gm["topic_label_baru"].duplicated(keep=False)].tolist()
if dup_labels:
    print(f"  PERINGATAN: topic_label_baru duplikat antar topik: {dup_labels}")
rk_ids = set(rk["topic_id"].astype(int))
gm_ids = set(gm["topic_id"].astype(int))
missing = rk_ids - gm_ids
extra = gm_ids - rk_ids
if missing:
    print(f"  PERINGATAN: topik TANPA label manual (fallback ke label kata kunci model): {sorted(missing)}")
if extra:
    print(f"  PERINGATAN: label manual untuk topik yang tidak ada di run penuh (diabaikan): {sorted(extra)}")

n_revisi = int((gm["topic_label_baru_revisi"].notna() &
                (gm["topic_label_baru_revisi"].astype(str).str.strip() != "")).sum())
print(f"  label manual: {len(gm)} baris, {len(gm_ids & rk_ids)} cocok dengan run penuh; "
      f"{n_revisi} baris punya revisi berstatus 'Perlu verifikasi' (TIDAK dipakai).")

# Gabungkan berdasarkan KUNCI topic_id (bukan urutan baris)
rk = rk.merge(
    gm[["topic_id", "topic_label_baru"]].rename(columns={"topic_id": "topic_id_gm"}),
    left_on="topic_id", right_on="topic_id_gm", how="left",
)
rk = rk.drop(columns=["topic_id_gm"])
# Baris tanpa label manual: fallback label kata kunci model + peringatan (tidak mengarang)
fallback_mask = rk["topic_label_baru"].isna() | (rk["topic_label_baru"].astype(str).str.strip() == "")
if fallback_mask.any():
    print(f"  PERINGATAN: {int(fallback_mask.sum())} topik tanpa label manual -> pakai topic_label (keyword)")
    rk.loc[fallback_mask, "topic_label_baru"] = rk.loc[fallback_mask, "topic_label"]

label_source_meta = {
    "file": "results/penuh/label_topik_manual_gabungan.csv",
    "kolom": "topic_label_baru",
    "kunciGabung": "topic_id",
    "jumlahTopik": int(rk["topic_label_baru"].notna().sum()),
    "revisiBelumVerifikasi": n_revisi,
}

# ---------------------------------------------------------------- 1) topics.json
topics = []
for _, r in rk.iterrows():
    tid = int(r["topic_id"])
    keywords = [k.strip() for k in str(r["topic_keywords"]).split(";") if k.strip()]
    reps = []
    sub = dr[dr["topic_id"] == tid].sort_values("peringkat").head(3)
    for _, d in sub.iterrows():
        reps.append({
            "kutipan": str(d["kutipan"])[:220],
            "tanggal": str(d.get("published_at", "")),
            "wilayah": str(d.get("wilayah", "")),
            "penerbit": str(d.get("penerbit", "")),
        })
    topics.append({
        "id": tid,                                    # ID topik asli dipertahankan
        "label": str(r["topic_label_baru"]),          # label manual terbaru (gabungan, join topic_id)
        "keywords": keywords[:10],                    # kata kunci model (jangkar konten)
        "count": int(r["document_count"]),
        "percentage": float(r["document_percentage"]),
        "representatives": reps,
    })

topics.sort(key=lambda t: (-t["count"], t["id"]))
with open(OUT / "topics.json", "w", encoding="utf-8") as f:
    json.dump(topics, f, ensure_ascii=False)
print(f"topics.json: {len(topics)} topik")

# ---------------------------------------------------------------- 2) articles.json
print("Menyusun articles.json ...")
articles = []
for i, r in enumerate(bd.itertuples(index=False)):
    title = ("" if pd.isna(r.title) else str(r.title)).strip()
    snippet = ("" if pd.isna(r.teks_bersih) else str(r.teks_bersih)).strip()
    if snippet.startswith(title):
        snippet = snippet[len(title):].strip(" |–-—")
    if len(snippet) > 220:
        snippet = snippet[:220].rstrip() + "…"
    tanggal = "" if pd.isna(r.tanggal_saja) else str(r.tanggal_saja)
    articles.append({
        "i": int(r.row_id) if not pd.isna(r.row_id) else i,   # row_id stabil dari pemodelan
        "id": str(r.news_id),
        "t": title,
        "s": snippet,
        "u": str(r.url),
        "p": "" if pd.isna(r.publisher) else str(r.publisher),
        "d": tanggal,                                          # YYYY-MM-DD
        "y": int(r.tahun) if not pd.isna(r.tahun) else None,
        "m": "" if pd.isna(r.bulan) else str(r.bulan),         # YYYY-MM
        "k": int(r.topic_id),                                  # topic id (-1 outlier)
        "r": "" if pd.isna(r.region_analisis) else str(r.region_analisis),
        "ru": bool(r.region_tidak_pasti),
        "g": "" if pd.isna(r.issue_group) else str(r.issue_group),
    })

with open(OUT / "articles.json", "w", encoding="utf-8") as f:
    json.dump(articles, f, ensure_ascii=False)
print(f"articles.json: {len(articles)} artikel")

# ---------------------------------------------------------------- 3) aggregates.json
print("Menghitung agregat dari data aktual ...")
total = len(articles)
n_topics = sum(1 for t in topics if t["id"] != -1)
outlier_count = sum(1 for a in articles if a["k"] == -1)
dates = [a["d"] for a in articles if a["d"]]
n_publishers = len({a["p"] for a in articles if a["p"]})
n_regions = len({a["r"] for a in articles if a["r"]})

# issue_group
ISSUE_LABELS = {
    "sampah": "Sampah & Pengelolaan Limbah",
    "banjir_genangan": "Banjir & Genangan",
    "air_bersih": "Air Bersih",
    "limbah_pencemaran": "Limbah & Pencemaran",
    "sanitasi_kebersihan": "Sanitasi & Kebersihan",
    "bau_pencemaran_udara": "Bau & Pencemaran Udara",
    "kesehatan_lingkungan_umum": "Kesehatan Lingkungan Umum",
}
issue_counts = Counter(a["g"] for a in articles if a["g"])
issue_groups = [
    {"key": k, "label": ISSUE_LABELS.get(k, k), "count": c}
    for k, c in issue_counts.most_common()
]

# wilayah
region_counts = Counter(a["r"] for a in articles if a["r"])
regions = [{"name": k, "count": c} for k, c in region_counts.most_common()]

# tren bulanan total (semua artikel termasuk outlier)
monthly = Counter(a["m"] for a in articles if a["m"])
monthly_total = [{"periode": k, "jumlah": v} for k, v in sorted(monthly.items())]

# tren tahunan
yearly = Counter(a["y"] for a in articles if a["y"])
yearly_total = [{"tahun": int(k), "jumlah": v} for k, v in sorted(yearly.items(), key=lambda x: (x[0] is None, x[0]))]

# hubungan wilayah x topik: 3 topik teratas per wilayah (di luar outlier)
reg_topic = defaultdict(Counter)
topic_label_by_id = {t["id"]: t["label"] for t in topics}
for a in articles:
    if a["k"] != -1 and a["r"]:
        reg_topic[a["r"]][a["k"]] += 1
region_top_topics = []
for reg, cnt in reg_topic.items():
    top3 = cnt.most_common(3)
    region_top_topics.append({
        "region": reg,
        "count": sum(cnt.values()),
        "topics": [
            {"topicId": tid, "label": topic_label_by_id.get(tid, f"Topik {tid}"), "count": c}
            for tid, c in top3
        ],
    })
region_top_topics.sort(key=lambda x: -x["count"])

# topik dominan agregat — dari tiga_topik_dominan.csv
tiga = pd.read_csv(SRC / "tiga_topik_dominan.csv")
agregat = tiga[tiga["definisi"] == "agregat_seluruh_periode"].sort_values("peringkat")
top_dominan = []
for _, r in agregat.head(5).iterrows():
    top_dominan.append({
        "peringkat": int(r["peringkat"]),
        "topicId": int(r["topic_id"]),
        "label": topic_label_by_id.get(int(r["topic_id"]), str(r["topic_label"])),
        "count": int(r["jumlah_dokumen"]),
        "persen": float(r["persen_dokumen_reguler"]),
    })

# metrik evaluasi model (dari evaluasi_model.csv — tidak diubah)
evaluation = {}
for _, r in ev.iterrows():
    evaluation[str(r["metrik"])] = {
        "nilai": None if pd.isna(r["nilai"]) else str(r["nilai"]),
        "catatan": "" if pd.isna(r["catatan"]) else str(r["catatan"]),
    }

aggregates = {
    "labelSource": label_source_meta,
    "totalArticles": total,
    "nTopics": n_topics,
    "outlierCount": outlier_count,
    "outlierPct": round(outlier_count / total * 100, 1),
    "regionUncertainCount": sum(1 for a in articles if a["ru"]),
    "dateMin": min(dates) if dates else None,
    "dateMax": max(dates) if dates else None,
    "nPublishers": n_publishers,
    "nRegions": n_regions,
    "issueGroups": issue_groups,
    "regions": regions,
    "monthlyTotal": monthly_total,
    "yearlyTotal": yearly_total,
    "regionTopTopics": region_top_topics,
    "topDominant": top_dominan,
    "evaluation": evaluation,
    "topTopics": [
        {"id": t["id"], "label": t["label"], "count": t["count"], "percentage": t["percentage"]}
        for t in topics if t["id"] != -1
    ][:12],
}
with open(OUT / "aggregates.json", "w", encoding="utf-8") as f:
    json.dump(aggregates, f, ensure_ascii=False)
print("aggregates.json selesai")
print(f"  total={total}, topik={n_topics}, outlier={outlier_count} ({aggregates['outlierPct']}%), "
      f"wilayah={n_regions}, penerbit={n_publishers}")
print(f"  periode: {aggregates['dateMin']} s.d. {aggregates['dateMax']}")
