"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Eraser, MessageCircleHeart, TriangleAlert, Bot, User, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  /** Jawaban berita yang disusun dari konteks dataset (query terstruktur, bukan RAG) */
  grounded?: boolean;
  contextCount?: number;
  /** Jawaban penolakan di luar cakupan (tidak dikirim ulang ke model) */
  outOfScope?: boolean;
}

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Selamat datang! Saya asisten eksplorasi website penelitian ini dengan cakupan TERBATAS:\n\n• Menjelaskan istilah & konsep kesehatan masyarakat dan lingkungan — mis. sanitasi, stunting, imunisasi, gizi, sampah, banjir, pencemaran air.\n• Menjawab pertanyaan berita dari dataset proyek — mis. \"Apa berita kesehatan terkini di Bangkalan?\" (dijawab dari berita terbaru yang tersedia di dataset, dengan tanggal publikasinya).\n\nCatatan: saya TIDAK terhubung ke internet dan TIDAK menggunakan RAG/pencarian — jawaban berita murni dari dataset proyek (25.022 berita, s.d. 18 Okt 2026), dan pertanyaan di luar cakupan kesehatan/lingkungan akan saya tolak dengan sopan.",
};

const CONTOH_PERTANYAAN = [
  "Apa berita kesehatan terkini di Bangkalan?",
  "Apa itu stunting dan mengapa penting?",
  "Bagaimana banjir bisa memengaruhi kesehatan masyarakat?",
  "Jelaskan perbedaan TPS, TPA, dan TPS 3R",
];

const MAX_MSGS_SENT = 16;

export function ChatbotView() {
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastFailedUserMsg, setLastFailedUserMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    // Pesan error DAN penolakan out-of-scope tidak dikirim ulang ke model:
    // model hanya melihat percakapan yang benar-benar berada dalam cakupan.
    const history = [
      ...messages.filter((m) => !m.isError && !m.outOfScope),
      userMsg,
    ];
    setMessages(history);
    setInput("");
    setLoading(true);
    setLastFailedUserMsg(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((m) => m !== WELCOME)
            .slice(-MAX_MSGS_SENT)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.reply) {
        const errMsg: Msg = {
          role: "assistant",
          content:
            json.error ||
            "Terjadi kendala saat memproses pertanyaan. Silakan coba lagi.",
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
        setLastFailedUserMsg(trimmed);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: json.reply,
            grounded: Boolean(json.grounded),
            contextCount: json.contextCount,
            outOfScope: Boolean(json.outOfScope),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Tidak dapat terhubung ke layanan chatbot. Periksa koneksi internet Anda lalu coba lagi.",
          isError: true,
        },
      ]);
      setLastFailedUserMsg(trimmed);
    } finally {
      setLoading(false);
      taRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([WELCOME]);
    setLastFailedUserMsg(null);
    setInput("");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-4">
      <header>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <MessageCircleHeart className="h-6 w-6 text-primary" aria-hidden="true" />
          Chatbot
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Asisten berbasis Large Language Model (LLM) dengan cakupan kesehatan masyarakat,
          kesehatan lingkungan, dan berita dalam dataset proyek. Pertanyaan di luar cakupan
          ditolak otomatis sebelum mencapai model.
        </p>
      </header>

      {/* Disclaimer batasan */}
      <Card className="border-amber-200 bg-accent/40">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
            <p>
              <b className="text-foreground">Batasan penting:</b> Chatbot ini <b>tidak</b>{" "}
              menggunakan RAG/vector database maupun pencarian internet. Penjelasan kesehatan
              bersifat pengetahuan umum; pertanyaan di luar cakupan kesehatan &amp; lingkungan
              ditolak otomatis (divalidasi sebelum diproses model).
            </p>
            <p>
              <b className="text-foreground">Pertanyaan berita terkini</b> dijawab dari dataset
              proyek melalui filter terstruktur (wilayah/kata kunci/tanggal publikasi — bukan
              retrieval semantik): jawaban mencantumkan tanggal berita dan berlaku sampai
              tanggal terbaru yang tersedia di dataset (18 Okt 2026), bukan berita real-time.
            </p>
            <p>
              Penjelasan kesehatan <b>bukan</b> diagnosis atau pengganti tenaga kesehatan. Untuk
              kondisi kesehatan pribadi, silakan konsultasi ke puskesmas atau dokter.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Area percakapan */}
      <Card>
        <CardContent className="p-0">
          <div
            ref={scrollRef}
            className="h-[52vh] min-h-[360px] overflow-y-auto p-4 sm:p-5 space-y-4 scroll-smooth"
            aria-live="polite"
            aria-label="Riwayat percakapan"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" && (
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5",
                      m.isError
                        ? "bg-destructive/10 text-destructive"
                        : m.outOfScope
                          ? "bg-secondary text-muted-foreground"
                          : "bg-secondary text-primary",
                    )}
                    aria-hidden="true"
                  >
                    {m.isError ? (
                      <TriangleAlert className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : m.outOfScope
                        ? "bg-secondary/70 text-foreground border border-border rounded-bl-sm"
                        : m.isError
                          ? "bg-destructive/10 text-destructive border border-destructive/30 rounded-bl-sm"
                          : "bg-muted text-foreground rounded-bl-sm",
                  )}
                  role={m.isError ? "alert" : undefined}
                >
                  {m.content}
                  {m.grounded && (
                    <span className="block mt-2 pt-2 border-t text-[10px] text-muted-foreground">
                      Jawaban berita disusun dari {m.contextCount ?? 8} berita terbaru yang
                      tersedia di dataset proyek (bukan berita real-time).
                    </span>
                  )}
                </div>
                {m.role === "user" && (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary mt-0.5 text-muted-foreground"
                    aria-hidden="true"
                  >
                    <User className="h-4 w-4" />
                  </span>
                )}
              </div>
            ))}

            {/* Indikator proses */}
            {loading && (
              <div className="flex gap-2.5 justify-start" aria-label="Model sedang menulis jawaban">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary mt-0.5"
                  aria-hidden="true"
                >
                  <Bot className="h-4 w-4" />
                </span>
                <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Model sedang menyusun jawaban…
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Riwayat sesi info + clear */}
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground">
            <span>
              Riwayat tersimpan selama sesi halaman ini ({messages.filter((m) => !m.isError).length - 1}{" "}
              pesan).
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1 cursor-pointer"
              onClick={clearChat}
              disabled={loading}
            >
              <Eraser className="h-3 w-3" aria-hidden="true" />
              Hapus Percakapan
            </Button>
          </div>

          {/* Input */}
          <form
            className="p-3 sm:p-4 border-t flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
          >
            <Textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tulis pertanyaan Anda… (Enter kirim, Shift+Enter baris baru)"
              rows={1}
              className="min-h-[44px] max-h-32 resize-none"
              aria-label="Kolom pertanyaan"
              disabled={loading}
            />
            <Button
              type="submit"
              size="icon"
              className="h-[44px] w-[44px] shrink-0 cursor-pointer"
              disabled={loading || !input.trim()}
              aria-label="Kirim pertanyaan"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tombol coba lagi setelah error */}
      {lastFailedUserMsg && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 cursor-pointer"
            onClick={() => {
              const retry = lastFailedUserMsg;
              setLastFailedUserMsg(null);
              sendMessage(retry);
            }}
          >
            Coba kirim ulang pertanyaan terakhir
          </Button>
        </div>
      )}

      {/* Contoh pertanyaan — hanya mengisi input, BUKAN respons tiruan */}
      {messages.length <= 1 && !loading && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Contoh pertanyaan (klik untuk mengisi kolom input — jawaban akan dihasilkan oleh
            model):
          </p>
          <div className="flex flex-wrap gap-2">
            {CONTOH_PERTANYAAN.map((c) => (
              <button
                key={c}
                onClick={() => setInput(c)}
                className="rounded-full border bg-card px-3.5 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer min-h-[36px]"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
