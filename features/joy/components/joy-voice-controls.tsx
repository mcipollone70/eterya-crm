"use client";

import { Volume2, VolumeX, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { useJoyVoice } from "../hooks/use-joy-voice";

interface JoyVoiceControlsProps {
  className?: string;
  compact?: boolean;
  /** Mostra diagnostica motore reale (provider/modello/voce/…). */
  showDiagnostics?: boolean;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function JoyVoiceControls({
  className = "",
  compact = false,
  showDiagnostics = true,
}: JoyVoiceControlsProps) {
  const {
    enabled,
    state,
    engine,
    warning,
    error,
    lastText,
    diagnostics,
    isSpeaking,
    isPreparing,
    setEnabled,
    interrupt,
    repeat,
    unlockFromUserGesture,
  } = useJoyVoice();

  const showLiveDiag =
    showDiagnostics &&
    (isPreparing || isSpeaking || state === "error" || diagnostics.ttsRequestCount > 0);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={enabled ? "outline" : "ghost"}
          size="sm"
          className={compact ? "min-h-9 rounded-xl px-2.5 text-xs" : "min-h-10 rounded-xl"}
          onClick={() => {
            if (!enabled) {
              unlockFromUserGesture();
            }
            setEnabled(!enabled);
          }}
          title={enabled ? "Disattiva audio Joy" : "Attiva audio Joy"}
        >
          {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {compact ? (enabled ? "Audio" : "Muto") : enabled ? "Audio on" : "Audio off"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={compact ? "min-h-9 rounded-xl px-2.5 text-xs" : "min-h-10 rounded-xl"}
          disabled={!isSpeaking && state !== "paused"}
          onClick={() => interrupt()}
          title="Interrompi lettura"
        >
          <Square className="h-3.5 w-3.5" />
          Interrompi
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={compact ? "min-h-9 rounded-xl px-2.5 text-xs" : "min-h-10 rounded-xl"}
          disabled={!lastText || isSpeaking}
          onClick={() => {
            unlockFromUserGesture();
            void repeat();
          }}
          title="Ripeti ultima risposta (da cache se disponibile)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Ripeti
        </Button>
        {isPreparing ? (
          <span className="text-[11px] text-slate-500">Preparazione voce…</span>
        ) : null}
        {state === "speaking" ? (
          <span className="text-[11px] text-indigo-600">Joy sta parlando</span>
        ) : null}
        {state === "paused" ? (
          <span className="text-[11px] text-amber-700">In pausa</span>
        ) : null}
        {engine === "openai" && !error ? (
          <span
            className="text-[11px] text-emerald-700"
            data-testid="joy-voice-engine-indicator"
          >
            OpenAI TTS attivo
          </span>
        ) : null}
      </div>

      {error ? (
        <p
          className="text-[11px] font-medium text-rose-700"
          data-testid="joy-voice-tts-error"
        >
          {error}
        </p>
      ) : null}
      {warning && !error ? (
        <p className="text-[11px] text-amber-800">{warning}</p>
      ) : null}

      {showLiveDiag ? (
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] leading-relaxed text-slate-600"
          data-testid="joy-voice-diagnostics"
        >
          <span className="font-semibold text-slate-800">Motore vocale: </span>
          provider <strong>{diagnostics.provider ?? "—"}</strong>
          {" · "}
          modello <strong>{diagnostics.model ?? "—"}</strong>
          {" · "}
          voce <strong>{diagnostics.voice ?? "—"}</strong>
          {" · "}
          fallback <strong>{diagnostics.fallbackActive ? "sì" : "no"}</strong>
          {" · "}
          richieste TTS <strong>{diagnostics.ttsRequestCount}</strong>
          {" · "}
          durata{" "}
          <strong>
            {diagnostics.audioDurationSec != null
              ? `${diagnostics.audioDurationSec}s`
              : "—"}
          </strong>
          {" · "}
          file <strong>{formatBytes(diagnostics.audioSizeBytes)}</strong>
          {diagnostics.cached ? " · cache" : null}
        </div>
      ) : null}
    </div>
  );
}
