/**
 * llm.ts — Lapisan pemanggilan LLM untuk chatbot (server-only).
 *
 * Dua penyedia, dipilih otomatis lewat environment variable:
 * 1. GEMINI_API_KEY terpasang  -> Google Gemini (REST API, tanpa dependensi
 *    tambahan). Dipakai di hosting eksternal seperti Vercel: buat API key
 *    gratis di https://aistudio.google.com/apikey lalu pasang sebagai env var.
 * 2. Tanpa GEMINI_API_KEY      -> z-ai-web-dev-sdk (dipakai di lingkungan
 *    Z.ai yang menyediakan kredensial otomatis).
 *
 * MODEL BAWAAN: gemini-3.5-flash-lite (stabil, direkomendasikan Google untuk
 * proyek baru per docs.ai.google.dev Oktober 2026). HINDARI memakai
 * gemini-2.0-flash / gemini-2.5-flash — keduanya sudah dipensiunkan/dibatasi
 * Google (2.0-flash mati 1 Juni 2026; 2.5 dibatasi & terjadwal mati Okt 2026).
 * Ganti model lewat env GEMINI_MODEL tanpa mengubah kode.
 *
 * Kedua jalur menghasilkan teks jawaban dengan perilaku identik; pembatasan
 * topik, konteks dataset, dan system prompt ditangani di route — modul ini
 * HANYA meneruskan percakapan ke model. Tetap TANPA RAG / tanpa web search.
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message?: string; status?: string };
}

/**
 * Panggil LLM: kembalikan teks jawaban (sudah di-trim, bisa string kosong
 * bila model menjawab kosong). Melempar Error dengan pola pesan yang sudah
 * dipetakan oleh route.ts (TIMEOUT / rate limit / umum).
 */
export async function chatComplete(
  systemPrompt: string,
  history: ChatTurn[],
  timeoutMs: number,
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return geminiComplete(geminiKey, systemPrompt, history, timeoutMs);
  }
  return zaiComplete(systemPrompt, history, timeoutMs);
}

/* ---------------------------- Google Gemini ---------------------------- */

async function geminiComplete(
  apiKey: string,
  systemPrompt: string,
  history: ChatTurn[],
  timeoutMs: number,
): Promise<string> {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  // PENTING: jangan pernah mencatat URL (memuat ?key=...) atau apiKey ke log.
  const url = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: history.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    });

    const data = (await res.json().catch(() => ({}))) as GeminiResponse;

    if (!res.ok) {
      const apiMsg = data.error?.message ?? `HTTP ${res.status}`;
      console.error(
        `[llm/gemini] gagal — status: ${res.status}, model: ${model}, pesan: ${apiMsg}`,
      );

      // Klasifikasi untuk log pemilik situs (pesan ke pengguna tetap generik).
      if (
        res.status === 400 ||
        res.status === 401 ||
        res.status === 403 ||
        /api key not valid|api_key_invalid/i.test(apiMsg)
      ) {
        throw new Error(
          "GEMINI_AUTH: API key ditolak Google. Periksa GEMINI_API_KEY pada " +
            "Environment Variables (Production) di Vercel, lalu deploy ulang.",
        );
      }
      if (res.status === 404 || /not found|not supported/i.test(apiMsg)) {
        throw new Error(
          `GEMINI_MODEL: model "${model}" tidak tersedia untuk API key ini. ` +
            "Set GEMINI_MODEL ke model aktif (mis. gemini-3.5-flash-lite atau gemini-3.8-flash).",
        );
      }
      const throttled =
        res.status === 429 ||
        /rate|quota|resource_exhausted/i.test(apiMsg);
      throw new Error(
        throttled
          ? `rate limit: ${apiMsg}`
          : `Gemini API error: ${apiMsg}`,
      );
    }

    return (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("TIMEOUT");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------- z-ai-web-dev-sdk --------------------------- */

async function zaiComplete(
  systemPrompt: string,
  history: ChatTurn[],
  timeoutMs: number,
): Promise<string> {
  let zai;
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    zai = await ZAI.create();
  } catch (err) {
    console.error(
      "[llm] tidak ada penyedia LLM yang tersedia: GEMINI_API_KEY tidak " +
        "terpasang dan kredensial z-ai-web-dev-sdk tidak ditemukan di environment.",
      err instanceof Error ? err.message : err,
    );
    throw new Error("CHAT_PROVIDER_UNAVAILABLE");
  }

  const completion = (await Promise.race([
    zai.chat.completions.create({
      messages: [{ role: "assistant", content: systemPrompt }, ...history],
      thinking: { type: "disabled" },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs),
    ),
  ])) as { choices?: Array<{ message?: { content?: string } }> };

  return completion.choices?.[0]?.message?.content?.trim() ?? "";
}
