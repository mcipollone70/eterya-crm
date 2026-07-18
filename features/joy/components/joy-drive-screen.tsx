"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  MoreHorizontal,
  Route,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useSpeechRecognition } from "@/features/voice/hooks/use-speech-recognition";
import {
  buildSpokenSummary,
  joyVoice,
  speakItalian,
  stopSpeaking,
  unlockJoyAudioFromUserGesture,
} from "@/lib/voice/joy-voice-queue";
import { JoyVoiceControls } from "./joy-voice-controls";
import { executeJoyCopilotActionBatch } from "../chat/actions/joy-copilot-actions";
import { JoyChatMessageBubble } from "../chat/components/joy-chat-message";
import { JoyCopilotToast } from "../chat/components/joy-copilot-toast";
import type { JoyChatMessage, JoyDebriefFieldKey } from "../chat/types/joy-chat";
import type { JoyConversationMemory, JoySessionState } from "../chat/types/joy-session";
import {
  extractMemoryFromAssistantMessage,
  extractMemoryHintsFromUserText,
  formatMemoryBadge,
  loadJoyConversationMemory,
  mergeJoyConversationMemory,
  persistJoyConversationMemory,
} from "../chat/utils/joy-conversation-memory";
import {
  applyJoyDebriefVoiceEdit,
  filterDebriefOperationsForConfirm,
  isJoyDebriefVoiceEdit,
} from "../chat/utils/parse-joy-debrief";
import { persistJoyTourProposal } from "../chat/utils/joy-tour-proposal-storage";
import { streamJoyChatMessage } from "../chat/utils/stream-joy-chat";
import { isJoySuggestionActive } from "../chat/utils/joy-suggestion-preferences";
import {
  clearJoyDayOps,
  formatJoyDayOpsBrief,
  loadJoyDayOps,
  markJoyDayStart,
  setJoyDayNextAction,
  setJoyDayPosition,
} from "../os/client";
import { JoySessionStatusBar } from "./joy-session-status-bar";

const MORNING_PROMPT = "Prepara la mia giornata";

type DriveHomeAction =
  | "talk"
  | "plan_day"
  | "register_visit"
  | "next_action"
  | "eod";

const PRIMARY_DRIVE_ACTIONS: Array<{
  id: Exclude<DriveHomeAction, "eod">;
  label: string;
  emoji: string;
  icon: typeof Mic;
  tone: string;
}> = [
  {
    id: "talk",
    label: "Parla con Joy",
    emoji: "🎤",
    icon: Mic,
    tone: "from-indigo-600 to-violet-600",
  },
  {
    id: "plan_day",
    label: "Inizia la giornata",
    emoji: "📋",
    icon: ClipboardList,
    tone: "from-amber-500 to-orange-600",
  },
  {
    id: "register_visit",
    label: "Registra una visita",
    emoji: "✅",
    icon: CheckCircle2,
    tone: "from-emerald-500 to-teal-600",
  },
  {
    id: "next_action",
    label: "Organizza il giro",
    emoji: "⚡",
    icon: Zap,
    tone: "from-sky-500 to-blue-600",
  },
];

const SECONDARY_LINKS: Array<{
  href: string;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/giro-visite", label: "Giro", icon: Route },
  { href: "/companies", label: "Aziende", icon: Building2 },
  { href: "/joy-ai", label: "Altro", icon: MoreHorizontal },
];

const EOD_DRIVE_ACTION = {
  id: "eod" as const,
  label: "Fine giornata",
  emoji: "✅",
  icon: CheckCircle2,
  tone: "from-slate-600 to-slate-800",
};

const DRIVE_ACTIONS = [...PRIMARY_DRIVE_ACTIONS, EOD_DRIVE_ACTION];

const PLAN_DAY_PROMPT = "Inizia la giornata";
const NEXT_ACTION_PROMPT = "Organizza il mio giro visite per oggi";
const EOD_PROMPT = "Riepiloga la mia giornata";
const TOUR_PROMPT = "Organizza il mio giro";

function readDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120_000 }
    );
  });
}

function newMessage(
  role: JoyChatMessage["role"],
  content: string,
  extras?: Partial<JoyChatMessage>
): JoyChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extras,
  };
}

interface JoyDriveScreenProps {
  userDisplayName: string;
}

export function JoyDriveScreen({ userDisplayName }: JoyDriveScreenProps) {
  const router = useRouter();
  const [view, setView] = useState<"home" | "session">("home");
  const [activeAction, setActiveAction] = useState<DriveHomeAction | null>(null);
  const [messages, setMessages] = useState<JoyChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [executingCopilotId, setExecutingCopilotId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const [conversationMode, setConversationMode] = useState(false);
  const [awaitingCompanyName, setAwaitingCompanyName] = useState(false);
  const [sessionOverride, setSessionOverride] = useState<JoySessionState | null>(null);
  const [memory, setMemory] = useState<JoyConversationMemory>(() =>
    typeof window === "undefined" ? {} : loadJoyConversationMemory()
  );
  const [textDraft, setTextDraft] = useState("");
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator === "undefined" ? true : navigator.onLine)
  );
  const [dayOpsBrief, setDayOpsBrief] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      markJoyDayStart();
      return formatJoyDayOpsBrief(loadJoyDayOps());
    } catch {
      return null;
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voiceBufferRef = useRef("");
  const conversationModeRef = useRef(false);
  const awaitingCompanyRef = useRef(false);
  const isStreamingRef = useRef(false);
  const speakingRef = useRef(false);
  const wantListeningRef = useRef(false);
  const sendMessageRef = useRef<((text: string) => Promise<void>) | null>(null);
  const confirmCopilotRef = useRef<((messageId: string) => Promise<void>) | null>(null);
  const cancelCopilotRef = useRef<((messageId: string) => void) | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const pendingConfirm = messages.some(
    (message) => message.pendingAction?.status === "pending"
  );
  const hasCompletedAction = messages.some(
    (message) => message.pendingAction?.status === "executed"
  );

  const applyMemoryPatch = useCallback((patch: Partial<JoyConversationMemory>) => {
    setMemory((current) => {
      const next = mergeJoyConversationMemory(current, patch);
      persistJoyConversationMemory(next);
      return next;
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
      // Barge-in: interrompe TTS se l'utente parla durante la sintesi.
      if (speakingRef.current || joyVoice.getState() === "speaking" || joyVoice.getState() === "preparing" || joyVoice.getState() === "ready") {
        stopSpeaking();
        speakingRef.current = false;
      }
      if (isStreamingRef.current) {
        return;
      }

      voiceBufferRef.current = `${voiceBufferRef.current} ${chunk}`.trim();

      if (awaitingCompanyRef.current && voiceBufferRef.current.length > 2) {
        const name = voiceBufferRef.current;
        voiceBufferRef.current = "";
        awaitingCompanyRef.current = false;
        setAwaitingCompanyName(false);
        void sendMessageRef.current?.(`Apri ${name}`);
        return;
      }

      if (conversationModeRef.current && voiceBufferRef.current.length > 8) {
        const text = voiceBufferRef.current;
        voiceBufferRef.current = "";
        void sendMessageRef.current?.(text);
      }
    },
  });

  const sessionState: JoySessionState = (() => {
    if (pendingConfirm) return "confirming";
    if (isStreaming) return "thinking";
    if (sessionOverride) return sessionOverride;
    if (conversationMode || isListening) return "listening";
    if (hasCompletedAction) return "completed";
    return "idle";
  })();

  const memoryLabel = formatMemoryBadge(memory);

  useEffect(() => {
    conversationModeRef.current = conversationMode;
  }, [conversationMode]);

  useEffect(() => {
    awaitingCompanyRef.current = awaitingCompanyName;
  }, [awaitingCompanyName]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    if (!speechError) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast({ message: speechError, variant: "error" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [speechError]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages, isStreaming, executingCopilotId]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      abortRef.current?.abort();
    };
  }, []);

  const resumeListeningSoon = useCallback(() => {
    if (!wantListeningRef.current || !speechSupported) {
      return;
    }
    window.setTimeout(() => {
      if (wantListeningRef.current && !speakingRef.current && !isStreamingRef.current) {
        startListening();
        setSessionOverride("listening");
      }
    }, 400);
  }, [speechSupported, startListening]);

  const speakAndResume = useCallback(
    async (content: string, options?: { confirming?: boolean }) => {
      const summary = options?.confirming
        ? "Ho una proposta. Conferma, modifica o di' un comando."
        : buildSpokenSummary(content);

      if (!summary) {
        resumeListeningSoon();
        return;
      }

      speakingRef.current = true;
      stopListening();
      try {
        await speakItalian(summary, { displayText: content });
      } finally {
        speakingRef.current = false;
        resumeListeningSoon();
      }
    },
    [resumeListeningSoon, stopListening]
  );

  // Keep mic alive while Drive conversation / search listening is requested.
  // Also during conferma proposta: comandi mid-tour (salta, maps, …) restano vocali.
  useEffect(() => {
    if (!wantListeningRef.current || !speechSupported) {
      return;
    }
    if (isListening || isStreaming || speakingRef.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (wantListeningRef.current && !speakingRef.current && !isStreamingRef.current) {
        startListening();
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [isListening, isStreaming, pendingConfirm, speechSupported, startListening, sessionState]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreamingRef.current) {
        return;
      }

      if (!navigator.onLine) {
        setIsOnline(false);
        setToast({
          message: "Sei offline. Riprova quando la connessione è stabile.",
          variant: "error",
        });
        void speakItalian("Sei offline. Riprova quando torni online.");
        return;
      }

      if (/fine\s+sessione|chiudi\s+(sessione|conversazione)|fine\s+conversazione/i.test(trimmed)) {
        wantListeningRef.current = false;
        setConversationMode(false);
        stopListening();
        stopSpeaking();
        setSessionOverride("idle");
        setView("home");
        setActiveAction(null);
        setAwaitingCompanyName(false);
        return;
      }

      const pendingMsg = messages.find(
        (message) => message.pendingAction?.status === "pending"
      );
      if (pendingMsg) {
        if (
          /^(conferma|confermo|si|sì|ok|va bene|procedi|salva|apri|vai)(?:\s+per favore)?[.!?]*$/i.test(
            trimmed
          )
        ) {
          setMessages((current) => [...current, newMessage("user", trimmed)]);
          await confirmCopilotRef.current?.(pendingMsg.id);
          return;
        }
        if (
          /^(annulla|no|cancella|lascia stare|non salvare)(?:\s+per favore)?[.!?]*$/i.test(
            trimmed
          )
        ) {
          setMessages((current) => [...current, newMessage("user", trimmed)]);
          cancelCopilotRef.current?.(pendingMsg.id);
          return;
        }
      }

      // Edit vocale su debrief in conferma (togli opportunità, probabilità 60%, …)
      if (isJoyDebriefVoiceEdit(trimmed)) {
        const pendingMsg = messages.find(
          (message) =>
            message.pendingAction?.status === "pending" &&
            message.pendingAction.debriefFields &&
            message.pendingAction.debriefFields.length > 0
        );
        if (pendingMsg?.pendingAction) {
          const patched = applyJoyDebriefVoiceEdit(pendingMsg.pendingAction, trimmed);
          if (patched) {
            setMessages((current) => [
              ...current.map((message) =>
                message.id === pendingMsg.id
                  ? { ...message, pendingAction: patched }
                  : message
              ),
              newMessage("user", trimmed),
              newMessage(
                "assistant",
                `Ok. ${patched.description}. Conferma quando sei pronto.`
              ),
            ]);
            void speakItalian(`Ok. ${patched.description}.`);
            setSessionOverride("confirming");
            return;
          }
        }
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      applyMemoryPatch(extractMemoryHintsFromUserText(trimmed));

      const userMessage = newMessage("user", trimmed);
      const placeholderId = `joy-drive-stream-${Date.now()}`;
      setMessages((current) => [
        ...current,
        userMessage,
        newMessage("assistant", "", { id: placeholderId }),
      ]);
      setIsStreaming(true);
      setStreamingMessageId(placeholderId);
      setSessionOverride("thinking");
      stopListening();

      try {
        const location =
          lastLocationRef.current ??
          (await readDeviceLocation().then((coords) => {
            if (coords) {
              lastLocationRef.current = coords;
              applyMemoryPatch({ lastLat: coords.lat, lastLng: coords.lng });
            }
            return coords;
          }));

        const result = await streamJoyChatMessage({
          message: trimmed,
          companyId: memory.selectedClientId ?? memory.lastCompanyId ?? null,
          memory,
          latitude: location?.lat ?? memory.lastLat ?? null,
          longitude: location?.lng ?? memory.lastLng ?? null,
          guideMode: true,
          driveMode: true,
          signal: controller.signal,
          onMeta: (meta, extras) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === placeholderId
                  ? { ...message, ...meta, content: message.content }
                  : message
              )
            );
            setStreamingMessageId(meta.id);
            if (extras?.memoryPatch) {
              applyMemoryPatch(extras.memoryPatch);
            }
            if (extras?.sessionState === "confirming") {
              setSessionOverride("confirming");
            } else if (extras?.sessionState === "proposing") {
              setSessionOverride("proposing");
            }
          },
          onChunk: (chunk) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === placeholderId
                  ? { ...message, content: `${message.content}${chunk}` }
                  : message
              )
            );
          },
        });

        setMessages((current) =>
          current.map((message) =>
            message.id === placeholderId ? result.message : message
          )
        );

        applyMemoryPatch(extractMemoryFromAssistantMessage(result.message));
        if (result.memoryPatch) {
          applyMemoryPatch(result.memoryPatch);
        }

        const confirming = result.message.pendingAction?.status === "pending";
        if (confirming) {
          // Drive: mantieni ascolto per «conferma»/«annulla» e comandi mid-tour.
          wantListeningRef.current = true;
          setConversationMode(true);
          conversationModeRef.current = true;
          setSessionOverride("confirming");
        } else if (result.sessionState === "proposing") {
          setSessionOverride("proposing");
          if (activeAction === "plan_day" || conversationModeRef.current) {
            wantListeningRef.current = true;
            setConversationMode(true);
            conversationModeRef.current = true;
          }
        } else if (conversationModeRef.current) {
          setSessionOverride("listening");
        } else {
          setSessionOverride("completed");
        }

        if (result.error) {
          setToast({ message: result.error, variant: "error" });
        }

        await speakAndResume(result.message.content, { confirming });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Errore durante la risposta di Joy.";
        setMessages((current) =>
          current.map((item) =>
            item.id === placeholderId ? { ...item, content: message } : item
          )
        );
        setToast({ message, variant: "error" });
        setSessionOverride(conversationModeRef.current ? "listening" : "idle");
        resumeListeningSoon();
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
        abortRef.current = null;
      }
    },
    [
      activeAction,
      applyMemoryPatch,
      memory,
      messages,
      resumeListeningSoon,
      speakAndResume,
      stopListening,
    ]
  );

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  /** Mattina / fine giornata: avvio automatico una volta al giorno su Joy Drive. */
  useEffect(() => {
    if (view !== "home") {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const hour = new Date().getHours();
    const dayKey = new Date().toISOString().slice(0, 10);
    let prompt: string | null = null;
    let storageKey: string | null = null;

    if (hour >= 6 && hour < 11) {
      storageKey = `joy-drive-auto-morning-${dayKey}`;
      prompt = MORNING_PROMPT;
      if (!isJoySuggestionActive("auto-morning", "morning")) {
        return;
      }
    } else if (hour >= 17 && hour < 21) {
      storageKey = `joy-drive-auto-eod-${dayKey}`;
      prompt = EOD_PROMPT;
      if (!isJoySuggestionActive("auto-eod", "eod")) {
        return;
      }
    }

    if (!prompt || !storageKey) {
      return;
    }

    try {
      if (window.sessionStorage.getItem(storageKey)) {
        return;
      }
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveAction(prompt === EOD_PROMPT ? "eod" : "talk");
      setView("session");
      setConversationMode(true);
      conversationModeRef.current = true;
      wantListeningRef.current = true;
      setSessionOverride("thinking");
      void sendMessageRef.current?.(prompt!);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [view]);

  const openSession = useCallback(
    async (action: DriveHomeAction) => {
      // Sync nel tap: sblocca HTMLAudioElement prima di qualsiasi await (iOS PWA).
      unlockJoyAudioFromUserGesture();
      stopSpeaking();
      abortRef.current?.abort();
      setMessages([]);
      setActiveAction(action);
      setView("session");
      setAwaitingCompanyName(false);
      awaitingCompanyRef.current = false;
      voiceBufferRef.current = "";

      if (action === "talk") {
        setConversationMode(true);
        conversationModeRef.current = true;
        wantListeningRef.current = true;
        setSessionOverride("listening");
        setMessages([
          newMessage(
            "assistant",
            "Sono in ascolto. Dimmi cosa ti serve. Per chiudere: «fine sessione»."
          ),
        ]);
        speakingRef.current = true;
        stopListening();
        try {
          await speakItalian("Sono in ascolto. Dimmi cosa ti serve.");
        } finally {
          speakingRef.current = false;
        }
        if (speechSupported) {
          startListening();
        }
        return;
      }

      setConversationMode(true);
      conversationModeRef.current = true;
      wantListeningRef.current = false;
      stopListening();
      setSessionOverride("thinking");

      if (action === "register_visit") {
        setMessages([
          newMessage(
            "assistant",
            "Dimmi l'esito della visita (es. «Joy registra visita da Rossi, interessati a VEPA, richiama venerdì»). Bozza modificabile — nessun salvataggio senza conferma."
          ),
        ]);
        wantListeningRef.current = true;
        setSessionOverride("listening");
        speakingRef.current = true;
        try {
          await speakItalian("Dimmi l'esito della visita.");
        } finally {
          speakingRef.current = false;
        }
        if (speechSupported) {
          startListening();
        }
        return;
      }

      const location = await readDeviceLocation();
      if (location) {
        lastLocationRef.current = location;
        setJoyDayPosition({
          lat: location.lat,
          lng: location.lng,
          label: "GPS dispositivo",
        });
      }

      const prompt =
        action === "plan_day"
          ? PLAN_DAY_PROMPT
          : action === "next_action"
            ? NEXT_ACTION_PROMPT
            : EOD_PROMPT;

      if (action === "next_action") {
        setJoyDayNextAction(prompt);
      }

      void sendMessage(prompt);
    },
    [sendMessage, speechSupported, startListening, stopListening]
  );

  const handleBackHome = () => {
    wantListeningRef.current = false;
    setConversationMode(false);
    conversationModeRef.current = false;
    setAwaitingCompanyName(false);
    awaitingCompanyRef.current = false;
    stopListening();
    stopSpeaking();
    abortRef.current?.abort();
    setSessionOverride("idle");
    setView("home");
    setActiveAction(null);
    setMessages([]);
  };

  const handleConfirmCopilot = useCallback(
    async (messageId: string) => {
      const target = messages.find((message) => message.id === messageId);
      const pending = target?.pendingAction;
      if (!pending || pending.status !== "pending") {
        return;
      }

      const filtered = filterDebriefOperationsForConfirm(pending);
      if (!filtered.operation) {
        setToast({
          message: "Seleziona almeno un campo da salvare.",
          variant: "error",
        });
        return;
      }

      setExecutingCopilotId(pending.id);
      setSessionOverride("thinking");

      try {
        const result = await executeJoyCopilotActionBatch(
          filtered.operation,
          filtered.followUpOperations
        );

        setMessages((current) =>
          current.map((message) => {
            if (message.id !== messageId || !message.pendingAction) {
              return message;
            }
            return {
              ...message,
              pendingAction: {
                ...message.pendingAction,
                status: result.success ? "executed" : "failed",
              },
              content: result.success
                ? `${message.content}\n\n✓ ${result.message}`
                : `${message.content}\n\n✗ ${result.message}`,
            };
          })
        );

        if (result.success) {
          setToast({ message: result.message, variant: "success" });
          setSessionOverride("completed");

          // Persisti proposta giro per /giro-visite (oltre ai query params nell'href)
          const draft = memory.tourDraft;
          if (
            pending.operation.type === "navigate" &&
            pending.operation.href?.includes("/giro-visite") &&
            draft?.stopCompanyIds &&
            draft.stopCompanyIds.length > 0
          ) {
            const href = new URL(pending.operation.href, "https://local.invalid");
            persistJoyTourProposal({
              stopCompanyIds: draft.stopCompanyIds,
              origin: {
                lat: Number(href.searchParams.get("olat") ?? draft.lastLat ?? memory.lastLat ?? 0),
                lng: Number(href.searchParams.get("olng") ?? draft.lastLng ?? memory.lastLng ?? 0),
                label: href.searchParams.get("olabel") ?? "Partenza Joy",
              },
              destination: {
                lat: Number(href.searchParams.get("dlat") ?? draft.lastLat ?? 0),
                lng: Number(href.searchParams.get("dlng") ?? draft.lastLng ?? 0),
                label: href.searchParams.get("to") ?? draft.endCity ?? "Arrivo",
              },
              day: draft.day ?? "today",
              createdAt: new Date().toISOString(),
            });
          }

          await speakItalian(result.message);
          router.refresh();
          if (result.href) {
            router.push(result.href);
            return;
          }
          if (conversationModeRef.current || activeAction === "talk") {
            wantListeningRef.current = true;
            setConversationMode(true);
            resumeListeningSoon();
          }
        } else {
          setToast({ message: result.message, variant: "error" });
          setSessionOverride("confirming");
          await speakItalian(result.message);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Esecuzione azione non riuscita.";
        setMessages((current) =>
          current.map((item) => {
            if (item.id !== messageId || !item.pendingAction) {
              return item;
            }
            return {
              ...item,
              pendingAction: { ...item.pendingAction, status: "failed" },
              content: `${item.content}\n\n✗ ${message}`,
            };
          })
        );
        setToast({ message, variant: "error" });
        setSessionOverride("idle");
      } finally {
        setExecutingCopilotId(null);
      }
    },
    [activeAction, memory, messages, resumeListeningSoon, router]
  );

  const handleCancelCopilot = useCallback(
    (messageId: string) => {
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId || !message.pendingAction) {
            return message;
          }
          return {
            ...message,
            pendingAction: {
              ...message.pendingAction,
              status: "cancelled",
            },
          };
        })
      );
      void speakItalian("Azione annullata.");
      if (conversationModeRef.current || activeAction === "talk") {
        wantListeningRef.current = true;
        setSessionOverride("listening");
        resumeListeningSoon();
      } else {
        setSessionOverride("idle");
      }
    },
    [activeAction, resumeListeningSoon]
  );

  useEffect(() => {
    confirmCopilotRef.current = handleConfirmCopilot;
    cancelCopilotRef.current = handleCancelCopilot;
  }, [handleConfirmCopilot, handleCancelCopilot]);

  const handleModifyCopilot = useCallback(
    (messageId: string) => {
      handleCancelCopilot(messageId);
      setConversationMode(true);
      conversationModeRef.current = true;
      wantListeningRef.current = true;
      voiceBufferRef.current = "Modifica il giro: ";
      setSessionOverride("listening");
      setMessages((current) => [
        ...current,
        newMessage(
          "assistant",
          "Dimmi come modificare la proposta. Esempio: «max 4 visite entro le 16»."
        ),
      ]);
      void speakItalian("Dimmi come modificare la proposta.");
      resumeListeningSoon();
    },
    [handleCancelCopilot, resumeListeningSoon]
  );

  const handleRegenerateCopilot = useCallback(
    (messageId: string) => {
      handleCancelCopilot(messageId);
      void sendMessage("Rigenera il giro");
    },
    [handleCancelCopilot, sendMessage]
  );

  const handleToggleDebriefField = useCallback(
    (messageId: string, key: JoyDebriefFieldKey) => {
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId || !message.pendingAction?.debriefFields) {
            return message;
          }
          const fields = message.pendingAction.debriefFields.map((field) =>
            field.key === key ? { ...field, enabled: !field.enabled } : field
          );
          const enabledLabels = fields.filter((f) => f.enabled).map((f) => f.label);
          return {
            ...message,
            pendingAction: {
              ...message.pendingAction,
              debriefFields: fields,
              description:
                enabledLabels.length > 0
                  ? `Salverò: ${enabledLabels.join(", ")}`
                  : "Nessun campo selezionato",
            },
          };
        })
      );
    },
    []
  );

  if (view === "home") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
        <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
              JOY OS
            </p>
            <p className="mt-0.5 text-sm text-slate-300">Ciao {userDisplayName}</p>
            {dayOpsBrief ? (
              <p className="mt-1 max-w-[16rem] truncate text-[11px] text-slate-400">
                Oggi: {dayOpsBrief}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                clearJoyDayOps();
                setDayOpsBrief(null);
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-[10px] font-medium text-slate-300"
              title="Cancella memoria operativa del giorno"
            >
              Reset giorno
            </button>
            <Link
              href="/joy-ai"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200"
            >
              Joy AI
            </Link>
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-3 px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {!isOnline ? (
            <p className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-center text-xs text-amber-100">
              Offline — Joy richiede connessione per parlare col CRM. Nessuna azione salvata.
            </p>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-[11px] text-slate-300">
              CRM = motore dati · Joy = interfaccia. Nessun salvataggio senza conferma.
            </p>
          )}
          {PRIMARY_DRIVE_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => void openSession(action.id)}
                className={`flex min-h-[4.25rem] w-full items-center gap-4 rounded-2xl bg-gradient-to-r ${action.tone} px-5 py-3.5 text-left shadow-lg transition active:scale-[0.98]`}
              >
                <span className="text-2xl" aria-hidden>
                  {action.emoji}
                </span>
                <span className="flex-1 text-base font-semibold leading-tight sm:text-lg">
                  {action.label}
                </span>
                <Icon className="h-5 w-5 opacity-90" />
              </button>
            );
          })}

          <div className="mt-2 grid grid-cols-4 gap-2">
            {SECONDARY_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/5 px-1 py-2 text-[11px] font-medium text-slate-200 transition active:scale-[0.98]"
                >
                  <Icon className="h-4 w-4 opacity-80" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void openSession(EOD_DRIVE_ACTION.id)}
            className="mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition active:scale-[0.99]"
          >
            <EOD_DRIVE_ACTION.icon className="h-4 w-4 opacity-80" />
            {EOD_DRIVE_ACTION.label}
          </button>
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              abortRef.current?.abort();
              setMessages([]);
              setActiveAction("plan_day");
              setView("session");
              setConversationMode(true);
              conversationModeRef.current = true;
              setSessionOverride("thinking");
              void sendMessage(TOUR_PROMPT);
            }}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            <MapPin className="h-3.5 w-3.5" />
            Organizza giro visite (voce)
          </button>
        </div>

        {!speechSupported ? (
          <p className="px-4 pb-4 text-center text-xs text-amber-200">
            Microfono non supportato su questo browser. Usa Chrome o Edge su smartphone.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                Joy Drive
              </p>
              <p className="truncate text-sm font-semibold text-slate-900">
                {DRIVE_ACTIONS.find((item) => item.id === activeAction)?.label ?? "Sessione"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {speechSupported ? (
                <Button
                  type="button"
                  variant={isListening ? "primary" : "outline"}
                  size="sm"
                  className="min-h-11 min-w-11 rounded-xl"
                  onClick={() => {
                    if (isListening) {
                      wantListeningRef.current = false;
                      stopListening();
                      setSessionOverride("idle");
                      return;
                    }
                    wantListeningRef.current = true;
                    setConversationMode(true);
                    conversationModeRef.current = true;
                    startListening();
                    setSessionOverride("listening");
                  }}
                  title={isListening ? "Pausa microfono" : "Riprendi ascolto"}
                >
                  {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 rounded-xl px-3"
                onClick={handleBackHome}
              >
                <X className="h-4 w-4" />
                Menu
              </Button>
            </div>
          </div>
          <div className="mt-2">
            <JoySessionStatusBar
              state={sessionState}
              conversationMode={conversationMode || activeAction === "talk"}
              guideMode
              driveMode
              memoryLabel={memoryLabel}
            />
          </div>
          <div className="mt-2">
            <JoyVoiceControls compact />
          </div>
          {interimTranscript ? (
            <p className="mt-2 text-xs text-indigo-700">Ascolto: {interimTranscript}</p>
          ) : null}
          {!isOnline ? (
            <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              Offline — le richieste a Joy richiedono connessione.
            </p>
          ) : null}
          {pendingConfirm ? (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Di&apos; «conferma» o «annulla» — oppure tocca i pulsanti.
            </p>
          ) : null}
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4">
          {messages.map((message) => {
            const isCurrentlyStreaming =
              isStreaming && message.id === streamingMessageId && !message.content;
            return (
              <div key={message.id} className="space-y-2">
                <JoyChatMessageBubble
                  message={message}
                  executingCopilotId={executingCopilotId}
                  onConfirmCopilot={handleConfirmCopilot}
                  onCancelCopilot={handleCancelCopilot}
                  onModifyCopilot={handleModifyCopilot}
                  onRegenerateCopilot={handleRegenerateCopilot}
                  onToggleDebriefField={handleToggleDebriefField}
                />
                {isCurrentlyStreaming ? (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                    Sto pensando...
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <footer className="border-t border-slate-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = textDraft.trim();
              if (!value) return;
              setTextDraft("");
              void sendMessage(value);
            }}
          >
            <input
              type="text"
              value={textDraft}
              onChange={(event) => setTextDraft(event.target.value)}
              placeholder={
                speechSupported
                  ? "Scrivi se il microfono non basta…"
                  : "Scrivi il comando (microfono non disponibile)"
              }
              className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none ring-indigo-500 focus:ring-2"
              enterKeyHint="send"
              autoComplete="off"
            />
            <Button type="submit" size="sm" className="min-h-11 shrink-0 rounded-xl px-4">
              Invia
            </Button>
          </form>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Risposte brevi a voce · dettagli sullo schermo · nessun salvataggio senza conferma
          </p>
          {!speechSupported ? (
            <p className="mt-1 text-center text-[11px] text-amber-700">
              Microfono non supportato: usa la tastiera. Preferisci Chrome o Edge su smartphone.
            </p>
          ) : null}
          {activeAction === "talk" ? (
            <p className="mt-1 text-center text-[11px] text-slate-400">
              Di «fine sessione» per tornare al menu
            </p>
          ) : null}
        </footer>
      </div>

      {toast ? (
        <JoyCopilotToast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </>
  );
}
