"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useSpeechRecognition } from "@/features/voice/hooks/use-speech-recognition";
import {
  speakItalian,
  stopSpeaking,
  unlockJoyAudioFromUserGesture,
} from "@/lib/voice/joy-voice-queue";
import { GOOGLE_MAPS_LINK_TARGET } from "@/features/routes/utils/google-maps-tour-url";
import {
  executeJoyVoiceIntentAction,
} from "../actions/joy-voice-mode-actions";
import { logJoyVoiceDiag } from "../diag-logger";
import { parseJoyVoiceIntent } from "../parse-voice-intent";
import {
  shouldSuspendMic,
  tryTransitionJoyGuideState,
} from "../state-machine";
import type {
  JoyGuideScreenContext,
  JoyGuideState,
  JoyVoiceActionUi,
  JoyVoiceIntentResult,
} from "../types";
import { JOY_GUIDE_STATE_LABELS } from "../types";

interface JoyGuideModeScreenProps {
  userDisplayName: string;
  initialContext?: JoyGuideScreenContext;
  onExit?: () => void;
}

export function JoyGuideModeScreen({
  userDisplayName,
  initialContext,
  onExit,
}: JoyGuideModeScreenProps) {
  const [state, setState] = useState<JoyGuideState>("idle");
  const [lastTranscript, setLastTranscript] = useState("");
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [proposedAction, setProposedAction] = useState<string | null>(null);
  const [spokenReply, setSpokenReply] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsTapResume, setNeedsTapResume] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [actionUi, setActionUi] = useState<JoyVoiceActionUi | null>(null);
  const [pendingIntent, setPendingIntent] = useState<JoyVoiceIntentResult | null>(
    null
  );
  const [context, setContext] = useState<JoyGuideScreenContext>(
    () => initialContext ?? {}
  );
  const [sessionActive, setSessionActive] = useState(false);

  const wantListeningRef = useRef(false);
  const busyRef = useRef(false);
  const stateRef = useRef<JoyGuideState>("idle");
  const pendingRef = useRef<JoyVoiceIntentResult | null>(null);
  const contextRef = useRef(context);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    pendingRef.current = pendingIntent;
  }, [pendingIntent]);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  const setGuideState = useCallback((next: JoyGuideState) => {
    setState((current) => {
      const resolved = tryTransitionJoyGuideState(current, next);
      stateRef.current = resolved;
      logJoyVoiceDiag("state", { state: resolved });
      return resolved;
    });
  }, []);

  const {
    isSupported: speechSupported,
    isListening,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    lang: "it-IT",
    onFinalChunk: (chunk) => {
      if (busyRef.current || shouldSuspendMic(stateRef.current)) {
        return;
      }
      if (stateRef.current === "paused") {
        return;
      }
      const text = chunk.trim();
      if (text.length < 2) return;
      void handleUtterance(text);
    },
  });

  const speakThenListen = useCallback(
    async (text: string, options?: { confirming?: boolean }) => {
      stopListening();
      setGuideState("speaking");
      setSpokenReply(text);
      const ttsStart = Date.now();
      try {
        await speakItalian(text);
        logJoyVoiceDiag("tts_done", { ttsMs: Date.now() - ttsStart, state: "speaking" });
      } catch {
        setErrorMessage("Errore voce. Puoi continuare a scrivere.");
        setGuideState("error");
        logJoyVoiceDiag("tts_error", { errorCode: "tts", ttsMs: Date.now() - ttsStart });
      }

      if (!wantListeningRef.current) {
        setGuideState("idle");
        return;
      }
      if (options?.confirming) {
        setGuideState("confirming");
      }
      window.setTimeout(() => {
        if (!wantListeningRef.current || stateRef.current === "paused") {
          return;
        }
        try {
          startListening();
          setGuideState(options?.confirming ? "confirming" : "listening");
          setNeedsTapResume(false);
        } catch {
          setNeedsTapResume(true);
          setGuideState("paused");
        }
      }, 350);
    },
    [setGuideState, startListening, stopListening]
  );

  const handleUtterance = useCallback(
    async (text: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      stopListening();
      setLastTranscript(text);
      setErrorMessage(null);
      setActionUi(null);

      const interpretStart = Date.now();
      setGuideState("interpreting");

      try {
        // Pending confirmation short-circuit
        if (pendingRef.current) {
          const decision = parseJoyVoiceIntent(text, contextRef.current);
          if (decision.intent === "confirm") {
            const toConfirm = pendingRef.current;
            if (!toConfirm) {
              await speakThenListen("Non c'è nulla da confermare.");
              return;
            }
            setGuideState("executing");
            const result = await executeJoyVoiceIntentAction({
              intent: toConfirm,
              context: contextRef.current,
              confirmed: true,
            });
            setPendingIntent(null);
            pendingRef.current = null;
            setInterpretation(toConfirm.interpretation);
            setProposedAction(null);
            if (result.ui) setActionUi(result.ui);
            if (result.data && typeof result.data === "object") {
              const nextStop = (result.data as { nextStop?: { companyId?: string; name?: string } })
                .nextStop;
              if (nextStop?.companyId) {
                setContext((c) => ({
                  ...c,
                  nextStopCompanyId: nextStop.companyId,
                  nextStopName: nextStop.name ?? null,
                  companyId: nextStop.companyId,
                  companyName: nextStop.name ?? null,
                }));
              }
              const companyId = (result.data as { companyId?: string }).companyId;
              const companyName = (result.data as { companyName?: string }).companyName;
              if (companyId) {
                setContext((c) => ({
                  ...c,
                  companyId,
                  companyName: companyName ?? c.companyName,
                }));
              }
            }
            await speakThenListen(result.spokenReply);
            return;
          }
          if (decision.intent === "cancel") {
            setPendingIntent(null);
            pendingRef.current = null;
            setProposedAction(null);
            setInterpretation("Annullato");
            await speakThenListen("Ok, annullo.");
            return;
          }
        }

        const intent = parseJoyVoiceIntent(text, contextRef.current);
        setInterpretation(intent.interpretation);
        setProposedAction(intent.proposedAction);
        logJoyVoiceDiag("interpret", {
          intent: intent.intent,
          confidence: intent.confidence,
          interpretMs: Date.now() - interpretStart,
        });

        if (intent.intent === "register_visit" || intent.intent === "complete_visit") {
          if (!intent.entities.notes || intent.spokenReply.includes("Dimmi com")) {
            setContext((c) => ({ ...c, visitStatus: "awaiting_debrief" }));
            setPendingIntent(null);
            await speakThenListen(intent.spokenReply);
            return;
          }
        }

        setGuideState("executing");
        const result = await executeJoyVoiceIntentAction({
          intent,
          context: contextRef.current,
          confirmed: false,
        });

        if (result.needsConfirmation && result.pendingIntent) {
          setPendingIntent(result.pendingIntent);
          pendingRef.current = result.pendingIntent;
          setGuideState("confirming");
          await speakThenListen(result.spokenReply, { confirming: true });
          return;
        }

        if (result.ui) setActionUi(result.ui);

        if (result.data && typeof result.data === "object") {
          const data = result.data as Record<string, unknown>;
          if (data.nextStop && typeof data.nextStop === "object") {
            const stop = data.nextStop as {
              companyId?: string;
              name?: string;
              city?: string | null;
              lat?: number | null;
              lng?: number | null;
            };
            setContext((c) => ({
              ...c,
              tourId: (data.tourId as string) ?? c.tourId,
              nextStopCompanyId: stop.companyId ?? null,
              nextStopName: stop.name ?? null,
              nextStopCity: stop.city ?? null,
              nextStopLat: stop.lat ?? null,
              nextStopLng: stop.lng ?? null,
              companyId: stop.companyId ?? c.companyId,
              companyName: stop.name ?? c.companyName,
              visitStatus: null,
            }));
          }
          if (typeof data.companyId === "string") {
            setContext((c) => ({
              ...c,
              companyId: data.companyId as string,
              companyName: (data.companyName as string) ?? c.companyName,
            }));
          }
          if (typeof data.tourId === "string") {
            setContext((c) => ({ ...c, tourId: data.tourId as string }));
          }
        }

        if (!result.success && intent.intent === "unknown") {
          await speakThenListen(result.spokenReply || intent.spokenReply);
          return;
        }

        await speakThenListen(result.spokenReply || intent.spokenReply);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Errore durante l'elaborazione.";
        setErrorMessage(message.slice(0, 160));
        setGuideState("error");
        await speakThenListen("C'è stato un problema. Riprova o scrivi il comando.");
      } finally {
        busyRef.current = false;
      }
    },
    [setGuideState, speakThenListen, stopListening]
  );

  const startGuideMode = useCallback(async () => {
    unlockJoyAudioFromUserGesture();
    stopSpeaking();
    wantListeningRef.current = true;
    setSessionActive(true);
    setNeedsTapResume(false);
    setErrorMessage(null);
    setPendingIntent(null);
    pendingRef.current = null;
    setActionUi(null);
    setGuideState("speaking");
    try {
      await speakItalian("Modalità guida attiva. Dimmi cosa vuoi fare.");
    } catch {
      setErrorMessage("Audio non disponibile. Puoi scrivere i comandi.");
    }
    if (speechSupported) {
      try {
        startListening();
        setGuideState("listening");
      } catch {
        setNeedsTapResume(true);
        setGuideState("paused");
      }
    } else {
      setShowTextInput(true);
      setGuideState("idle");
    }
  }, [setGuideState, speechSupported, startListening]);

  const pauseGuide = useCallback(() => {
    wantListeningRef.current = false;
    stopListening();
    stopSpeaking();
    setGuideState("paused");
  }, [setGuideState, stopListening]);

  const resumeGuide = useCallback(() => {
    unlockJoyAudioFromUserGesture();
    wantListeningRef.current = true;
    setNeedsTapResume(false);
    try {
      startListening();
      setGuideState("listening");
    } catch {
      setNeedsTapResume(true);
      setGuideState("paused");
    }
  }, [setGuideState, startListening]);

  const interruptGuide = useCallback(() => {
    stopSpeaking();
    stopListening();
    wantListeningRef.current = false;
    setSessionActive(false);
    setPendingIntent(null);
    setGuideState("idle");
  }, [setGuideState, stopListening]);

  const repeatLast = useCallback(() => {
    if (!spokenReply) return;
    unlockJoyAudioFromUserGesture();
    void speakThenListen(spokenReply, {
      confirming: Boolean(pendingRef.current),
    });
  }, [speakThenListen, spokenReply]);

  const cancelPending = useCallback(() => {
    setPendingIntent(null);
    pendingRef.current = null;
    setProposedAction(null);
    void speakThenListen("Ok, annullo.");
  }, [speakThenListen]);

  // iOS visibility / pageshow — never auto-start mic; only flag resume
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (wantListeningRef.current) {
          stopListening();
          setNeedsTapResume(true);
        }
        return;
      }
      if (wantListeningRef.current && sessionActive && stateRef.current !== "paused") {
        setNeedsTapResume(true);
        setGuideState("paused");
      }
    };
    const onPageShow = () => {
      if (wantListeningRef.current && sessionActive) {
        setNeedsTapResume(true);
        setGuideState("paused");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      stopSpeaking();
      stopListening();
    };
  }, [sessionActive, setGuideState, stopListening]);

  // Derive resume prompt from speech errors without setState-in-effect
  const speechNeedsResume =
    sessionActive &&
    Boolean(speechError) &&
    !/aborted/i.test(speechError ?? "");
  const showTapResume = needsTapResume || speechNeedsResume;
  const displayError =
    errorMessage ||
    (speechNeedsResume ? speechError : null);

  const stateLabel = JOY_GUIDE_STATE_LABELS[
    speechNeedsResume && state !== "error" ? "paused" : state
  ];

  if (!sessionActive) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
        <header className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
              JOY Guida
            </p>
            <p className="mt-0.5 text-sm text-slate-300">Ciao {userDisplayName}</p>
          </div>
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200"
            >
              Indietro
            </button>
          ) : (
            <Link
              href="/joy-ai"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200"
            >
              Joy AI
            </Link>
          )}
        </header>
        <div className="flex flex-1 flex-col justify-center gap-4 px-4 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))]">
          <p className="text-center text-sm text-slate-300">
            Un tap per parlare con Joy durante il giro. Conferma vocale sulle azioni che
            modificano i dati.
          </p>
          <button
            type="button"
            data-testid="joy-start-guide-mode"
            onClick={() => void startGuideMode()}
            className="flex min-h-[4.5rem] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 text-lg font-semibold shadow-lg active:scale-[0.98]"
          >
            <Mic className="h-6 w-6" />
            Avvia modalità guida
          </button>
          {!speechSupported ? (
            <p className="text-center text-xs text-amber-200">
              Microfono non supportato: dopo l&apos;avvio usa «Scrivi comando».
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white"
      data-testid="joy-guide-mode-screen"
      data-joy-state={state}
    >
      <header className="border-b border-white/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
              Modalità guida
            </p>
            <p
              className="mt-0.5 text-base font-semibold"
              data-testid="joy-guide-state-label"
            >
              {stateLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={interruptGuide}
            className="rounded-xl border border-white/15 bg-white/5 p-2.5"
            aria-label="Interrompi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {(context.companyName || context.nextStopName) && (
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
            {context.companyName ? (
              <p>
                Azienda: <span className="font-medium text-white">{context.companyName}</span>
              </p>
            ) : null}
            {context.nextStopName ? (
              <p className="mt-0.5">
                Prossima:{" "}
                <span className="font-medium text-white">{context.nextStopName}</span>
                {context.nextStopCity ? ` · ${context.nextStopCity}` : ""}
                {context.nextStopEtaMinutes != null
                  ? ` · ~${context.nextStopEtaMinutes} min`
                  : ""}
              </p>
            ) : null}
          </div>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {showTapResume ? (
          <button
            type="button"
            data-testid="joy-tap-to-resume"
            onClick={resumeGuide}
            className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-500/20 px-4 text-sm font-semibold text-amber-50"
          >
            Tocca per riprendere JOY
          </button>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Ultima frase</p>
          <p className="mt-1 text-sm text-white" data-testid="joy-last-transcript">
            {lastTranscript || interimTranscript || "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Interpretazione</p>
          <p className="mt-1 text-sm text-white">{interpretation || "—"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Azione proposta</p>
          <p className="mt-1 text-sm text-white">{proposedAction || "—"}</p>
          {spokenReply ? (
            <p className="mt-2 text-xs text-slate-300">{spokenReply}</p>
          ) : null}
        </div>

        {actionUi?.href && actionUi.label ? (
          <a
            href={actionUi.href}
            target={actionUi.kind === "navigate" ? GOOGLE_MAPS_LINK_TARGET : undefined}
            rel="noopener noreferrer"
            data-testid="joy-guide-primary-action"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 text-base font-semibold text-white shadow-lg active:scale-[0.98]"
          >
            {actionUi.kind === "navigate" ? <Navigation className="h-5 w-5" /> : null}
            {actionUi.label}
          </a>
        ) : null}

        {displayError ? (
          <p className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
            {displayError}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 rounded-xl border-white/20 bg-white/5 text-white"
            onClick={() =>
              void handleUtterance("Avvia la prossima tappa")
            }
          >
            Avvia prossima tappa
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 rounded-xl border-white/20 bg-white/5 text-white"
            onClick={() => void handleUtterance("Registra visita")}
          >
            Registra visita
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 rounded-xl border-white/20 bg-white/5 text-white"
            onClick={() => void handleUtterance("Visita completata")}
          >
            Completa visita
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 rounded-xl border-white/20 bg-white/5 text-white"
            onClick={pauseGuide}
          >
            Pausa JOY
          </Button>
        </div>
      </div>

      <footer className="border-t border-white/10 bg-slate-950 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-2 flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={pauseGuide}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-medium"
          >
            <Pause className="h-4 w-4" /> Pausa
          </button>
          <button
            type="button"
            onClick={resumeGuide}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-medium"
          >
            <Play className="h-4 w-4" /> Riprendi
          </button>
          <button
            type="button"
            onClick={interruptGuide}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-medium"
          >
            <Square className="h-4 w-4" /> Interrompi
          </button>
          <button
            type="button"
            onClick={repeatLast}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-medium"
          >
            <RotateCcw className="h-4 w-4" /> Ripeti
          </button>
          <button
            type="button"
            onClick={cancelPending}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-medium"
          >
            Annulla
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isListening ? "In ascolto" : "Microfono"}
            onClick={() => {
              if (isListening) {
                pauseGuide();
              } else {
                resumeGuide();
              }
            }}
            className={`flex min-h-12 min-w-12 items-center justify-center rounded-xl ${
              isListening
                ? "bg-emerald-500 text-white"
                : "border border-white/20 bg-white/5 text-white"
            }`}
          >
            {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          {showTextInput ? (
            <form
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const value = textDraft.trim();
                if (!value) return;
                setTextDraft("");
                void handleUtterance(value);
              }}
            >
              <input
                data-testid="joy-write-command-input"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="Scrivi comando…"
                className="min-h-12 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none ring-emerald-500 focus:ring-2"
                enterKeyHint="send"
                autoComplete="off"
              />
              <Button type="submit" className="min-h-12 rounded-xl px-4">
                Invia
              </Button>
            </form>
          ) : (
            <button
              type="button"
              data-testid="joy-write-command"
              onClick={() => setShowTextInput(true)}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-medium"
            >
              Scrivi comando
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
