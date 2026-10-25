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
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
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
      // Petakan ke pola pesan yang dikenali route.ts (429 dsb.)
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
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

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
