/**
 * app-data.ts — Loader data agregat & topik (HANYA server-side: page.tsx / API).
 * Data bersumber dari file JSON hasil preprocessing CSV SBERT-BERTopic (scripts/prepare_data.py).
 * Tidak ada angka yang dikarang; semuanya dihitung dari hasil pemodelan peneliti.
 *
 * Pembacaan: utama lewat fs (mode Node/standalone). Bila fs gagal (mis. bundling
 * serverless di Vercel), jatuh ke salinan statis yang di-bundle bersama modul —
 * isi keduanya identik, bersumber dari data/*.json yang sama.
 */
import { readFileSync } from "fs";
import path from "path";
import type { AggregateData, TopicItem } from "@/lib/app-types";

export type { AggregateData, TopicItem } from "@/lib/app-types";

import topicsFallback from "../../data/topics.json";
import aggregatesFallback from "../../data/aggregates.json";

let _topics: TopicItem[] | null = null;
let _aggregates: AggregateData | null = null;

export function getTopics(): TopicItem[] {
  if (!_topics) {
    try {
      const p = path.join(process.cwd(), "data", "topics.json");
      _topics = JSON.parse(readFileSync(p, "utf-8")) as TopicItem[];
    } catch {
      _topics = topicsFallback as TopicItem[];
    }
  }
  return _topics;
}

export function getAggregates(): AggregateData {
  if (!_aggregates) {
    try {
      const p = path.join(process.cwd(), "data", "aggregates.json");
      _aggregates = JSON.parse(readFileSync(p, "utf-8")) as AggregateData;
    } catch {
      _aggregates = aggregatesFallback as AggregateData;
    }
  }
  return _aggregates;
}
