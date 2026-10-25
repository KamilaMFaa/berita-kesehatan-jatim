#!/usr/bin/env python3
"""
Audit alignment: label_topik_manual_gabungan.csv vs ringkasan_topik.csv vs berita_dengan_topik.csv
Memeriksa: duplikasi kunci, label tak cocok, topik tanpa label, pola pergeseran.
TIDAK mengubah file apa pun — analisis read-only.
"""
import csv
from collections import Counter

BASE = "/home/z/my-project/project_audit/data/results/penuh"

def load_csv(path):
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

gab = load_csv(f"{BASE}/label_topik_manual_gabungan.csv")
ring = load_csv(f"{BASE}/ringkasan_topik.csv")
konteks = load_csv(f"{BASE}/konteks_label.csv")

print("=" * 78)
print("1. STRUKTUR KOLOM")
print("=" * 78)
print("gabungan kolom       :", list(gab[0].keys()))
print("ringkasan kolom      :", list(ring[0].keys()))
print("konteks kolom        :", list(konteks[0].keys()))

print()
print("=" * 78)
print("2. DUPLIKASI & CAKUPAN KUNCI topic_id")
print("=" * 78)
gab_ids = [r["topic_id"].strip() for r in gab]
dup = {k: v for k, v in Counter(gab_ids).items() if v > 1}
print(f"gabungan baris       : {len(gab)}  | topic_id unik: {len(set(gab_ids))} | duplikat: {dup if dup else 'TIDAK ADA'}")
ring_ids = {r["topic_id"].strip() for r in ring}
print(f"ringkasan topic unik : {len(ring_ids)}")
missing_in_gab = sorted(ring_ids - set(gab_ids), key=lambda x: int(x))
extra_in_gab = sorted(set(gab_ids) - ring_ids, key=lambda x: int(x))
print(f"topik di ringkasan tapi TIDAK ada di gabungan : {missing_in_gab if missing_in_gab else 'TIDAK ADA'}")
print(f"topik di gabungan tapi tidak ada di ringkasan : {extra_in_gab if extra_in_gab else 'TIDAK ADA'}")
print(f"apakah topic -1 (outlier) ada di gabungan     : {'-1' in set(gab_ids)}")

# Label kosong?
kosong_baru = [r["topic_id"] for r in gab if not r.get("topic_label_baru", "").strip()]
kosong_awal = [r["topic_id"] for r in gab if not r.get("topic_label_awal", "").strip()]
print(f"topic_label_baru KOSONG di topic_id : {kosong_baru if kosong_baru else 'TIDAK ADA'}")
print(f"topic_label_awal KOSONG di topic_id : {kosong_awal if kosong_awal else 'TIDAK ADA'}")

# Revisi terisi?
revisi = [(r["topic_id"], r.get("topic_label_baru_revisi", "").strip(), r.get("status_revisi", "").strip())
          for r in gab if r.get("topic_label_baru_revisi", "").strip() or r.get("topic_label_awal_revisi", "").strip()]
print(f"baris dengan kolom revisi TERISI: {len(revisi)}")
for t, lbl, st in revisi[:20]:
    print(f"   topic {t}: baru_revisi='{lbl[:60]}' status='{st}'")

print()
print("=" * 78)
print("3. KECEMASUAN label_awal (gabungan) vs topic_label (ringkasan) — PER topic_id")
print("=" * 78)
ring_by_id = {r["topic_id"].strip(): r for r in ring}
cocok, beda = [], []
for r in gab:
    tid = r["topic_id"].strip()
    awal = r.get("topic_label_awal", "").strip()
    ring_label = ring_by_id.get(tid, {}).get("topic_label", "").strip()
    if not ring_label:
        continue
    if awal == ring_label:
        cocok.append(tid)
    else:
        beda.append((tid, awal, ring_label))
print(f"SESUAI persis (topic_label_awal == ringkasan.topic_label): {len(cocok)}/{len(gab)}")
print(f"TIDAK SESUAI: {len(beda)}")
for tid, awal, rl in beda[:15]:
    print(f"   topic {tid:>3}: gabungan.awal='{awal[:42]}' | ringkasan='{rl[:42]}'")

print()
print("=" * 78)
print("4. POLA PERGESERAN: apakah gabungan.awal[i] == ringkasan.topic_label[j] untuk j lain?")
print("=" * 78)
ring_label_to_id = {}
for r in ring:
    ring_label_to_id[r["topic_label"].strip()] = r["topic_id"].strip()
shift_found = []
for tid, awal, rl in beda:
    if awal in ring_label_to_id:
        shift_found.append((tid, ring_label_to_id[awal]))
print(f"label_awal ditemukan di topic_id LAIN pada ringkasan: {len(shift_found)}/{len(beda)}")
for a, b in shift_found[:20]:
    print(f"   gabungan topic {a:>3} -> konten cocok dengan ringkasan topic {b}")

print()
print("=" * 78)
print("5. KECEMASUAN topic_label_baru (gabungan) vs topic_label_final (ringkasan)")
print("=" * 78)
n_sama = sum(1 for r in gab
             if r.get("topic_label_baru", "").strip() == ring_by_id.get(r["topic_id"].strip(), {}).get("topic_label_final", "").strip())
print(f"topic_label_baru == ringkasan.topic_label_final (per topic_id): {n_sama}/{len(gab)}")

print()
print("=" * 78)
print("6. VALIDASI KONTEN vs LABEL (konteks_label contoh_dokumen vs gabungan.label_baru)")
print("=" * 78)
# Heuristik v2: kata-kata bermakna dari label (kalimat) muncul di konten topik tsb?
STOP = {"di", "dan", "yang", "untuk", "saat", "akibat", "oleh", "dari", "pada", "dengan", "the", "a"}
def tokens(label):
    return [w.strip(".,:;()") for w in label.lower().split()
            if len(w.strip(".,:;()")) > 3 and w.strip(".,:;()") not in STOP]

konteks_by_id = {r["topic_id"].strip(): r for r in konteks}
skor_list = []
for r in gab:
    tid = r["topic_id"].strip()
    baru = r.get("topic_label_baru", "").strip()
    k = konteks_by_id.get(tid)
    if not k or not baru:
        continue
    docs = (k.get("contoh_dokumen", "") + " " + k.get("kata_kunci", "")).lower()
    toks = tokens(baru)
    if not toks:
        continue
    hit = sum(1 for t in toks if t in docs)
    skor_list.append((tid, hit / len(toks), baru[:48]))

rendah = [s for s in skor_list if s[1] < 0.34]
print(f"topik dengan skor kecocokan label_baru-vs-konten-topik RENDAH (<0.34): {len(rendah)}/{len(skor_list)}")
for tid, s, lbl in rendah[:30]:
    print(f"   topic {tid:>3} skor={s:.2f} label='{lbl}'")
sedang = [s for s in skor_list if 0.34 <= s[1] < 0.67]
print(f"skor SEDANG (0.34-0.66): {len(sedang)}")
tinggi = [s for s in skor_list if s[1] >= 0.67]
print(f"skor TINGGI (>=0.67)  : {len(tinggi)}")
for tid, s, lbl in tinggi[:15]:
    print(f"   topic {tid:>3} skor={s:.2f} label='{lbl}'")

print()
print("=" * 78)
print("7. JUMLAH DOKUMEN PER TOPIK (ringkasan) — untuk cek konsistensi konteks_label")
print("=" * 78)
n_konteks_cocok = 0
for r in konteks:
    tid = r["topic_id"].strip()
    jd = r.get("jumlah_dokumen", "").strip()
    dc = ring_by_id.get(tid, {}).get("document_count", "").strip()
    if jd == dc:
        n_konteks_cocok += 1
print(f"konteks_label.jumlah_dokumen == ringkasan.document_count: {n_konteks_cocok}/{len(konteks)}")

print()
print("=" * 78)
print("8. LINEAGE: apakah gabungan.awal berasal dari run 'uji' atau run lama lain?")
print("=" * 78)
uji_ring = load_csv(f"{BASE}/../uji/ringkasan_topik.csv")
uji_label_to_id = {r["topic_label"].strip(): r["topic_id"].strip() for r in uji_ring}
n_uji = 0
for r in gab:
    if r.get("topic_label_awal", "").strip() in uji_label_to_id:
        n_uji += 1
print(f"gabungan.awal ditemukan sebagai topic_label di run UJI: {n_uji}/{len(gab)}")

# konteks_label.awal vs ringkasan.topic_label (apakah konteks selaras run penuh?)
n_k = sum(1 for r in konteks if r.get("topic_label_awal", "").strip() == ring_by_id.get(r["topic_id"].strip(), {}).get("topic_label", "").strip())
print(f"konteks_label.awal == ringkasan.topic_label (per topic_id): {n_k}/{len(konteks)}")

print()
print("=" * 78)
print("9. DETAIL VERIFIKASI MANUAL — 5 topik teratas: konten penuh vs label gabungan")
print("=" * 78)
for tid in ["0", "1", "2", "3", "4"]:
    g = next(r for r in gab if r["topic_id"].strip() == tid)
    rk = ring_by_id[tid]
    k = konteks_by_id[tid]
    print(f"--- topic {tid} ({rk['document_count']} dok) ---")
    print(f"  keywords run penuh      : {rk['topic_keywords'][:100]}")
    print(f"  contoh dokumen (penuh)  : {k['contoh_dokumen'][:100]}")
    print(f"  gabungan.awal           : {g['topic_label_awal']}")
    print(f"  gabungan.baru (label)   : {g['topic_label_baru']}")
print()
print("AUDIT SELESAI — read-only, tidak ada file diubah.")
