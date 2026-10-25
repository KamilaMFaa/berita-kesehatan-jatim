/** Utilitas format tampilan (id-ID). */

const nf = new Intl.NumberFormat("id-ID");

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return nf.format(n);
}

const MONTHS_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** "2025-11-26" -> "26 Nov 2025" (apa adanya dari dataset, tanpa konversi zona waktu). */
export function fmtTanggal(iso: string | null | undefined): string {
  if (!iso) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const mi = parseInt(mo, 10) - 1;
  if (mi < 0 || mi > 11) return iso;
  return `${d} ${MONTHS_ID[mi]} ${y}`;
}

/** "2025-11" -> "Nov 2025" */
export function fmtBulan(periode: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!m) return periode;
  const mi = parseInt(m[2], 10) - 1;
  if (mi < 0 || mi > 11) return periode;
  return `${MONTHS_ID[mi]} ${m[1]}`;
}
