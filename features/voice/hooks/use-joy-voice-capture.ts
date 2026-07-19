"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  type BrowserSpeechRecognition,
} from "@/lib/voice/browser-speech";
import {
  JOY_STT_ERROR_MESSAGES,
  joySttMessage,
  mapSpeechRecognitionError,
  type JoySttErrorCode,
} from "@/lib/voice/joy-stt-errors";
import {
  extensionForMime,
  JOY_VOICE_MAX_MS,
  JOY_VOICE_MIN_BLOB_BYTES,
  pickMediaRecorderMime,
  preferServerSttCapture,
} from "@/lib/voice/media-recorder-mime";
import {
  createJoyVoiceDebugEvent,
  isJoyVoiceDebugEnabled,
  type JoyVoiceDebugEvent,
  type JoyVoiceDebugPhase,
} from "../utils/joy-voice-debug";

export type JoyVoiceUiPhase =
  | "idle"
  | "listening"
  | "processing"
  | "transcribing"
  | "heard"
  | "recognized"
  | "executing"
  | "error";

export const JOY_VOICE_UI_LABELS: Record<JoyVoiceUiPhase, string> = {
  idle: "Tocca Parla",
  listening: "Ti ascolto",
  processing: "Sto elaborando",
  transcribing: "Sto trascrivendo",
  heard: "Hai detto",
  recognized: "Comando riconosciuto",
  executing: "JOY sta eseguendo",
  error: "Errore",
};

export interface JoyVoiceAudioStats {
  chunkCount: number;
  blobSize: number;
  blobType: string;
  durationMs: number;
}

interface UseJoyVoiceCaptureOptions {
  /** Called with a local trimmed transcript — never rely on stale React state. */
  onTranscriptReady?: (text: string) => void;
  lang?: string;
}

function detectPreferRecorder(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return preferServerSttCapture(navigator.userAgent, standalone);
}

function mapApiErrorCode(raw: string | undefined): JoySttErrorCode {
  switch (raw) {
    case "auth":
      return "auth";
    case "not_configured":
      return "not_configured";
    case "empty":
    case "missing_audio":
      return "empty_blob";
    case "too_large":
      return "too_long";
    case "upstream":
      return "transcribe_upstream";
    case "invalid":
    case "bad_mime":
      return "transcribe_http";
    default:
      if (raw && raw in JOY_STT_ERROR_MESSAGES) {
        return raw as JoySttErrorCode;
      }
      return "transcribe_http";
  }
}

async function postTranscribe(blob: Blob, filename: string): Promise<{
  ok: boolean;
  text?: string;
  error?: string;
  code?: string;
}> {
  const form = new FormData();
  form.append("audio", blob, filename);
  const response = await fetch("/api/joy-ai/transcribe", {
    method: "POST",
    body: form,
    credentials: "same-origin",
    cache: "no-store",
  });
  let data: { ok?: boolean; text?: string; error?: string; code?: string } = {};
  try {
    data = (await response.json()) as typeof data;
  } catch {
    return { ok: false, error: joySttMessage("transcribe_http"), code: "transcribe_http" };
  }
  if (!response.ok || !data.ok) {
    const code = mapApiErrorCode(data.code);
    return {
      ok: false,
      error: data.error || joySttMessage(code),
      code,
    };
  }
  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (!text) {
    return { ok: false, error: joySttMessage("transcribe_empty"), code: "transcribe_empty" };
  }
  return { ok: true, text };
}

export function useJoyVoiceCapture(options: UseJoyVoiceCaptureOptions = {}) {
  const { lang = "it-IT", onTranscriptReady } = options;

  const [phase, setPhase] = useState<JoyVoiceUiPhase>("idle");
  const [heardText, setHeardText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<JoySttErrorCode | null>(null);
  const [audioStats, setAudioStats] = useState<JoyVoiceAudioStats>({
    chunkCount: 0,
    blobSize: 0,
    blobType: "",
    durationMs: 0,
  });
  const [debugStartAt, setDebugStartAt] = useState(0);
  const [debugEvents, setDebugEvents] = useState<JoyVoiceDebugEvent[]>([]);
  const [debugEnabled] = useState(() => isJoyVoiceDebugEnabled());
  const [preferRecorder] = useState(() => detectPreferRecorder());
  const [speechSupported] = useState(() => isSpeechRecognitionSupported());
  const [recorderSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
  });

  const onTranscriptRef = useRef(onTranscriptReady);
  const phaseRef = useRef<JoyVoiceUiPhase>("idle");
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const chunkCountRef = useRef(0);
  const recordStartedAtRef = useRef(0);
  const maxTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const sessionIdRef = useRef(0);
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);
  const fallbackArmedRef = useRef(false);

  useEffect(() => {
    onTranscriptRef.current = onTranscriptReady;
  }, [onTranscriptReady]);

  const pushDebug = useCallback(
    (phaseName: JoyVoiceDebugPhase, outcome: string, detail?: string) => {
      if (!debugEnabled) return;
      const event = createJoyVoiceDebugEvent(phaseName, outcome, detail);
      setDebugEvents((current) => [...current.slice(-40), event]);
    },
    [debugEnabled]
  );

  const setPhaseSafe = useCallback((next: JoyVoiceUiPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const fail = useCallback(
    (code: JoySttErrorCode, detail?: string) => {
      const message = joySttMessage(code);
      setError(message);
      setErrorCode(code);
      setPhaseSafe("error");
      pushDebug("ERROR", code, detail ?? message);
    },
    [pushDebug, setPhaseSafe]
  );

  const stopTracks = useCallback(() => {
    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    if (!stream) return;
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const clearMaxTimer = useCallback(() => {
    if (maxTimerRef.current != null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const abortSpeech = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    try {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    } catch {
      // ignore
    }
  }, []);

  const cleanupCapture = useCallback(() => {
    clearMaxTimer();
    abortSpeech();
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    stopTracks();
    chunksRef.current = [];
    chunkCountRef.current = 0;
    stopResolverRef.current = null;
  }, [abortSpeech, clearMaxTimer, stopTracks]);

  useEffect(() => {
    return () => {
      sessionIdRef.current += 1;
      cleanupCapture();
    };
  }, [cleanupCapture]);

  const emitTranscript = useCallback(
    (raw: string, sessionId: number) => {
      const text = raw.trim();
      if (!text) {
        fail("transcribe_empty");
        return;
      }
      if (sessionId !== sessionIdRef.current) {
        return;
      }
      setHeardText(text);
      setPhaseSafe("heard");
      pushDebug("TRANSCRIPT_SHOWN", "ok", `${text.length} chars`);
      setPhaseSafe("recognized");
      pushDebug("COMMAND_SUBMITTED", "ok", text.slice(0, 80));
      // Local variable — do not depend on setState flushing.
      onTranscriptRef.current?.(text);
    },
    [fail, pushDebug, setPhaseSafe]
  );

  const transcribeBlob = useCallback(
    async (blob: Blob, sessionId: number, durationMs: number) => {
      if (sessionId !== sessionIdRef.current) return;

      setAudioStats({
        chunkCount: chunkCountRef.current,
        blobSize: blob.size,
        blobType: blob.type || "unknown",
        durationMs,
      });

      pushDebug(
        "AUDIO_BLOB_READY",
        blob.size > 0 ? "ok" : "empty",
        `${blob.size}B ${blob.type || "?"} ${durationMs}ms chunks=${chunkCountRef.current}`
      );

      if (blob.size < JOY_VOICE_MIN_BLOB_BYTES) {
        fail("empty_blob", `size=${blob.size}`);
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        fail("offline");
        return;
      }

      setPhaseSafe("transcribing");
      pushDebug("TRANSCRIBE_REQUEST", "start", `${blob.size}B`);

      const mime = blob.type || "audio/webm";
      const filename = `joy-voice.${extensionForMime(mime)}`;
      const result = await postTranscribe(blob, filename);

      if (sessionId !== sessionIdRef.current) return;

      if (!result.ok || !result.text) {
        const code = mapApiErrorCode(result.code);
        pushDebug("TRANSCRIBE_RESPONSE", "error", result.error);
        fail(code, result.error);
        return;
      }

      pushDebug("TRANSCRIBE_RESPONSE", "ok", `${result.text.length} chars`);
      emitTranscript(result.text, sessionId);
    },
    [emitTranscript, fail, pushDebug, setPhaseSafe]
  );

  const waitForRecorderStop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      stopResolverRef.current = resolve;
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        const parts = chunksRef.current;
        const type = pickMediaRecorderMime() || "audio/webm";
        resolve(parts.length ? new Blob(parts, { type }) : null);
        return;
      }
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  const startMediaRecorder = useCallback(async () => {
    if (!recorderSupported) {
      fail("recorder_unsupported");
      return;
    }

    const sessionId = sessionIdRef.current;
    setError(null);
    setErrorCode(null);
    setHeardText("");
    chunksRef.current = [];
    chunkCountRef.current = 0;
    fallbackArmedRef.current = false;

    pushDebug("MIC_BUTTON_CLICKED", "recorder");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      fail(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "mic_denied"
          : "mic_unavailable",
        name
      );
      return;
    }

    if (sessionId !== sessionIdRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    mediaStreamRef.current = stream;
    const liveTracks = stream.getAudioTracks().filter((t) => t.readyState === "live");
    pushDebug(
      "MIC_PERMISSION",
      "granted",
      `tracks=${liveTracks.length}`
    );
    pushDebug(
      "STREAM_LIVE",
      liveTracks.length > 0 ? "ok" : "empty",
      liveTracks.map((t) => t.label || t.kind).join(",") || "no-tracks"
    );

    if (liveTracks.length === 0) {
      stopTracks();
      fail("no_audio", "no live tracks");
      return;
    }

    const mime = pickMediaRecorderMime();
    let recorder: MediaRecorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
    } catch {
      stopTracks();
      fail("recorder_failed", "ctor");
      return;
    }

    mediaRecorderRef.current = recorder;
    recordStartedAtRef.current = Date.now();

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
        chunkCountRef.current += 1;
        pushDebug("CHUNK_RECEIVED", "ok", `n=${chunkCountRef.current} size=${event.data.size}`);
      }
    };

    recorder.onerror = () => {
      fail("recorder_failed", "onerror");
    };

    recorder.onstop = () => {
      const type = recorder.mimeType || mime || "audio/webm";
      const parts = chunksRef.current;
      const blob = parts.length > 0 ? new Blob(parts, { type }) : null;
      pushDebug(
        "RECORDER_STOPPED",
        blob ? "ok" : "empty",
        `chunks=${chunkCountRef.current}`
      );
      const resolver = stopResolverRef.current;
      stopResolverRef.current = null;
      resolver?.(blob);
    };

    try {
      // Timeslice keeps chunks flowing on Safari.
      recorder.start(1000);
    } catch {
      stopTracks();
      fail("recorder_failed", "start");
      return;
    }

    pushDebug("RECORDER_STARTED", "ok", recorder.mimeType || mime || "default");
    setPhaseSafe("listening");

    clearMaxTimer();
    maxTimerRef.current = window.setTimeout(() => {
      void (async () => {
        if (sessionId !== sessionIdRef.current) return;
        if (phaseRef.current !== "listening") return;
        setPhaseSafe("processing");
        const durationMs = Date.now() - recordStartedAtRef.current;
        const blob = await waitForRecorderStop();
        stopTracks();
        if (sessionId !== sessionIdRef.current) return;
        if (!blob) {
          fail("empty_blob", "max-timeout");
          return;
        }
        await transcribeBlob(blob, sessionId, durationMs);
      })();
    }, JOY_VOICE_MAX_MS);
  }, [
    clearMaxTimer,
    fail,
    pushDebug,
    recorderSupported,
    setPhaseSafe,
    stopTracks,
    transcribeBlob,
    waitForRecorderStop,
  ]);

  const startSpeechRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      void startMediaRecorder();
      return;
    }

    const sessionId = sessionIdRef.current;
    setError(null);
    setErrorCode(null);
    setHeardText("");
    fallbackArmedRef.current = true;

    pushDebug("MIC_BUTTON_CLICKED", "speech");
    pushDebug("SPEECH_STARTED", "ok", lang);

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result?.isFinal) continue;
        const piece = result[0]?.transcript ?? "";
        if (piece) finalText = `${finalText} ${piece}`.trim();
      }
      if (!finalText) {
        pushDebug("SPEECH_RESULT", "empty");
        return;
      }
      pushDebug("SPEECH_RESULT", "ok", finalText.slice(0, 80));
      fallbackArmedRef.current = false;
      recognitionRef.current = null;
      emitTranscript(finalText, sessionId);
    };

    recognition.onerror = (event) => {
      const code = mapSpeechRecognitionError(event.error);
      pushDebug("SPEECH_ERROR", event.error, code);
      recognitionRef.current = null;
      if (event.error === "aborted") {
        setPhaseSafe("idle");
        return;
      }
      if (fallbackArmedRef.current && recorderSupported) {
        fallbackArmedRef.current = false;
        pushDebug("SPEECH_FALLBACK", "mediarecorder", event.error);
        void startMediaRecorder();
        return;
      }
      fail(code, event.error);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (sessionId !== sessionIdRef.current) return;
      if (phaseRef.current === "listening" && fallbackArmedRef.current && recorderSupported) {
        fallbackArmedRef.current = false;
        pushDebug("SPEECH_FALLBACK", "mediarecorder", "no-result-onend");
        void startMediaRecorder();
        return;
      }
      if (phaseRef.current === "listening") {
        setPhaseSafe("idle");
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setPhaseSafe("listening");
    } catch {
      pushDebug("SPEECH_ERROR", "start-failed");
      if (recorderSupported) {
        pushDebug("SPEECH_FALLBACK", "mediarecorder", "start-failed");
        void startMediaRecorder();
        return;
      }
      fail("speech_other", "start-failed");
    }
  }, [
    emitTranscript,
    fail,
    lang,
    pushDebug,
    recorderSupported,
    setPhaseSafe,
    startMediaRecorder,
  ]);

  const startCapture = useCallback(async () => {
    sessionIdRef.current += 1;
    cleanupCapture();
    setDebugStartAt(Date.now());
    setDebugEvents([]);

    // iPhone / PWA: MediaRecorder first. Desktop: Web Speech with auto-fallback.
    if (preferRecorder || !speechSupported) {
      await startMediaRecorder();
      return;
    }
    startSpeechRecognition();
  }, [
    cleanupCapture,
    preferRecorder,
    speechSupported,
    startMediaRecorder,
    startSpeechRecognition,
  ]);

  const stopCapture = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    clearMaxTimer();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      // Speech final result arrives via onresult; if none, onend may fallback.
      return;
    }

    if (!mediaRecorderRef.current) {
      setPhaseSafe("idle");
      return;
    }

    setPhaseSafe("processing");
    const durationMs = Date.now() - recordStartedAtRef.current;
    const blob = await waitForRecorderStop();
    stopTracks();

    if (sessionId !== sessionIdRef.current) return;

    if (!blob) {
      fail("empty_blob", "manual-stop");
      return;
    }

    await transcribeBlob(blob, sessionId, durationMs);
  }, [
    clearMaxTimer,
    fail,
    setPhaseSafe,
    stopTracks,
    transcribeBlob,
    waitForRecorderStop,
  ]);

  const cancelCapture = useCallback(() => {
    sessionIdRef.current += 1;
    cleanupCapture();
    setHeardText("");
    setError(null);
    setErrorCode(null);
    setPhaseSafe("idle");
  }, [cleanupCapture, setPhaseSafe]);

  const retryCapture = useCallback(() => {
    void startCapture();
  }, [startCapture]);

  const submitHeardText = useCallback(() => {
    const text = heardText.trim();
    if (!text) return;
    pushDebug("COMMAND_SUBMITTED", "manual", text.slice(0, 80));
    setPhaseSafe("recognized");
    onTranscriptRef.current?.(text);
  }, [heardText, pushDebug, setPhaseSafe]);

  const markExecuting = useCallback(() => {
    setPhaseSafe("executing");
    pushDebug("COMMAND_EXECUTED", "start");
  }, [pushDebug, setPhaseSafe]);

  const markExecuted = useCallback(
    (ok: boolean, detail?: string) => {
      pushDebug("COMMAND_EXECUTED", ok ? "ok" : "error", detail);
      if (phaseRef.current === "executing" || phaseRef.current === "recognized") {
        setPhaseSafe("idle");
      }
    },
    [pushDebug, setPhaseSafe]
  );

  const correctHeard = useCallback(
    (next: string) => {
      setHeardText(next);
      setPhaseSafe("heard");
    },
    [setPhaseSafe]
  );

  const isListening = phase === "listening";
  const isBusy =
    phase === "processing" ||
    phase === "transcribing" ||
    phase === "recognized" ||
    phase === "executing";

  return {
    phase,
    phaseLabel: JOY_VOICE_UI_LABELS[phase],
    heardText,
    error,
    errorCode,
    audioStats,
    debugEvents,
    debugEnabled,
    debugStartAt,
    preferRecorder,
    speechSupported,
    recorderSupported,
    isSupported: recorderSupported || speechSupported,
    isListening,
    isBusy,
    startCapture,
    stopCapture,
    cancelCapture,
    retryCapture,
    submitHeardText,
    correctHeard,
    markExecuting,
    markExecuted,
    setPhaseIdle: () => setPhaseSafe("idle"),
  };
}
