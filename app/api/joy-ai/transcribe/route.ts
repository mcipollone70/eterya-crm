import { getCurrentUser } from "@/features/auth/session";
import {
  isOpenAiSttConfigured,
  transcribeItalianAudio,
} from "@/lib/voice/openai-stt.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["audio/", "video/webm", "application/octet-stream"];

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

function json(
  body: Record<string, unknown>,
  status: number
): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

function isAllowedMime(mime: string): boolean {
  const lower = mime.toLowerCase().trim();
  if (!lower) return true;
  return ALLOWED_MIME_PREFIXES.some(
    (prefix) => lower === prefix || lower.startsWith(prefix)
  );
}

/**
 * POST /api/joy-ai/transcribe
 * multipart field `audio` (or `file`) → OpenAI Whisper Italian → { ok, text }.
 * No permanent storage. OPENAI_API_KEY never logged or returned.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    console.info("[joy-ai/transcribe] diag", { httpStatus: 401, error: "auth" });
    return json({ ok: false, error: "Non autenticato", code: "auth" }, 401);
  }

  if (!isOpenAiSttConfigured()) {
    console.info("[joy-ai/transcribe] diag", {
      httpStatus: 503,
      error: "not_configured",
    });
    return json(
      {
        ok: false,
        error: "Trascrizione non configurata sul server.",
        code: "not_configured",
      },
      503
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    console.info("[joy-ai/transcribe] diag", {
      httpStatus: 400,
      error: "invalid_form",
    });
    return json({ ok: false, error: "Richiesta non valida", code: "invalid" }, 400);
  }

  const fileEntry = form.get("audio") ?? form.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    console.info("[joy-ai/transcribe] diag", {
      httpStatus: 400,
      error: "missing_audio",
    });
    return json(
      { ok: false, error: "Campo audio mancante", code: "missing_audio" },
      400
    );
  }

  const file = fileEntry as File;
  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedMime(mimeType)) {
    console.info("[joy-ai/transcribe] diag", {
      httpStatus: 400,
      error: "bad_mime",
      mime: mimeType.slice(0, 40),
    });
    return json(
      { ok: false, error: "Formato audio non supportato", code: "bad_mime" },
      400
    );
  }

  if (typeof file.size === "number" && file.size > MAX_UPLOAD_BYTES) {
    console.info("[joy-ai/transcribe] diag", {
      httpStatus: 400,
      error: "too_large",
      bytes: file.size,
    });
    return json(
      { ok: false, error: "Audio troppo grande", code: "too_large" },
      400
    );
  }

  if (typeof file.size === "number" && file.size < 64) {
    console.info("[joy-ai/transcribe] diag", {
      httpStatus: 400,
      error: "empty",
      bytes: file.size,
    });
    return json(
      { ok: false, error: "Non ho ricevuto audio.", code: "empty" },
      400
    );
  }

  const filename =
    (typeof file.name === "string" && file.name) || "joy-voice.webm";

  const result = await transcribeItalianAudio(file, filename, mimeType);

  if (!result.ok) {
    const status =
      result.reason === "not_configured"
        ? 503
        : result.reason === "empty" || result.reason === "too_large"
          ? 400
          : 502;
    console.info("[joy-ai/transcribe] diag", {
      httpStatus: status,
      error: result.reason,
      bytes: file.size,
    });
    return json(
      {
        ok: false,
        error: result.message,
        code: result.reason,
      },
      status
    );
  }

  console.info("[joy-ai/transcribe] diag", {
    httpStatus: 200,
    chars: result.text.length,
    bytes: file.size,
    model: result.model,
  });

  return json({ ok: true, text: result.text }, 200);
}
