/**
 * Coda audio centrale Joy: una sola utterance = una sola richiesta TTS = un solo MP3.
 * Primary = OpenAI TTS. Nessun auto-play di speechSynthesis / voci Windows / Edge.
 * Se TTS fallisce → errore chiaro, nessuna voce robotica.
 */

import { cancelBrowserSpeech } from "./browser-tts";
import {
  JOY_SPOKEN_TARGET_CHARS,
  JOY_TTS_MODEL,
  JOY_TTS_PROVIDER,
  JOY_TTS_VOICE,
  type JoyTtsVoiceId,
} from "./joy-voice-profile";
import { prepareJoyUtterance } from "./spoken-text";

export type JoyVoiceState =
  | "idle"
  | "preparing"
  | "ready"
  | "speaking"
  | "paused"
  | "stopped"
  | "error";

/** Alias legacy — alcuni caller storici usavano "loading". */
export type JoyVoiceStateLegacy = JoyVoiceState | "loading";

export type JoyVoiceEngine = "openai" | "none";

const ENABLED_STORAGE_KEY = "eterya.joy.voice.audioEnabled";

const TTS_UNAVAILABLE_MSG = "Voce naturale non disponibile — errore TTS";

type Listener = (snapshot: JoyVoiceSnapshot) => void;

export interface JoyVoiceDiagnostics {
  provider: string | null;
  model: string | null;
  voice: string | null;
  fallbackActive: boolean;
  ttsRequestCount: number;
  audioDurationSec: number | null;
  audioSizeBytes: number | null;
  cached: boolean;
}

export interface JoyVoiceSnapshot {
  state: JoyVoiceState;
  engine: JoyVoiceEngine;
  enabled: boolean;
  lastText: string | null;
  lastDisplayText: string | null;
  warning: string | null;
  error: string | null;
  diagnostics: JoyVoiceDiagnostics;
}

interface SpeakOptions {
  /** Salta sanitize (testi già preparati / test voice). */
  raw?: boolean;
  /** Parla anche se audio disattivato (solo test espliciti). */
  force?: boolean;
  /** Testo UI originale (per snapshot); spoken deriva da text. */
  displayText?: string;
  /** Solo pannello confronto — override voce OpenAI. */
  voiceOverride?: JoyTtsVoiceId;
}

const EMPTY_DIAGNOSTICS: JoyVoiceDiagnostics = {
  provider: null,
  model: null,
  voice: null,
  fallbackActive: false,
  ttsRequestCount: 0,
  audioDurationSec: null,
  audioSizeBytes: null,
  cached: false,
};

class JoyVoiceQueue {
  private state: JoyVoiceState = "idle";
  private engine: JoyVoiceEngine = "none";
  private enabled = true;
  private lastText: string | null = null;
  private lastDisplayText: string | null = null;
  private warning: string | null = null;
  private error: string | null = null;
  private diagnostics: JoyVoiceDiagnostics = { ...EMPTY_DIAGNOSTICS };
  private listeners = new Set<Listener>();
  private generation = 0;
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  /** Cache client per Ripeti (stesso testo + voce). */
  private cachedBlob: Blob | null = null;
  private cachedText: string | null = null;
  private cachedVoice: string | null = null;
  private cachedMeta: {
    provider: string;
    model: string;
    voice: string;
    sizeBytes: number;
    cached: boolean;
  } | null = null;
  private playResolve: ((ok: boolean) => void) | null = null;
  private fetchAbort: AbortController | null = null;
  private openAiCommitted = false;
  private inFlightKey: string | null = null;
  private inFlightPromise: Promise<"played" | "failed" | "aborted"> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem(ENABLED_STORAGE_KEY);
        if (stored === "0") this.enabled = false;
        if (stored === "1") this.enabled = true;
        // Pulisce preferenza legacy browser (non più usata)
        window.localStorage.removeItem("eterya.joy.voice.preferBrowser");
      } catch {
        // localStorage non disponibile
      }
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): JoyVoiceSnapshot {
    return {
      state: this.state,
      engine: this.engine,
      enabled: this.enabled,
      lastText: this.lastText,
      lastDisplayText: this.lastDisplayText,
      warning: this.warning,
      error: this.error,
      diagnostics: { ...this.diagnostics },
    };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? "1" : "0");
      } catch {
        // ignore
      }
    }
    if (!enabled) {
      this.interrupt();
    }
    this.emit();
  }

  getState(): JoyVoiceState {
    return this.state;
  }

  getLastSpokenText(): string | null {
    return this.lastText;
  }

  /**
   * Parla un unico blocco completo.
   * Una speak() = al massimo una fetch TTS = un solo HTMLAudioElement continuo.
   * Annulla qualsiasi riproduzione precedente.
   */
  async speak(text: string, options?: SpeakOptions): Promise<void> {
    const displaySource = options?.displayText ?? text;
    const prepared = options?.raw
      ? text.trim().replace(/\s+/g, " ")
      : prepareJoyUtterance(text, JOY_SPOKEN_TARGET_CHARS).spokenText;

    if (!prepared) {
      return;
    }

    if (!this.enabled && !options?.force) {
      return;
    }

    // Ferma audio precedente + speechSynthesis residuo (mai usato come motore)
    const gen = ++this.generation;
    this.abortInFlightFetch();
    this.hardStopPlayback({ keepCache: true });
    cancelBrowserSpeech();
    this.openAiCommitted = false;
    this.lastText = prepared;
    this.lastDisplayText = displaySource;
    this.error = null;
    this.warning = null;
    this.diagnostics = {
      ...EMPTY_DIAGNOSTICS,
      provider: JOY_TTS_PROVIDER,
      model: JOY_TTS_MODEL,
      voice: options?.voiceOverride ?? JOY_TTS_VOICE,
      fallbackActive: false,
      ttsRequestCount: 0,
    };
    this.setState("preparing", "none");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.failNaturalVoice("Offline: impossibile generare la voce naturale.");
      return;
    }

    const result = await this.tryOpenAiPlayback(
      prepared,
      gen,
      options?.voiceOverride
    );
    if (gen !== this.generation) {
      return;
    }

    if (result === "played" || result === "aborted") {
      return;
    }

    this.failNaturalVoice(this.warning ?? TTS_UNAVAILABLE_MSG);
  }

  async repeat(): Promise<void> {
    if (!this.lastText) {
      return;
    }
    await this.speak(this.lastText, {
      raw: true,
      force: true,
      displayText: this.lastDisplayText ?? this.lastText,
    });
  }

  interrupt(): void {
    this.generation += 1;
    this.abortInFlightFetch();
    this.hardStopPlayback({ keepCache: true });
    cancelBrowserSpeech();
    this.openAiCommitted = false;
    this.setState("stopped", this.engine);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (this.state === "stopped") {
          this.setState("idle", this.engine);
        }
      }, 0);
    } else {
      this.setState("idle", this.engine);
    }
  }

  pause(): void {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
      this.setState("paused", this.engine);
    }
  }

  resume(): void {
    if (this.audio && this.audio.paused && this.state === "paused") {
      void this.audio.play();
      this.setState("speaking", "openai");
    }
  }

  private failNaturalVoice(message: string): void {
    this.error = TTS_UNAVAILABLE_MSG;
    this.warning = message;
    this.diagnostics = {
      ...this.diagnostics,
      fallbackActive: false,
    };
    this.setState("error", "none");
    this.emit();
  }

  private abortInFlightFetch(): void {
    if (this.fetchAbort) {
      this.fetchAbort.abort();
      this.fetchAbort = null;
    }
    this.inFlightKey = null;
    this.inFlightPromise = null;
  }

  private async tryOpenAiPlayback(
    text: string,
    gen: number,
    voiceOverride?: JoyTtsVoiceId
  ): Promise<"played" | "failed" | "aborted"> {
    const voiceKey = voiceOverride ?? "default";
    const cacheHit =
      this.cachedBlob &&
      this.cachedText === text &&
      this.cachedVoice === voiceKey;

    if (cacheHit && this.cachedBlob) {
      if (gen !== this.generation) return "aborted";
      this.diagnostics = {
        ...this.diagnostics,
        ttsRequestCount: 0,
        audioSizeBytes: this.cachedBlob.size,
        cached: true,
        provider: this.cachedMeta?.provider ?? JOY_TTS_PROVIDER,
        model: this.cachedMeta?.model ?? JOY_TTS_MODEL,
        voice: this.cachedMeta?.voice ?? (voiceOverride ?? JOY_TTS_VOICE),
        fallbackActive: false,
      };
      this.emit();
      const played = await this.playBlob(this.cachedBlob, gen);
      if (gen !== this.generation) return "aborted";
      return played ? "played" : "failed";
    }

    const requestKey = `${voiceKey}|${text}`;

    try {
      if (this.inFlightKey === requestKey && this.inFlightPromise) {
        const shared = await this.inFlightPromise;
        if (gen !== this.generation) return "aborted";
        if (shared !== "played" && this.cachedBlob && this.cachedText === text) {
          const played = await this.playBlob(this.cachedBlob, gen);
          return played ? "played" : "failed";
        }
        return shared;
      }

      const run = this.fetchAndPlay(text, gen, voiceOverride, voiceKey);
      this.inFlightKey = requestKey;
      this.inFlightPromise = run;
      const result = await run;
      if (this.inFlightKey === requestKey) {
        this.inFlightKey = null;
        this.inFlightPromise = null;
      }
      return result;
    } catch {
      if (gen !== this.generation) {
        return "aborted";
      }
      this.warning = "Rete TTS non disponibile.";
      return "failed";
    }
  }

  private async fetchAndPlay(
    text: string,
    gen: number,
    voiceOverride: JoyTtsVoiceId | undefined,
    voiceKey: string
  ): Promise<"played" | "failed" | "aborted"> {
    const abort = new AbortController();
    this.fetchAbort = abort;

    try {
      const body: { text: string; voice?: JoyTtsVoiceId } = { text };
      if (voiceOverride) {
        body.voice = voiceOverride;
      }

      this.diagnostics = {
        ...this.diagnostics,
        ttsRequestCount: 1,
        fallbackActive: false,
        cached: false,
      };
      this.emit();

      const response = await fetch("/api/joy-ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      if (gen !== this.generation) {
        return "aborted";
      }

      const headerProvider =
        response.headers.get("X-Joy-TTS-Provider") ?? JOY_TTS_PROVIDER;
      const headerModel =
        response.headers.get("X-Joy-TTS-Model") ?? JOY_TTS_MODEL;
      const headerVoice =
        response.headers.get("X-Joy-TTS-Voice") ??
        voiceOverride ??
        JOY_TTS_VOICE;
      const headerCached = response.headers.get("X-Joy-TTS-Cached") === "1";

      this.diagnostics = {
        ...this.diagnostics,
        provider: headerProvider,
        model: headerModel,
        voice: headerVoice,
        fallbackActive: false,
        cached: headerCached,
        ttsRequestCount: 1,
      };
      this.emit();

      if (response.status === 503 || !response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        this.warning =
          payload?.message ??
          payload?.error ??
          TTS_UNAVAILABLE_MSG;
        if (process.env.NODE_ENV !== "production") {
          console.warn("[Joy TTS] upstream error", {
            status: response.status,
            error: this.warning,
          });
        }
        return "failed";
      }

      const blob = await response.blob();
      if (gen !== this.generation) {
        return "aborted";
      }

      if (!blob || blob.size < 32) {
        this.warning = "Audio TTS vuoto o non valido.";
        return "failed";
      }

      this.cachedBlob = blob;
      this.cachedText = text;
      this.cachedVoice = voiceKey;
      this.cachedMeta = {
        provider: headerProvider,
        model: headerModel,
        voice: headerVoice,
        sizeBytes: blob.size,
        cached: headerCached,
      };
      this.diagnostics = {
        ...this.diagnostics,
        audioSizeBytes: blob.size,
        provider: headerProvider,
        model: headerModel,
        voice: headerVoice,
        fallbackActive: false,
        ttsRequestCount: 1,
        cached: headerCached,
      };
      this.emit();

      const played = await this.playBlob(blob, gen);
      if (gen !== this.generation) {
        return "aborted";
      }
      return played ? "played" : "failed";
    } catch (error) {
      if (abort.signal.aborted || gen !== this.generation) {
        return "aborted";
      }
      const message =
        error instanceof Error ? error.message : "Errore di rete verso TTS.";
      this.warning = message;
      return "failed";
    } finally {
      if (this.fetchAbort === abort) {
        this.fetchAbort = null;
      }
    }
  }

  /**
   * Un solo HTMLAudioElement per generation: preload completo → ready → play continuo.
   */
  private playBlob(blob: Blob, gen: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.playResolve = resolve;
      this.openAiCommitted = false;

      this.revokeObjectUrl();
      const url = URL.createObjectURL(blob);
      this.objectUrl = url;

      const audio = new Audio();
      audio.preload = "auto";
      this.audio = audio;
      this.engine = "openai";

      let settled = false;
      let playStarted = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        audio.onended = null;
        audio.onerror = null;
        audio.oncanplaythrough = null;
        audio.ondurationchange = null;
        if (this.playResolve === resolve) {
          this.playResolve = null;
        }
        if (gen === this.generation) {
          if (ok) {
            this.setState("idle", "openai");
          } else if (this.openAiCommitted) {
            this.setState("error", "openai");
          }
        }
        resolve(ok);
      };

      const updateDuration = () => {
        if (
          Number.isFinite(audio.duration) &&
          audio.duration > 0 &&
          gen === this.generation
        ) {
          this.diagnostics = {
            ...this.diagnostics,
            audioDurationSec: Math.round(audio.duration * 10) / 10,
            audioSizeBytes: blob.size,
            fallbackActive: false,
          };
          this.emit();
        }
      };

      const startPlayback = () => {
        if (gen !== this.generation || settled || playStarted) {
          return;
        }
        playStarted = true;
        audio.oncanplaythrough = null;
        updateDuration();
        this.setState("ready", "openai");
        void audio.play().then(
          () => {
            if (gen !== this.generation) {
              finish(false);
              return;
            }
            this.openAiCommitted = true;
            this.setState("speaking", "openai");
          },
          () => {
            this.warning = "Autoplay bloccato o errore audio.";
            finish(false);
          }
        );
      };

      audio.ondurationchange = () => updateDuration();
      audio.onended = () => {
        updateDuration();
        finish(true);
      };
      audio.onerror = () => {
        if (this.openAiCommitted) {
          this.warning = "Riproduzione OpenAI interrotta.";
          finish(false);
          return;
        }
        this.warning = "Decodifica audio fallita prima dell'avvio.";
        finish(false);
      };

      audio.oncanplaythrough = () => startPlayback();

      window.setTimeout(() => {
        if (settled || playStarted || gen !== this.generation) return;
        if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          startPlayback();
        }
      }, 400);

      window.setTimeout(() => {
        if (settled || playStarted || gen !== this.generation) return;
        if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          startPlayback();
        } else {
          this.warning = "Timeout preparazione audio.";
          finish(false);
        }
      }, 8000);

      audio.src = url;
      audio.load();
    });
  }

  private hardStopPlayback(options?: { keepCache?: boolean }): void {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.oncanplaythrough = null;
      this.audio.ondurationchange = null;
      try {
        this.audio.pause();
      } catch {
        // ignore
      }
      try {
        this.audio.removeAttribute("src");
        this.audio.load();
      } catch {
        // ignore
      }
      this.audio = null;
    }
    this.revokeObjectUrl();
    cancelBrowserSpeech();
    if (!options?.keepCache) {
      this.cachedBlob = null;
      this.cachedText = null;
      this.cachedVoice = null;
      this.cachedMeta = null;
    }
    if (this.playResolve) {
      const resolve = this.playResolve;
      this.playResolve = null;
      resolve(true);
    }
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private setState(state: JoyVoiceState, engine: JoyVoiceEngine): void {
    this.state = state;
    this.engine = engine;
    this.emit();
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }
}

const globalKey = "__eteryaJoyVoiceQueueV3";

function getQueue(): JoyVoiceQueue {
  if (typeof window === "undefined") {
    return new JoyVoiceQueue();
  }
  const w = window as unknown as Record<string, JoyVoiceQueue | undefined>;
  // Reset singleton se schema snapshot è cambiato (dev HMR)
  if (!w[globalKey]) {
    w[globalKey] = new JoyVoiceQueue();
  }
  return w[globalKey]!;
}

/** Singleton coda vocale Joy (stabile tra remount / navigazione client). */
export const joyVoice = {
  speak: (text: string, options?: SpeakOptions) => getQueue().speak(text, options),
  repeat: () => getQueue().repeat(),
  interrupt: () => getQueue().interrupt(),
  pause: () => getQueue().pause(),
  resume: () => getQueue().resume(),
  setEnabled: (enabled: boolean) => getQueue().setEnabled(enabled),
  isEnabled: () => getQueue().isEnabled(),
  getState: () => getQueue().getState(),
  getLastSpokenText: () => getQueue().getLastSpokenText(),
  subscribe: (listener: Listener) => getQueue().subscribe(listener),
  snapshot: () => getQueue().snapshot(),
};

/** API compatibile con le chiamate precedenti alle schermate Joy. */
export async function speakItalian(
  text: string,
  options?: { rate?: number; maxChars?: number; displayText?: string }
): Promise<void> {
  const { spokenText, displayText } = prepareJoyUtterance(
    text,
    options?.maxChars ?? JOY_SPOKEN_TARGET_CHARS
  );
  if (!spokenText) {
    return;
  }
  await joyVoice.speak(spokenText, {
    raw: true,
    displayText: options?.displayText ?? displayText,
  });
}

export function stopSpeaking(): void {
  joyVoice.interrupt();
}

export { buildSpokenSummary, prepareJoyUtterance, sanitizeSpokenText } from "./spoken-text";

/** Helper per UI che ancora controllano lo stato legacy "loading". */
export function isJoyVoiceBusy(state: JoyVoiceState): boolean {
  return (
    state === "preparing" ||
    state === "ready" ||
    state === "speaking" ||
    state === "paused"
  );
}
