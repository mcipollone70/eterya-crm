import { getCurrentUser } from "@/features/auth/session";
import { synthesizeJoySpeech } from "@/lib/voice/openai-tts.service";
import { isOpenAiTtsConfigured } from "@/lib/voice/openai-tts-env";
import {
  JOY_TTS_API_MAX_CHARS,
  JOY_TTS_MODEL,
  JOY_TTS_PROVIDER,
  JOY_TTS_VOICE,
  isJoyTtsVoiceId,
  type JoyTtsVoiceId,
} from "@/lib/voice/joy-voice-profile";

interface TtsRequestBody {
  text?: string;
  /** Solo pannello confronto voci. */
  voice?: string;
}

function parseVoiceOverride(value: string | undefined): JoyTtsVoiceId | undefined {
  if (!value) return undefined;
  return isJoyTtsVoiceId(value) ? value : undefined;
}

/**
 * POST /api/joy-ai/tts
 * OpenAI TTS server-side — OPENAI_API_KEY mai esposta al client.
 * Una risposta = un solo body audio (MP3 continuo).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    console.info("[joy-ai/tts] diag", {
      voice: null,
      model: JOY_TTS_MODEL,
      httpStatus: 401,
      contentType: "application/json",
      bytes: 0,
      error: "Non autenticato",
    });
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (!isOpenAiTtsConfigured()) {
    const error =
      "OPENAI_API_KEY non configurata. Il test delle voci non può funzionare.";
    console.info("[joy-ai/tts] diag", {
      voice: null,
      model: JOY_TTS_MODEL,
      httpStatus: 503,
      contentType: "application/json",
      bytes: 0,
      error,
    });
    return Response.json(
      {
        error,
        fallback: false,
        message: error,
      },
      { status: 503 }
    );
  }

  let body: TtsRequestBody;
  try {
    body = (await request.json()) as TtsRequestBody;
  } catch {
    console.info("[joy-ai/tts] diag", {
      voice: null,
      model: JOY_TTS_MODEL,
      httpStatus: 400,
      contentType: "application/json",
      bytes: 0,
      error: "Richiesta non valida",
    });
    return Response.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    console.info("[joy-ai/tts] diag", {
      voice: body.voice ?? null,
      model: JOY_TTS_MODEL,
      httpStatus: 400,
      contentType: "application/json",
      bytes: 0,
      error: "Testo vuoto",
    });
    return Response.json({ error: "Testo vuoto" }, { status: 400 });
  }

  if (text.length > JOY_TTS_API_MAX_CHARS * 2) {
    const error = `Testo troppo lungo (max ${JOY_TTS_API_MAX_CHARS} caratteri utili).`;
    console.info("[joy-ai/tts] diag", {
      voice: body.voice ?? null,
      model: JOY_TTS_MODEL,
      httpStatus: 400,
      contentType: "application/json",
      bytes: 0,
      error,
    });
    return Response.json(
      {
        error,
        fallback: false,
      },
      { status: 400 }
    );
  }

  const voice = parseVoiceOverride(
    typeof body.voice === "string" ? body.voice : undefined
  );
  const result = await synthesizeJoySpeech(text, voice ? { voice } : undefined);
  if (!result.ok) {
    const status =
      result.reason === "not_configured"
        ? 503
        : result.reason === "empty" || result.reason === "too_long"
          ? 400
          : 502;
    const error =
      result.reason === "not_configured"
        ? "OPENAI_API_KEY non configurata. Il test delle voci non può funzionare."
        : result.message;
    console.info("[joy-ai/tts] diag", {
      voice: voice ?? JOY_TTS_VOICE,
      model: JOY_TTS_MODEL,
      httpStatus: status,
      contentType: "application/json",
      bytes: 0,
      error,
    });
    return Response.json(
      {
        error,
        fallback: false,
        message: error,
      },
      { status }
    );
  }

  console.info("[joy-ai/tts] diag", {
    voice: result.voice,
    model: result.model,
    httpStatus: 200,
    contentType: result.contentType,
    bytes: result.buffer.byteLength,
    cached: result.cached,
    error: null,
  });

  return new Response(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "X-Joy-TTS-Cached": result.cached ? "1" : "0",
      "X-Joy-TTS-Chars": String(result.text.length),
      "X-Joy-TTS-Provider": result.provider,
      "X-Joy-TTS-Model": result.model,
      "X-Joy-TTS-Voice": result.voice,
      "X-Joy-TTS-Fallback": "0",
      "X-Joy-TTS-Bytes": String(result.buffer.byteLength),
      "X-Joy-TTS-Default-Voice": JOY_TTS_VOICE,
      "X-Joy-TTS-Engine": `${JOY_TTS_PROVIDER}/${JOY_TTS_MODEL}`,
    },
  });
}
