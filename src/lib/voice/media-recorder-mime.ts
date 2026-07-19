/** Preferred MediaRecorder MIME types for iPhone Safari + Chrome. */

export const JOY_RECORDER_MIME_CANDIDATES = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
] as const;

export type JoyRecorderMime = (typeof JOY_RECORDER_MIME_CANDIDATES)[number] | "";

/**
 * Pick the first MIME type supported by MediaRecorder.
 * Pass `isTypeSupported` for testability (defaults to MediaRecorder.isTypeSupported).
 */
export function pickMediaRecorderMime(
  isTypeSupported: (mime: string) => boolean = defaultIsTypeSupported
): JoyRecorderMime {
  for (const mime of JOY_RECORDER_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(mime)) {
        return mime;
      }
    } catch {
      // ignore unsupported probe errors
    }
  }
  return "";
}

function defaultIsTypeSupported(mime: string): boolean {
  if (typeof MediaRecorder === "undefined") {
    return false;
  }
  return MediaRecorder.isTypeSupported(mime);
}

/** Extension / filename hint for OpenAI multipart upload. */
export function extensionForMime(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "audio/mp4" || base === "audio/m4a" || base === "audio/aac") {
    return "m4a";
  }
  if (base === "audio/mpeg" || base === "audio/mp3") {
    return "mp3";
  }
  if (base === "audio/wav" || base === "audio/wave") {
    return "wav";
  }
  if (base.includes("webm")) {
    return "webm";
  }
  if (base.includes("ogg")) {
    return "ogg";
  }
  return "webm";
}

/** True when we should prefer MediaRecorder + server STT over Web Speech. */
export function preferServerSttCapture(ua = "", standalone = false): boolean {
  const lower = ua.toLowerCase();
  const isIos =
    /iphone|ipod|ipad/.test(lower) ||
    // iPadOS 13+ desktop UA
    (lower.includes("macintosh") && standalone);
  const isSafariIos =
    isIos ||
    (/safari/.test(lower) && /mobile/.test(lower) && !/chrome|crios|fxios/.test(lower));
  return Boolean(isIos || isSafariIos || standalone);
}

export const JOY_VOICE_MAX_MS = 30_000;
export const JOY_VOICE_MIN_BLOB_BYTES = 256;
