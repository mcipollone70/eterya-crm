import "server-only";

import { getOpenAiApiKey, isOpenAiTtsConfigured } from "./openai-tts-env";

const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const JOY_STT_MODEL = "whisper-1";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export type OpenAiSttResult =
  | { ok: true; text: string; model: string }
  | {
      ok: false;
      reason: "not_configured" | "empty" | "too_large" | "upstream" | "invalid";
      message: string;
    };

export function isOpenAiSttConfigured(): boolean {
  return isOpenAiTtsConfigured();
}

/**
 * Transcribe audio via OpenAI Whisper. Audio is held only in memory for this request.
 * Never log the API key or raw audio bytes.
 */
export async function transcribeItalianAudio(
  audio: Blob | Buffer | ArrayBuffer,
  filename: string,
  mimeType: string
): Promise<OpenAiSttResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      reason: "not_configured",
      message: "OPENAI_API_KEY non configurata.",
    };
  }

  let buffer: Buffer;
  if (Buffer.isBuffer(audio)) {
    buffer = audio;
  } else if (audio instanceof ArrayBuffer) {
    buffer = Buffer.from(audio);
  } else {
    buffer = Buffer.from(await audio.arrayBuffer());
  }

  if (buffer.byteLength === 0) {
    return { ok: false, reason: "empty", message: "Audio vuoto." };
  }

  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    return {
      ok: false,
      reason: "too_large",
      message: "Audio troppo grande (max 25 MB).",
    };
  }

  const safeName = filename.replace(/[^\w.-]+/g, "_").slice(0, 80) || "audio.webm";
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], {
      type: mimeType || "application/octet-stream",
    }),
    safeName
  );
  form.append("model", JOY_STT_MODEL);
  form.append("language", "it");
  form.append("response_format", "json");

  try {
    const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      // Do not log response body (may contain upstream details); size only.
      console.info("[joy-stt] upstream", {
        status: response.status,
        bytes: buffer.byteLength,
        mime: mimeType.slice(0, 40),
      });
      return {
        ok: false,
        reason: "upstream",
        message: `Trascrizione non riuscita (HTTP ${response.status}).`,
      };
    }

    const data = (await response.json()) as { text?: unknown };
    const text = typeof data.text === "string" ? data.text.trim() : "";
    if (!text) {
      return { ok: false, reason: "empty", message: "Trascrizione vuota." };
    }

    console.info("[joy-stt] ok", {
      bytes: buffer.byteLength,
      mime: mimeType.slice(0, 40),
      chars: text.length,
      model: JOY_STT_MODEL,
    });

    return { ok: true, text, model: JOY_STT_MODEL };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 120) : "Errore di rete STT.";
    console.info("[joy-stt] network", { message, bytes: buffer.byteLength });
    return { ok: false, reason: "upstream", message };
  }
}
