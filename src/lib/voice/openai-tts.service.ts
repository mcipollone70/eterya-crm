import "server-only";

import { createHash } from "node:crypto";
import {
  JOY_TTS_API_MAX_CHARS,
  JOY_TTS_MODEL,
  JOY_TTS_PROVIDER,
  JOY_VOICE_PROFILE,
  isJoyTtsVoiceId,
  type JoyTtsVoiceId,
} from "./joy-voice-profile";
import { getOpenAiApiKey, isOpenAiTtsConfigured } from "./openai-tts-env";
import { sanitizeSpokenText } from "./spoken-text";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 24;

interface CacheEntry {
  buffer: Buffer;
  expiresAt: number;
  contentType: string;
}

const ttsCache = new Map<string, CacheEntry>();

export type OpenAiTtsResult =
  | {
      ok: true;
      buffer: Buffer;
      contentType: string;
      cached: boolean;
      text: string;
      provider: typeof JOY_TTS_PROVIDER;
      model: typeof JOY_TTS_MODEL;
      voice: JoyTtsVoiceId;
    }
  | {
      ok: false;
      reason: "not_configured" | "empty" | "upstream" | "too_long";
      message: string;
    };

function pruneCache(now: number): void {
  for (const [key, entry] of ttsCache) {
    if (entry.expiresAt <= now) {
      ttsCache.delete(key);
    }
  }
  while (ttsCache.size > CACHE_MAX_ENTRIES) {
    const oldest = ttsCache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    ttsCache.delete(oldest);
  }
}

function cacheKey(text: string, voice: string): string {
  const { model } = JOY_VOICE_PROFILE.openai;
  return createHash("sha256")
    .update(`${model}|${voice}|${JOY_VOICE_PROFILE.id}|${text}`)
    .digest("hex");
}

export interface SynthesizeJoySpeechOptions {
  /** Solo pannello confronto voci — default = JOY_TTS_VOICE. */
  voice?: JoyTtsVoiceId;
}

/**
 * Genera un unico buffer MP3 via OpenAI TTS.
 * Una richiesta = un file audio continuo (mai chunk multipli).
 */
export async function synthesizeJoySpeech(
  rawText: string,
  options?: SynthesizeJoySpeechOptions
): Promise<OpenAiTtsResult> {
  if (!isOpenAiTtsConfigured()) {
    return {
      ok: false,
      reason: "not_configured",
      message: "OPENAI_API_KEY non configurata.",
    };
  }

  const text = sanitizeSpokenText(rawText, JOY_TTS_API_MAX_CHARS);
  if (!text) {
    return { ok: false, reason: "empty", message: "Testo vuoto dopo pulizia." };
  }

  if (text.length > JOY_TTS_API_MAX_CHARS) {
    return {
      ok: false,
      reason: "too_long",
      message: `Testo troppo lungo (max ${JOY_TTS_API_MAX_CHARS} caratteri).`,
    };
  }

  const voice: JoyTtsVoiceId =
    options?.voice && isJoyTtsVoiceId(options.voice)
      ? options.voice
      : JOY_VOICE_PROFILE.openai.voice;

  const now = Date.now();
  pruneCache(now);
  const key = cacheKey(text, voice);
  const hit = ttsCache.get(key);
  if (hit && hit.expiresAt > now) {
    return {
      ok: true,
      buffer: hit.buffer,
      contentType: hit.contentType,
      cached: true,
      text,
      provider: JOY_TTS_PROVIDER,
      model: JOY_TTS_MODEL,
      voice,
    };
  }

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      reason: "not_configured",
      message: "OPENAI_API_KEY non configurata.",
    };
  }

  const { model, responseFormat } = JOY_VOICE_PROFILE.openai;

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        instructions: JOY_VOICE_PROFILE.semanticDescription,
        response_format: responseFormat,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        reason: "upstream",
        message: `OpenAI TTS errore ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "audio/mpeg";

    ttsCache.set(key, {
      buffer,
      contentType,
      expiresAt: now + CACHE_TTL_MS,
    });
    pruneCache(Date.now());

    return {
      ok: true,
      buffer,
      contentType,
      cached: false,
      text,
      provider: JOY_TTS_PROVIDER,
      model: JOY_TTS_MODEL,
      voice,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore di rete verso OpenAI TTS.";
    return { ok: false, reason: "upstream", message };
  }
}
