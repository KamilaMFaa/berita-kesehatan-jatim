/**
 * app-types.ts — Tipe & konstanta yang AMAN dipakai di client maupun server.
 * (app-data.ts yang memakai fs hanya boleh diimpor dari server components/API.)
 */

export interface RepresentativeDoc {
  kutipan: string;
  tanggal: string;
  wilayah: string;
  penerbit: string;
}

export interface TopicItem {
  id: number;
  label: string;
  keywords: string[];
  count: number;
  percentage: number;
  representatives: RepresentativeDoc[];
}

export interface AggregateData {
  labelSource: {
    file: string;
    kolom: string;
    kunciGabung: string;
    jumlahTopik: number;
    revisiBelumVerifikasi: number;
  };
  totalArticles: number;
  nTopics: number;
  outlierCount: number;
  outlierPct: number;
  regionUncertainCount: number;
  dateMin: string | null;
  dateMax: string | null;
  nPublishers: number;
  nRegions: number;
  issueGroups: { key: string; label: string; count: number }[];
  regions: { name: string; count: number }[];
  monthlyTotal: { periode: string; jumlah: number }[];
  yearlyTotal: { tahun: number; jumlah: number }[];
  regionTopTopics: {
    region: string;
    count: number;
    topics: { topicId: number; label: string; count: number }[];
  }[];
  topDominant: {
    peringkat: number;
    topicId: number;
    label: string;
    count: number;
    persen: number;
  }[];
  evaluation: Record<string, { nilai: string | null; catatan: string }>;
  topTopics: { id: number; label: string; count: number; percentage: number }[];
}

export const ISSUE_GROUP_LABELS: Record<string, string> = {
  sampah: "Sampah & Pengelolaan Limbah",
  banjir_genangan: "Banjir & Genangan",
  air_bersih: "Air Bersih",
  limbah_pencemaran: "Limbah & Pencemaran",
  sanitasi_kebersihan: "Sanitasi & Kebersihan",
  bau_pencemaran_udara: "Bau & Pencemaran Udara",
  kesehatan_lingkungan_umum: "Kesehatan Lingkungan Umum",
};
