"use client";

import { useCallback, useState } from "react";
import { Home, Compass, MessageCircleHeart, Info, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AggregateData, TopicItem } from "@/lib/app-types";
import { BerandaView } from "@/components/views/beranda-view";
import { FilterPersebaranView } from "@/components/views/eksplorasi-view";
import { ChatbotView } from "@/components/views/chatbot-view";
import { TentangView } from "@/components/views/tentang-view";

export type ViewKey = "beranda" | "eksplorasi" | "chatbot" | "tentang";

const NAV_ITEMS: { key: ViewKey; label: string; icon: React.ElementType }[] = [
  { key: "beranda", label: "Beranda", icon: Home },
  { key: "eksplorasi", label: "Filter Topik dan Persebaran", icon: Compass },
  { key: "chatbot", label: "Chatbot", icon: MessageCircleHeart },
  { key: "tentang", label: "Tentang Proyek", icon: Info },
];

export function SiteShell({
  aggregates,
  topics,
}: {
  aggregates: AggregateData;
  topics: TopicItem[];
}) {
  const [view, setView] = useState<ViewKey>("beranda");

  const goTo = useCallback((v: ViewKey) => {
    setView(v);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            <button
              onClick={() => goTo("beranda")}
              className="flex items-center gap-2.5 shrink-0 cursor-pointer"
              aria-label="Ke Beranda"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Newspaper className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm font-bold sm:text-base">
                  Berita Kesehatan Jawa Timur
                </span>
                <span className="hidden sm:block text-[11px] text-muted-foreground">
                  Eksplorasi Topik SBERT–BERTopic
                </span>
              </span>
            </button>

            {/* Navigasi 4 menu utama */}
            <nav aria-label="Navigasi utama" className="hidden md:block">
              <ul className="flex items-center gap-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = view === item.key;
                  return (
                    <li key={item.key}>
                      <button
                        onClick={() => goTo(item.key)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* Navigasi mobile */}
          <nav aria-label="Navigasi utama (ponsel)" className="md:hidden pb-2">
            <ul className="grid grid-cols-2 gap-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = view === item.key;
                return (
                  <li key={item.key}>
                    <button
                      onClick={() => goTo(item.key)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-xs font-medium transition-colors min-h-[44px]",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground bg-secondary/60 hover:bg-secondary",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      {/* ============ KONTEN ============ */}
      <main className="flex-1">
        {view === "beranda" && (
          <BerandaView aggregates={aggregates} topics={topics} goTo={goTo} />
        )}
        {view === "eksplorasi" && (
          <FilterPersebaranView aggregates={aggregates} topics={topics} />
        )}
        {view === "chatbot" && <ChatbotView />}
        {view === "tentang" && (
          <TentangView aggregates={aggregates} topics={topics} goTo={goTo} />
        )}
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="mt-auto border-t bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">
                Website Berita Kesehatan Jawa Timur
              </span>{" "}
              — media eksplorasi hasil penelitian SBERT–BERTopic.
            </p>
            <p>
              Label topik bersumber dari model, bukan ground truth. Bukan alat diagnosis
              kesehatan.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
