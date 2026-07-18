"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, Loader2, Volume2 } from "lucide-react";
import { Button, Card } from "@/components/ui";
import {
  JOY_TTS_MODEL,
  JOY_TTS_PROVIDER,
  JOY_TTS_VOICE,
  JOY_TTS_VOICES,
  JOY_VOICE_COMPARE_PHRASE,
  JOY_VOICE_CONTINUITY_PHRASE,
  JOY_VOICE_PROFILE,
  JOY_VOICE_TEST_SAMPLES,
  type JoyTtsVoiceId,
} from "@/lib/voice/joy-voice-profile";
import {
  createVoicePreviewPlayer,
  type VoicePreviewAttemptLog,
  type VoicePreviewDiagnostics,
  type VoicePreviewPlayer,
} from "../utils/voice-preview-player";

const INITIAL_DIAG: VoicePreviewDiagnostics = {
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

/**
 * Pannello DEV-ONLY: confronta TUTTE le voci OpenAI già integrate.
 * Player anteprima indipendente dalla coda Joy (joyVoice) — nessun speechSynthesis.
 */
export function JoyVoiceTestPanel() {
  const playerRef = useRef<VoicePreviewPlayer | null>(null);
  const [diag, setDiag] = useState<VoicePreviewDiagnostics>(INITIAL_DIAG);
  const [logs, setLogs] = useState<VoicePreviewAttemptLog[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastVoice, setLastVoice] = useState<JoyTtsVoiceId | null>(null);

  useEffect(() => {
    const player = createVoicePreviewPlayer((next) => {
      setDiag(next);
      setLogs(player.getAttemptLogs());
    });
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  const busy =
    diag.playbackState === "preparing" || diag.playbackState === "playing";

  const playPhrase = async (
    id: string,
    text: string,
    voice: JoyTtsVoiceId,
    options?: { simulateError?: boolean }
  ) => {
    setActiveId(id);
    setLastVoice(voice);
    const player = playerRef.current;
    if (!player) return;
    try {
      await player.previewVoice({
        text,
        voice,
        model: JOY_TTS_MODEL,
        simulateError: options?.simulateError,
      });
    } finally {
      setActiveId(null);
      setLogs(player.getAttemptLogs());
    }
  };

  const runSpeakerTest = async () => {
    setActiveId("speaker");
    const player = playerRef.current;
    if (!player) return;
    try {
      await player.playSpeakerTest();
    } finally {
      setActiveId(null);
      setLogs(player.getAttemptLogs());
    }
  };

  const runContinuityTest = async () => {
    await playPhrase(
      "continuity",
      JOY_VOICE_CONTINUITY_PHRASE,
      lastVoice ?? JOY_TTS_VOICE
    );
  };

  const formatBytes = (n: number | null) => {
    if (n == null) return "—";
    if (n < 1024) return `${n} B`;
    return `${(n / 1024).toFixed(1)} KB`;
  };

  return (
    <Card className="border-amber-200 bg-amber-50/40 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white">
          <Headphones className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            DEV — Confronto voci Joy
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Stessa frase con tutte le voci supportate dall&apos;integrazione OpenAI
            attuale. Player anteprima indipendente dalla coda Joy. Nessun
            speechSynthesis.
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Motore: {JOY_TTS_PROVIDER} / {JOY_TTS_MODEL}. Default tecnico attuale:{" "}
            {JOY_TTS_VOICE}. Profilo: {JOY_VOICE_PROFILE.id}.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="min-h-9 rounded-xl"
          onClick={() => void runSpeakerTest()}
        >
          {activeId === "speaker" && busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Volume2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          Test altoparlanti
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 rounded-xl text-xs"
          onClick={() =>
            void playPhrase(
              "simulate-error",
              JOY_VOICE_COMPARE_PHRASE,
              lastVoice ?? JOY_TTS_VOICE,
              { simulateError: true }
            )
          }
        >
          Simula errore TTS
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-9 rounded-xl text-xs"
          onClick={() => playerRef.current?.stopPreview()}
        >
          Stop anteprima
        </Button>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] text-slate-700">
        <p className="text-xs font-semibold text-slate-900">Diagnostica anteprima</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <p>
            Stato: <span className="font-medium">{diag.statusLabel}</span>
          </p>
          <p>
            Playback: <span className="font-medium">{diag.playbackState}</span>
          </p>
          <p>
            Volume:{" "}
            <span className="font-medium">{Math.round(diag.volume * 100)}%</span>
          </p>
          <p>
            Muted:{" "}
            <span className="font-medium">{diag.muted ? "sì" : "no"}</span>
          </p>
          <p>
            playbackRate:{" "}
            <span className="font-medium">{diag.playbackRate}</span>
          </p>
          <p>
            Voce selezionata:{" "}
            <span className="font-medium">{diag.selectedVoice ?? "—"}</span>
          </p>
          <p>
            Model: <span className="font-medium">{diag.model ?? "—"}</span>
          </p>
          <p>
            Endpoint status:{" "}
            <span className="font-medium">
              {diag.endpointStatus ?? "—"}
            </span>
          </p>
          <p>
            Content-Type:{" "}
            <span className="font-medium">{diag.contentType ?? "—"}</span>
          </p>
          <p>
            Bytes:{" "}
            <span className="font-medium">
              {formatBytes(diag.bytesReceived)}
            </span>
          </p>
          <p>
            Durata rilevata:{" "}
            <span className="font-medium">
              {diag.detectedDurationSec != null
                ? `${diag.detectedDurationSec}s`
                : "—"}
            </span>
          </p>
          <p>
            audio.play():{" "}
            <span className="font-medium">
              {diag.playError ? `Errore — ${diag.playError}` : "ok / n.d."}
            </span>
          </p>
        </div>
        {diag.lastError ? (
          <p className="mt-2 font-medium text-rose-700">{diag.lastError}</p>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-slate-800">
          Frase di confronto
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          {JOY_VOICE_COMPARE_PHRASE}
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {JOY_TTS_VOICES.map((candidate) => {
          const isActive =
            activeId === `voice-${candidate.id}` && busy;
          const isDefault = candidate.id === JOY_TTS_VOICE;
          return (
            <div
              key={candidate.id}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {candidate.label}
                    {isDefault ? (
                      <span className="ml-1 text-[10px] font-normal text-slate-400">
                        (default tecnico)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    modello {JOY_TTS_MODEL} · provider {JOY_TTS_PROVIDER}
                  </p>
                  <p className="text-[10px] text-slate-500">{candidate.note}</p>
                  <p className="text-[10px] text-emerald-700">
                    player: anteprima indipendente
                  </p>
                </div>
                <Button
                  type="button"
                  variant={lastVoice === candidate.id ? "primary" : "outline"}
                  size="sm"
                  className="min-h-8 shrink-0 rounded-lg text-xs"
                  onClick={() =>
                    void playPhrase(
                      `voice-${candidate.id}`,
                      JOY_VOICE_COMPARE_PHRASE,
                      candidate.id
                    )
                  }
                >
                  {isActive ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Ascolta
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 rounded-xl"
          onClick={() => void runContinuityTest()}
        >
          {activeId === "continuity" && busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Test continuità ≥25s
        </Button>
        {JOY_VOICE_TEST_SAMPLES.filter(
          (s) => s.id !== "compare" && s.id !== "continuity"
        ).map((sample) => {
          const isActive = activeId === sample.id && busy;
          return (
            <Button
              key={sample.id}
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-9 rounded-xl text-xs"
              onClick={() =>
                void playPhrase(
                  sample.id,
                  sample.text,
                  lastVoice ?? JOY_TTS_VOICE
                )
              }
            >
              {isActive ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              {sample.label}
            </Button>
          );
        })}
      </div>

      {logs.length > 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-xs font-semibold text-slate-900">
            Log endpoint (temporaneo)
          </p>
          <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-[10px] text-slate-600">
            {logs.map((log, idx) => (
              <li key={`${log.at}-${log.voice}-${idx}`} className="leading-snug">
                <span className="font-medium text-slate-800">{log.voice}</span>
                {" · "}
                model {log.model}
                {" · "}
                HTTP {log.httpStatus ?? "—"}
                {" · "}
                {log.contentType ?? "—"}
                {" · "}
                {formatBytes(log.bytes)}
                {" · "}
                dur {log.durationSec != null ? `${log.durationSec}s` : "—"}
                {log.error ? (
                  <span className="text-rose-700"> · {log.error}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 space-y-1 text-[11px] text-slate-500">
        <p className="text-slate-400">
          Percorso: <code className="text-slate-600">/joy-ai</code> → pulsante
          &quot;Test Voce&quot; → pannello DEV. Una frase = una richiesta TTS = un
          MP3 continuo. Coda Joy non usata.
        </p>
      </div>
    </Card>
  );
}
