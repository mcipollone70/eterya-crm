/**
 * Player anteprima DEV — indipendente dalla coda Joy (`joyVoice`).
 * Solo per il pannello confronto voci / test altoparlanti.
 */

export type VoicePreviewPlaybackState =
  | "idle"
  | "preparing"
  | "playing"
  | "ended"
  | "error";

export interface VoicePreviewDiagnostics {
  volume: number;
  muted: boolean;
  playbackRate: number;
  endpointStatus: number | null;
  contentType: string | null;
  bytesReceived: number | null;
  selectedVoice: string | null;
  model: string | null;
  playbackState: VoicePreviewPlaybackState;
  detectedDurationSec: number | null;
  lastError: string | null;
  playError: string | null;
  statusLabel: string;
}

export interface VoicePreviewAttemptLog {
  voice: string;
  model: string;
  httpStatus: number | null;
  contentType: string | null;
  bytes: number | null;
  durationSec: number | null;
  error: string | null;
  at: string;
}

const TTS_ENDPOINT = "/api/joy-ai/tts";
const MISSING_KEY_MSG =
  "OPENAI_API_KEY non configurata. Il test delle voci non può funzionare.";

/** WAV 16-bit mono 440Hz ~0.35s — nessun OpenAI. */
export function buildSpeakerTestDataUri(): string {
  const sampleRate = 22050;
  const durationSec = 0.35;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.min(1, i / 400) * Math.min(1, (numSamples - i) / 800);
    const sample = Math.sin(2 * Math.PI * 880 * t) * 0.35 * envelope;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function looksLikeAudioBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  // ID3… / MP3 frame sync / RIFF / OggS / ftyp
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return true;
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return true;
  }
  if (
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53
  ) {
    return true;
  }
  return bytes.length > 256;
}

export function createVoicePreviewPlayer(onChange: (d: VoicePreviewDiagnostics) => void) {
  let audio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;
  let generation = 0;
  let unlockSrcPending = false;
  let unlockGeneration = 0;
  let diagnostics: VoicePreviewDiagnostics = {
    volume: 1,
    muted: false,
    playbackRate: 1,
    endpointStatus: null,
    contentType: null,
    bytesReceived: null,
    selectedVoice: null,
    model: null,
    playbackState: "idle",
    detectedDurationSec: null,
    lastError: null,
    playError: null,
    statusLabel: "Pronto",
  };
  const attemptLogs: VoicePreviewAttemptLog[] = [];

  const emit = () => onChange({ ...diagnostics });

  const patch = (partial: Partial<VoicePreviewDiagnostics>) => {
    diagnostics = { ...diagnostics, ...partial };
    emit();
  };

  const getAudio = (): HTMLAudioElement => {
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      if (typeof document !== "undefined") {
        audio.setAttribute("data-eterya-joy-preview", "1");
        audio.style.display = "none";
        document.body.appendChild(audio);
      }
    }
    audio.muted = false;
    audio.volume = 1;
    audio.playbackRate = 1;
    return audio;
  };

  const revokeUrl = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };

  /** WAV silenzioso — sblocca HTMLAudioElement nel gesto utente prima del fetch. */
  const SILENT_WAV =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

  const IPHONE_BLOCKED =
    "Audio bloccato da iPhone. Tocca di nuovo Ascolta.";

  /**
   * Chiama play() in modo sincrono rispetto al click, prima di qualsiasi await di rete.
   * Evita blocco autoplay sul secondo play() dopo fetch TTS.
   * Non fare pause() dopo che il src TTS è già stato impostato.
   */
  const unlockInUserGesture = () => {
    const el = getAudio();
    el.muted = false;
    el.volume = 1;
    el.playbackRate = 1;
    const unlockId = ++unlockGeneration;
    unlockSrcPending = true;
    try {
      el.src = SILENT_WAV;
      const p = el.play();
      void p
        .then(() => {
          if (unlockId !== unlockGeneration || !unlockSrcPending) return;
          try {
            el.pause();
            el.currentTime = 0;
          } catch {
            // ignore
          }
        })
        .catch(() => {
          // unlock best-effort
        });
    } catch {
      // ignore
    }
  };

  /** Ferma solo l'anteprima pannello — non tocca joyVoice. */
  const stopPreview = () => {
    generation += 1;
    unlockSrcPending = false;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.ondurationchange = null;
      try {
        audio.pause();
      } catch {
        // ignore
      }
      try {
        audio.removeAttribute("src");
        audio.load();
      } catch {
        // ignore
      }
    }
    revokeUrl();
  };

  const bindPlaybackHandlers = (el: HTMLAudioElement, gen: number) => {
    el.ondurationchange = () => {
      if (gen !== generation) return;
      if (Number.isFinite(el.duration) && el.duration > 0) {
        patch({
          detectedDurationSec: Math.round(el.duration * 10) / 10,
        });
      }
    };
    el.onended = () => {
      if (gen !== generation) return;
      patch({
        playbackState: "ended",
        statusLabel: "Terminata",
      });
    };
    el.onerror = () => {
      if (gen !== generation) return;
      const msg = "Decodifica / riproduzione audio fallita.";
      patch({
        playbackState: "error",
        statusLabel: `Errore: ${msg}`,
        lastError: msg,
        playError: msg,
      });
    };
  };

  const playCurrent = async (gen: number): Promise<void> => {
    const el = getAudio();
    el.muted = false;
    el.volume = 1;
    el.playbackRate = 1;
    patch({
      volume: el.volume,
      muted: el.muted,
      playbackRate: el.playbackRate,
      playbackState: "playing",
      statusLabel: "Riproduzione…",
      playError: null,
    });
    try {
      await el.play();
      if (gen !== generation) return;
      patch({
        volume: el.volume,
        muted: el.muted,
        playbackRate: el.playbackRate,
        playbackState: "playing",
        statusLabel: "Riproduzione…",
        playError: null,
      });
    } catch (err) {
      if (gen !== generation) return;
      const name = err instanceof Error ? err.name : "";
      const msg =
        name === "NotAllowedError" || name === "AbortError"
          ? IPHONE_BLOCKED
          : err instanceof Error
            ? err.message
            : "audio.play() rejected (autoplay / policy).";
      patch({
        playbackState: "error",
        statusLabel: `Errore: ${msg}`,
        lastError: msg,
        playError: msg,
      });
    }
  };

  const pushLog = (entry: VoicePreviewAttemptLog) => {
    attemptLogs.unshift(entry);
    if (attemptLogs.length > 12) attemptLogs.pop();
  };

  return {
    getDiagnostics: () => ({ ...diagnostics }),
    getAttemptLogs: () => [...attemptLogs],
    stopPreview,

    /** Beep locale — distingue player vs TTS. */
    async playSpeakerTest(): Promise<void> {
      stopPreview();
      const gen = generation;
      unlockInUserGesture();
      const el = getAudio();
      bindPlaybackHandlers(el, gen);
      patch({
        selectedVoice: "(altoparlanti)",
        model: "local-wav",
        endpointStatus: null,
        contentType: "audio/wav",
        bytesReceived: null,
        detectedDurationSec: null,
        lastError: null,
        playError: null,
        playbackState: "preparing",
        statusLabel: "Preparazione…",
        volume: 1,
        muted: false,
        playbackRate: 1,
      });
      el.src = buildSpeakerTestDataUri();
      el.load();
      await playCurrent(gen);
      pushLog({
        voice: "(altoparlanti)",
        model: "local-wav",
        httpStatus: null,
        contentType: "audio/wav",
        bytes: null,
        durationSec: diagnostics.detectedDurationSec,
        error: diagnostics.lastError ?? diagnostics.playError,
        at: new Date().toISOString(),
      });
    },

    /**
     * Anteprima TTS indipendente.
     * `simulateError` forza errore locale (test UI senza silenzio).
     */
    async previewVoice(options: {
      text: string;
      voice: string;
      model: string;
      simulateError?: boolean;
    }): Promise<void> {
      stopPreview();
      const gen = generation;
      // play() sincrono nel gesto utente → sblocca autoplay post-fetch
      unlockInUserGesture();
      const { text, voice, model } = options;

      patch({
        selectedVoice: voice,
        model,
        endpointStatus: null,
        contentType: null,
        bytesReceived: null,
        detectedDurationSec: null,
        lastError: null,
        playError: null,
        playbackState: "preparing",
        statusLabel: "Preparazione…",
        volume: 1,
        muted: false,
        playbackRate: 1,
      });

      if (!text.trim()) {
        const msg = "Testo vuoto — nessuna anteprima.";
        patch({
          playbackState: "error",
          statusLabel: `Errore: ${msg}`,
          lastError: msg,
        });
        pushLog({
          voice,
          model,
          httpStatus: null,
          contentType: null,
          bytes: null,
          durationSec: null,
          error: msg,
          at: new Date().toISOString(),
        });
        return;
      }

      if (options.simulateError) {
        const msg = "Errore TTS: simulazione errore (test pannello).";
        patch({
          playbackState: "error",
          statusLabel: msg,
          lastError: msg,
          endpointStatus: 502,
          contentType: "application/json",
        });
        pushLog({
          voice,
          model,
          httpStatus: 502,
          contentType: "application/json",
          bytes: 0,
          durationSec: null,
          error: msg,
          at: new Date().toISOString(),
        });
        return;
      }

      let httpStatus: number | null = null;
      let contentType: string | null = null;
      let bytes: number | null = null;
      let errorMsg: string | null = null;

      try {
        const response = await fetch(TTS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice }),
          cache: "no-store",
        });

        if (gen !== generation) return;

        httpStatus = response.status;
        contentType = response.headers.get("Content-Type");
        const headerModel =
          response.headers.get("X-Joy-TTS-Model") ?? model;
        const headerVoice =
          response.headers.get("X-Joy-TTS-Voice") ?? voice;
        const headerBytes = response.headers.get("X-Joy-TTS-Bytes");

        patch({
          endpointStatus: httpStatus,
          contentType,
          model: headerModel,
          selectedVoice: headerVoice,
        });

        const ct = (contentType || "").toLowerCase();
        const isJson =
          ct.includes("application/json") || ct.includes("text/html");

        if (!response.ok || isJson) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          const raw =
            payload?.error ||
            payload?.message ||
            `HTTP ${response.status}`;
          errorMsg =
            response.status === 503 ||
            /OPENAI_API_KEY/i.test(raw) ||
            /non configurata/i.test(raw)
              ? MISSING_KEY_MSG
              : `Errore TTS: ${raw}`;
          patch({
            playbackState: "error",
            statusLabel: errorMsg,
            lastError: errorMsg,
            bytesReceived: 0,
          });
          pushLog({
            voice: headerVoice,
            model: headerModel,
            httpStatus,
            contentType,
            bytes: 0,
            durationSec: null,
            error: errorMsg,
            at: new Date().toISOString(),
          });
          return;
        }

        const buffer = await response.arrayBuffer();
        if (gen !== generation) return;

        bytes = buffer.byteLength;
        if (headerBytes) {
          const parsed = Number(headerBytes);
          if (Number.isFinite(parsed)) bytes = parsed;
        }

        patch({ bytesReceived: bytes });

        const head = new Uint8Array(buffer.slice(0, 16));
        if (!looksLikeAudioBytes(head) || bytes < 32) {
          errorMsg =
            "Errore TTS: body non è audio (JSON/HTML o vuoto). Nessuna riproduzione.";
          patch({
            playbackState: "error",
            statusLabel: errorMsg,
            lastError: errorMsg,
          });
          pushLog({
            voice: headerVoice,
            model: headerModel,
            httpStatus,
            contentType,
            bytes,
            durationSec: null,
            error: errorMsg,
            at: new Date().toISOString(),
          });
          return;
        }

        const blob = new Blob([buffer], {
          type: "audio/mpeg",
        });
        // Claim elemento prima del src TTS (niente pause da unlock.then).
        unlockSrcPending = false;
        unlockGeneration += 1;
        revokeUrl();
        const url = URL.createObjectURL(blob);
        objectUrl = url;

        const el = getAudio();
        bindPlaybackHandlers(el, gen);
        try {
          el.pause();
        } catch {
          // ignore
        }
        el.muted = false;
        el.volume = 1;
        el.src = url;
        el.load();

        await playCurrent(gen);

        pushLog({
          voice: headerVoice,
          model: headerModel,
          httpStatus,
          contentType,
          bytes,
          durationSec: diagnostics.detectedDurationSec,
          error: diagnostics.playError,
          at: new Date().toISOString(),
        });
      } catch (err) {
        if (gen !== generation) return;
        errorMsg =
          err instanceof Error ? err.message : "Errore di rete verso TTS.";
        patch({
          playbackState: "error",
          statusLabel: `Errore: ${errorMsg}`,
          lastError: errorMsg,
          endpointStatus: httpStatus,
          contentType,
          bytesReceived: bytes,
        });
        pushLog({
          voice,
          model,
          httpStatus,
          contentType,
          bytes,
          durationSec: null,
          error: errorMsg,
          at: new Date().toISOString(),
        });
      }
    },

    dispose() {
      stopPreview();
      if (audio) {
        try {
          audio.remove();
        } catch {
          // ignore
        }
      }
      audio = null;
    },
  };
}

export type VoicePreviewPlayer = ReturnType<typeof createVoicePreviewPlayer>;
