#!/usr/bin/env python3
"""
make_turso_dump.py — Buat dump SQL dari db/custom.db untuk diimpor ke Turso.

Pemakaian (dari akar proyek):
    python3 scripts/make_turso_dump.py

Hasil: db/turso_dump.sql — diimpor dengan:
    turso db shell <NAMA_DB> < db/turso_dump.sql

Hasil dump diverifikasi otomatis: dimuat ulang ke SQLite sementara dan
jumlah baris Article harus 25.022.
"""
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "db" / "custom.db"
OUT = ROOT / "db" / "turso_dump.sql"

EXPECTED = 25_022


def main() -> int:
    if not SRC.exists():
        print(f"ERROR: {SRC} tidak ditemukan. Jalankan seed dahulu.")
        return 1

    print(f"Membuat dump dari {SRC.name} ...")
    src = sqlite3.connect(str(SRC))
    statements = list(src.iterdump())
    src.close()

    with OUT.open("w", encoding="utf-8") as f:
        for line in statements:
            f.write(line + "\n")
    size_mb = OUT.stat().st_size / 1_048_576
    print(f"Dump ditulis: {OUT} ({size_mb:.1f} MB, {len(statements)} pernyataan)")

    # Verifikasi: muat ulang dump ke database sementara
    print("Verifikasi: memuat ulang dump ke SQLite sementara ...")
    tmp = sqlite3.connect(":memory:")
    with OUT.open("r", encoding="utf-8") as f:
        tmp.executescript(f.read())
    (n,) = tmp.execute("SELECT COUNT(*) FROM Article").fetchone()
    tmp.close()

    if n != EXPECTED:
        print(f"GAGAL: jumlah baris {n}, seharusnya {EXPECTED}")
        return 1

    print(f"OK: {n} baris Article — dump valid untuk diimpor ke Turso.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
