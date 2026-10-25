import { SiteShell } from "@/components/site-shell";
import { getAggregates, getTopics } from "@/lib/app-data";

/**
 * Halaman utama (server component) — memuat data agregat & topik dari hasil
 * pemodelan BERTopic (mode penuh), lalu merender shell navigasi 4 menu:
 * Beranda | Filter Topik dan Persebaran | Chatbot | Tentang Proyek.
 */
export default function Page() {
  const aggregates = getAggregates();
  const topics = getTopics();

  return <SiteShell aggregates={aggregates} topics={topics} />;
}
