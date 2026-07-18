"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  Copy,
  Headphones,
  Loader2,
  MapPin,
  MessageSquarePlus,
  Mic,
  MicOff,
  RefreshCw,
  Route,
  Send,
  Sparkles,
  Target,
  Trash2,
  BarChart3,
  Compass,
} from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useSpeechRecognition } from "@/features/voice/hooks/use-speech-recognition";
import {
  joyVoice,
  speakItalian,
  stopSpeaking,
  unlockJoyAudioFromUserGesture,
} from "@/lib/voice/joy-voice-queue";
import { JoyVoiceControls } from "./joy-voice-controls";
import { JoyVoiceTestPanel } from "./joy-voice-test-panel";
import { fetchJoyCommandCenterSnapshotAction } from "../actions/joy-command-center-actions";
import { executeJoyCopilotActionBatch } from "../chat/actions/joy-copilot-actions";
import type { JoyChatMessage, JoyDebriefFieldKey } from "../chat/types/joy-chat";
import type { JoyConversationMemory, JoySessionState } from "../chat/types/joy-session";
import { JoyCopilotToast } from "../chat/components/joy-copilot-toast";
import {
  applyJoyDebriefVoiceEdit,
  filterDebriefOperationsForConfirm,
  isJoyDebriefVoiceEdit,
} from "../chat/utils/parse-joy-debrief";
import {
  createConversation,
  createRemoteConversation,
  deleteRemoteConversation,
  deriveConversationTitle,
  fetchJoyAiSuggestions,
  fetchRemoteConversations,
  loadActiveConversationId,
  loadConversations,
  persistActiveConversationId,
  persistConversations,
  sortConversationsByDate,
  syncRemoteConversation,
  trimConversationMessages,
  type JoyAiConversation,
} from "../chat/utils/joy-ai-conversations";
import {
  clearJoyConversationMemory,
  extractMemoryFromAssistantMessage,
  extractMemoryHintsFromUserText,
  formatMemoryBadge,
  loadJoyConversationMemory,
  mergeJoyConversationMemory,
  persistJoyConversationMemory,
} from "../chat/utils/joy-conversation-memory";
import {
  formatLongMemoryBrief,
  loadJoyLongTermMemory,
  markJoyDayStart,
  markJoyDayEnd,
  recordJoyPromise,
} from "../os/memory/joy-long-memory";
import {
  clearJoyDayOps,
  formatJoyDayOpsBrief,
  loadJoyDayOps,
  patchJoyDayOps,
  setJoyDayNextAction,
  type JoyCommandCenterSnapshot,
  type JoyDayOpsState,
} from "../os/client";
import { persistJoyTourProposal } from "../chat/utils/joy-tour-proposal-storage";
import { streamJoyChatMessage } from "../chat/utils/stream-joy-chat";
import { JoyAiConversationSidebar } from "./joy-ai-conversation-sidebar";
import { JoyAiMessageBubble } from "./joy-ai-message-bubble";
import { JoyCommandCenterPanel } from "./joy-command-center-panel";
import { JoySessionStatusBar } from "./joy-session-status-bar";

const FALLBACK_SUGGESTIONS = [
  "Inizia la giornata",
  "Ti consiglio le priorità di oggi",
  "Organizza giro visite per domani",
  "Quali follow-up sono in ritardo?",
  "Come aumentare il fatturato",
  "Joy registra: visita conclusa",
];

const QUICK_ACTIONS = [
  {
    id: "morning",
    label: "Mattina",
    icon: Sparkles,
    prompt: "Inizia la giornata",
    needsLocation: false,
  },
  {
    id: "daily-briefing",
    label: "Prepara giornata",
    icon: Sparkles,
    prompt: "Prepara la mia giornata",
    needsLocation: false,
  },
  {
    id: "daily-plan",
    label: "Piano giornata",
    icon: CalendarDays,
    prompt: "Piano della giornata",
    needsLocation: false,
  },
  {
    id: "end-of-day",
    label: "Riepilogo",
    icon: BarChart3,
    prompt: "Riepiloga la mia giornata",
    needsLocation: false,
  },
  {
    id: "proposals",
    label: "Priorità",
    icon: Target,
    prompt: "Cosa mi consigli di fare adesso?",
    needsLocation: false,
  },
  {
    id: "strategy",
    label: "Strategia",
    icon: Compass,
    prompt: "Come aumentare il fatturato",
    needsLocation: false,
  },
  {
    id: "nearby",
    label: "Vicini",
    icon: MapPin,
    prompt: "Quali aziende sono vicino a dove mi trovo?",
    needsLocation: true,
  },
  {
    id: "agenda-today",
    label: "Agenda",
    icon: CalendarDays,
    prompt: "Quali appuntamenti ho oggi?",
    needsLocation: false,
  },
  {
    id: "tour",
    label: "Giro",
    icon: Route,
    prompt: "Organizza il mio giro visite per domani max 5 visite entro le 17:00",
    needsLocation: false,
  },
  {
    id: "debrief",
    label: "Registra",
    icon: Mic,
    prompt: "Joy registra: ",
    needsLocation: false,
  },
] as const;

const GUIDE_QUICK_ACTIONS = QUICK_ACTIONS.filter((action) =>
  ["morning", "daily-briefing", "tour", "nearby", "debrief", "proposals", "strategy"].includes(
    action.id
  )
);

const PRIMARY_COMMAND_ACTIONS = [
  {
    id: "talk",
    label: "Parla con Joy",
    icon: Mic,
    tone: "from-indigo-600 to-violet-600",
  },
  {
    id: "start-day",
    label: "Inizia la giornata",
    icon: Sparkles,
    tone: "from-amber-500 to-orange-600",
    prompt: "Inizia la giornata",
  },
  {
    id: "tour",
    label: "Organizza il giro",
    icon: Route,
    tone: "from-sky-500 to-blue-600",
    prompt: "Organizza il mio giro visite per oggi",
  },
  {
    id: "register",
    label: "Registra una visita",
    icon: CheckCircle2,
    tone: "from-emerald-500 to-teal-600",
  },
] as const;

interface JoyAiAssistantScreenProps {
  userDisplayName: string;
  userAvatarUrl?: string | null;
  initialPrompt?: string;
  companyId?: string;
  companyName?: string;
}

function newUserMessage(content: string): JoyChatMessage {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };
}

function requestCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalizzazione non supportata."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => reject(new Error("Posizione non disponibile.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

function readInitialJoyAiState(): {
  conversations: JoyAiConversation[];
  activeConversationId: string;
} {
  if (typeof window === "undefined") {
    const initial = createConversation();
    return { conversations: [initial], activeConversationId: initial.id };
  }

  const stored = loadConversations();
  if (stored.length === 0) {
    const initial = createConversation();
    persistActiveConversationId(initial.id);
    return { conversations: [initial], activeConversationId: initial.id };
  }

  const activeId = loadActiveConversationId();
  const activeConversationId =
    activeId && stored.some((conversation) => conversation.id === activeId)
      ? activeId
      : stored[0].id;

  return { conversations: stored, activeConversationId };
}

export function JoyAiAssistantScreen({
  userDisplayName,
  userAvatarUrl,
  initialPrompt,
  companyId,
  companyName,
}: JoyAiAssistantScreenProps) {
  const router = useRouter();
  const [initialJoyState] = useState(readInitialJoyAiState);
  const [conversations, setConversations] = useState<JoyAiConversation[]>(
    initialJoyState.conversations
  );
  const [activeConversationId, setActiveConversationId] = useState<string>(
    initialJoyState.activeConversationId
  );
  const [useRemoteStorage, setUseRemoteStorage] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [executingCopilotId, setExecutingCopilotId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const [conversationMode, setConversationMode] = useState(false);
  const [guideMode, setGuideMode] = useState(true);
  const [sessionOverride, setSessionOverride] = useState<JoySessionState | null>(null);
  const [commandSnapshot, setCommandSnapshot] = useState<JoyCommandCenterSnapshot | null>(null);
  const [commandLoading, setCommandLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [dayOps, setDayOps] = useState<JoyDayOpsState | null>(null);
  const [dayOpsBrief, setDayOpsBrief] = useState<string | null>(null);
  const [showCommandBoard, setShowCommandBoard] = useState(true);
  const [showVoiceTest, setShowVoiceTest] = useState(false);
  /** DEV-only: confronto voci TTS — solo con `npm run dev`. */
  const isDevVoicePanel = process.env.NODE_ENV === "development";
  const [memory, setMemory] = useState<JoyConversationMemory>(() => {
    if (typeof window === "undefined") {
      return {};
    }
    const stored = loadJoyConversationMemory();
    if (companyId) {
      return mergeJoyConversationMemory(stored, {
        lastCompanyId: companyId,
        selectedClientId: companyId,
        lastCompanyName: companyName ?? stored.lastCompanyName,
        selectedClientName: companyName ?? stored.selectedClientName,
      });
    }
    return stored;
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserPromptRef = useRef<string | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const autoBriefingSentRef = useRef(false);
  const voiceBufferRef = useRef("");
  const sendMessageRef = useRef<
    ((
      text: string,
      options?: { latitude?: number | null; longitude?: number | null; autoBriefing?: boolean }
    ) => Promise<void>) | null
  >(null);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    conversations[0];
  const messages = useMemo(
    () => activeConversation?.messages ?? [],
    [activeConversation]
  );

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

  const [longMemoryBrief, setLongMemoryBrief] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const hour = new Date().getHours();
    if (hour < 12) {
      markJoyDayStart();
    } else if (hour >= 18) {
      markJoyDayEnd();
    }
    return formatLongMemoryBrief(loadJoyLongTermMemory());
  });

  const capturePromiseFromUserText = useCallback((text: string) => {
    if (!/prometto|mi impegno|ricordami di|promessa/.test(text.toLowerCase())) {
      return;
    }
    recordJoyPromise({
      text: text.trim().slice(0, 200),
      companyId: memory.selectedClientId ?? memory.lastCompanyId,
      companyName: memory.selectedClientName ?? memory.lastCompanyName,
    });
    setLongMemoryBrief(formatLongMemoryBrief(loadJoyLongTermMemory()));
  }, [memory.lastCompanyId, memory.lastCompanyName, memory.selectedClientId, memory.selectedClientName]);

  const {
    isSupported: speechSupported,
    isListening,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    toggleListening,
  } = useSpeechRecognition({
    lang: "it-IT",
    onFinalChunk: (chunk) => {
      // Barge-in: interrompe TTS se l'utente parla mentre Joy sta leggendo.
      if (
        joyVoice.getState() === "speaking" ||
        joyVoice.getState() === "preparing" ||
        joyVoice.getState() === "ready" ||
        joyVoice.getState() === "paused"
      ) {
        joyVoice.interrupt();
      }
      voiceBufferRef.current = `${voiceBufferRef.current} ${chunk}`.trim();
      setInput(voiceBufferRef.current);
      if (conversationMode && voiceBufferRef.current.length > 8) {
        const text = voiceBufferRef.current;
        voiceBufferRef.current = "";
        setInput("");
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
    let cancelled = false;

    async function bootstrap() {
      const location = await requestCurrentLocation().catch(() => null);
      if (location) {
        lastLocationRef.current = location;
      }

      const [remoteResult, dynamicSuggestions, snapshot] = await Promise.all([
        fetchRemoteConversations(),
        fetchJoyAiSuggestions(),
        fetchJoyCommandCenterSnapshotAction({
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
        }),
      ]);

      if (cancelled) {
        return;
      }

      setCommandSnapshot(snapshot);
      setCommandLoading(false);

      const ops = loadJoyDayOps();
      setDayOps(ops);
      setDayOpsBrief(formatJoyDayOpsBrief(ops));
      if (ops.dismissedSuggestionIds.length > 0) {
        setDismissedIds(new Set(ops.dismissedSuggestionIds));
      }

      if (dynamicSuggestions.length > 0) {
        setSuggestions(dynamicSuggestions);
      }

      if (!remoteResult.tableMissing && remoteResult.conversations.length > 0) {
        setUseRemoteStorage(true);
        setConversations(remoteResult.conversations);
        const activeId = loadActiveConversationId();
        const nextActive =
          activeId &&
          remoteResult.conversations.some((conversation) => conversation.id === activeId)
            ? activeId
            : remoteResult.conversations[0].id;
        setActiveConversationId(nextActive);
        return;
      }

      if (!remoteResult.tableMissing) {
        setUseRemoteStorage(true);
        const remote = await createRemoteConversation();
        if (!cancelled && remote) {
          setConversations([remote]);
          setActiveConversationId(remote.id);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      persistActiveConversationId(activeConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    if (!useRemoteStorage) {
      persistConversations(conversations);
      return;
    }

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(() => {
      const active = conversations.find((conversation) => conversation.id === activeConversationId);
      if (active?.remote) {
        void syncRemoteConversation(active);
      }
    }, 600);

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [conversations, activeConversationId, useRemoteStorage]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages, isStreaming, executingCopilotId]);

  const updateActiveMessages = useCallback(
    (updater: (messages: JoyChatMessage[]) => JoyChatMessage[]) => {
      if (!activeConversationId) {
        return;
      }

      setConversations((current) =>
        sortConversationsByDate(
          current.map((conversation) => {
            if (conversation.id !== activeConversationId) {
              return conversation;
            }
            const nextMessages = trimConversationMessages(updater(conversation.messages));
            return {
              ...conversation,
              messages: nextMessages,
              title: deriveConversationTitle(nextMessages),
              updatedAt: new Date().toISOString(),
            };
          })
        )
      );
    },
    [activeConversationId]
  );

  const sendMessage = useCallback(
    async (
      text: string,
      options?: {
        latitude?: number | null;
        longitude?: number | null;
        autoBriefing?: boolean;
      }
    ) => {
      // Best-effort: se chiamato sync dal tap/submit, sblocca iOS prima degli await.
      unlockJoyAudioFromUserGesture();
      const trimmed = text.trim();
      if (!trimmed || isStreaming || !activeConversationId) {
        return;
      }

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
            updateActiveMessages((current) => [
              ...current.map((message) =>
                message.id === pendingMsg.id
                  ? { ...message, pendingAction: patched }
                  : message
              ),
              newUserMessage(trimmed),
              {
                id: `joy-debrief-edit-${Date.now()}`,
                role: "assistant" as const,
                content: `Ok. ${patched.description}. Conferma quando sei pronto.`,
                createdAt: new Date().toISOString(),
              },
            ]);
            setInput("");
            setSessionOverride("confirming");
            return;
          }
        }
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      lastUserPromptRef.current = trimmed;
      if (options?.latitude != null && options?.longitude != null) {
        lastLocationRef.current = { lat: options.latitude, lng: options.longitude };
      }

      applyMemoryPatch(extractMemoryHintsFromUserText(trimmed));
      capturePromiseFromUserText(trimmed);

      const userMessage = newUserMessage(trimmed);
      updateActiveMessages((current) => [...current, userMessage]);
      setInput("");
      setIsStreaming(true);
      setSessionOverride("thinking");

      const placeholderId = `joy-stream-${Date.now()}`;
      setStreamingMessageId(placeholderId);
      updateActiveMessages((current) => [
        ...current,
        {
          id: placeholderId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
        },
      ]);

      const messageForEngine = trimmed;

      try {
        const result = await streamJoyChatMessage({
          message: messageForEngine,
          latitude: options?.latitude ?? lastLocationRef.current?.lat ?? null,
          longitude: options?.longitude ?? lastLocationRef.current?.lng ?? null,
          companyId: companyId ?? memory.selectedClientId ?? memory.lastCompanyId ?? null,
          memory,
          autoBriefing: options?.autoBriefing,
          guideMode,
          signal: controller.signal,
          onMeta: (meta, extras) => {
            updateActiveMessages((current) =>
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
            updateActiveMessages((current) =>
              current.map((message) =>
                message.id === placeholderId
                  ? { ...message, content: `${message.content}${chunk}` }
                  : message
              )
            );
          },
        });

        updateActiveMessages((current) =>
          current.map((message) =>
            message.id === placeholderId ? result.message : message
          )
        );

        applyMemoryPatch(extractMemoryFromAssistantMessage(result.message));
        if (result.memoryPatch) {
          applyMemoryPatch(result.memoryPatch);
        }

        if (result.message.pendingAction?.status === "pending") {
          setSessionOverride("confirming");
        } else if (result.sessionState === "proposing") {
          setSessionOverride("proposing");
        } else if (conversationMode) {
          setSessionOverride("listening");
        } else {
          setSessionOverride("completed");
        }

        if (result.message.content) {
          // displayText = risposta CRM completa; spokenText = breve conversazionale.
          // Una risposta = un solo spokenText = una sola generazione TTS continua.
          stopListening();
          void speakItalian(result.message.content, {
            displayText: result.message.content,
          });
        }

        if (result.error) {
          setToast({ message: result.error, variant: "error" });
        }

        if (/fine\s+(sessione|conversazione)|chiudi\s+(sessione|conversazione)/i.test(trimmed)) {
          setConversationMode(false);
          stopListening();
          setSessionOverride("idle");
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Errore durante la risposta di Joy AI.";
        updateActiveMessages((current) =>
          current.map((item) =>
            item.id === placeholderId ? { ...item, content: message } : item
          )
        );
        setToast({ message, variant: "error" });
        setSessionOverride(conversationMode ? "listening" : "idle");
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
        abortRef.current = null;
      }
    },
    [
      activeConversationId,
      applyMemoryPatch,
      capturePromiseFromUserText,
      companyId,
      conversationMode,
      guideMode,
      isStreaming,
      memory,
      messages,
      stopListening,
      updateActiveMessages,
    ]
  );

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const initialPromptSentRef = useRef(false);

  useEffect(() => {
    const prompt = initialPrompt?.trim();
    if (!prompt || initialPromptSentRef.current || isStreaming || messages.length > 0) {
      return;
    }

    initialPromptSentRef.current = true;
    void sendMessage(prompt);
  }, [initialPrompt, isStreaming, messages.length, sendMessage]);

  useEffect(() => {
    if (!companyId || autoBriefingSentRef.current || isStreaming) {
      return;
    }
    if (initialPrompt?.trim()) {
      return;
    }
    if (messages.length > 0) {
      return;
    }

    autoBriefingSentRef.current = true;
    const timer = window.setTimeout(() => {
      applyMemoryPatch({
        lastCompanyId: companyId,
        selectedClientId: companyId,
        lastCompanyName: companyName ?? null,
        selectedClientName: companyName ?? null,
      });
      void sendMessage(
        companyName
          ? `Prepara il briefing per ${companyName}`
          : "Prepara il briefing azienda",
        { autoBriefing: true }
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    applyMemoryPatch,
    companyId,
    companyName,
    initialPrompt,
    isStreaming,
    messages.length,
    sendMessage,
  ]);

  const handleNewChat = async () => {
    abortRef.current?.abort();

    if (useRemoteStorage) {
      const remote = await createRemoteConversation();
      if (remote) {
        setConversations((current) => sortConversationsByDate([remote, ...current]));
        setActiveConversationId(remote.id);
        setInput("");
        return;
      }
    }

    const conversation = createConversation();
    setConversations((current) => sortConversationsByDate([conversation, ...current]));
    setActiveConversationId(conversation.id);
    setInput("");
  };

  const handleDeleteChat = async (conversationId: string) => {
    abortRef.current?.abort();

    const target = conversations.find((conversation) => conversation.id === conversationId);
    if (target?.remote) {
      await deleteRemoteConversation(conversationId);
    }

    setConversations((current) => {
      const remaining = current.filter((conversation) => conversation.id !== conversationId);
      if (remaining.length === 0) {
        const fresh = createConversation();
        setActiveConversationId(fresh.id);
        return [fresh];
      }

      if (conversationId === activeConversationId) {
        setActiveConversationId(remaining[0].id);
      }
      return sortConversationsByDate(remaining);
    });
  };

  const handleRenameStart = (conversation: JoyAiConversation) => {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
  };

  const handleRenameCommit = () => {
    if (!renamingId) {
      return;
    }

    const trimmed = renameValue.trim();
    if (trimmed) {
      setConversations((current) =>
        sortConversationsByDate(
          current.map((conversation) =>
            conversation.id === renamingId
              ? { ...conversation, title: trimmed, updatedAt: new Date().toISOString() }
              : conversation
          )
        )
      );
    }

    setRenamingId(null);
    setRenameValue("");
  };

  const handleCopyResponse = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setToast({ message: "Risposta copiata negli appunti.", variant: "success" });
    } catch {
      setToast({ message: "Impossibile copiare la risposta.", variant: "error" });
    }
  };

  const handleRegenerate = () => {
    if (!lastUserPromptRef.current || isStreaming) {
      return;
    }

    updateActiveMessages((current) => {
      const lastAssistantIndex = [...current].reverse().findIndex((m) => m.role === "assistant");
      if (lastAssistantIndex === -1) {
        return current;
      }
      const index = current.length - 1 - lastAssistantIndex;
      return current.slice(0, index);
    });

    void sendMessage(lastUserPromptRef.current, {
      latitude: lastLocationRef.current?.lat ?? null,
      longitude: lastLocationRef.current?.lng ?? null,
    });
  };

  const handleQuickAction = async (action: (typeof QUICK_ACTIONS)[number]) => {
    if (action.id === "debrief") {
      setInput("Joy registra: ");
      if (speechSupported) {
        startListening();
        setSessionOverride("listening");
      }
      return;
    }

    let latitude: number | null = null;
    let longitude: number | null = null;

    if (action.needsLocation) {
      try {
        const location = await requestCurrentLocation();
        latitude = location.lat;
        longitude = location.lng;
        lastLocationRef.current = location;
      } catch (error) {
        setToast({
          message:
            error instanceof Error
              ? error.message
              : "Consenti il GPS per trovare clienti vicini.",
          variant: "error",
        });
        return;
      }
    }

    void sendMessage(action.prompt, { latitude, longitude });
  };

  const handlePrimaryCommand = (actionId: (typeof PRIMARY_COMMAND_ACTIONS)[number]["id"]) => {
    stopSpeaking();
    if (actionId === "talk") {
      setShowCommandBoard(false);
      setConversationMode(true);
      setSessionOverride("listening");
      if (speechSupported) {
        startListening();
      }
      inputRef.current?.focus();
      return;
    }
    if (actionId === "register") {
      setShowCommandBoard(false);
      setInput("Joy registra: ");
      voiceBufferRef.current = "Joy registra: ";
      setSessionOverride("listening");
      if (speechSupported) {
        startListening();
      }
      inputRef.current?.focus();
      return;
    }
    const action = PRIMARY_COMMAND_ACTIONS.find((item) => item.id === actionId);
    if (action && "prompt" in action && action.prompt) {
      setShowCommandBoard(false);
      void sendMessage(action.prompt);
    }
  };

  const handleCommandPrompt = (prompt: string) => {
    if (prompt === "Parla con Joy") {
      handlePrimaryCommand("talk");
      return;
    }
    setShowCommandBoard(false);
    if (commandSnapshot?.nextAction?.action === prompt || prompt === commandSnapshot?.dayStart.followPrompt) {
      setJoyDayNextAction(prompt);
      setDayOps(loadJoyDayOps());
      setDayOpsBrief(formatJoyDayOpsBrief(loadJoyDayOps()));
    }
    void sendMessage(prompt, {
      latitude: lastLocationRef.current?.lat ?? null,
      longitude: lastLocationRef.current?.lng ?? null,
    });
  };

  const handleIgnoreCard = (id: string) => {
    setDismissedIds((current) => {
      const next = new Set(current);
      next.add(id);
      const ops = patchJoyDayOps({
        dismissedSuggestionIds: [...next].slice(0, 40),
      });
      setDayOps(ops);
      setDayOpsBrief(formatJoyDayOpsBrief(ops));
      return next;
    });
  };

  const handleResumeDay = () => {
    const ops = loadJoyDayOps();
    setDayOps(ops);
    setDayOpsBrief(formatJoyDayOpsBrief(ops));
    const prompt =
      ops.nextActionPrompt ??
      commandSnapshot?.recommendedPrompt ??
      "Cosa mi consigli di fare adesso?";
    handleCommandPrompt(prompt);
  };

  const handleEditDay = () => {
    setInput("Modifica piano giornata: ");
    voiceBufferRef.current = "Modifica piano giornata: ";
    inputRef.current?.focus();
  };

  const handleClearDay = () => {
    const cleared = clearJoyDayOps();
    setDayOps(cleared);
    setDayOpsBrief(null);
    setDismissedIds(new Set());
    setToast({ message: "Memoria giorno cancellata.", variant: "success" });
  };

  const handleToggleConversationMode = () => {
    setConversationMode((current) => {
      const next = !current;
      if (next) {
        setSessionOverride("listening");
        if (speechSupported) {
          startListening();
        }
      } else {
        stopListening();
        setSessionOverride("idle");
      }
      return next;
    });
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

        updateActiveMessages((current) =>
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

          const draft = memory.tourDraft;
          if (
            pending.operation.type === "navigate" &&
            pending.operation.href?.includes("/giro-visite") &&
            draft?.stopCompanyIds &&
            draft.stopCompanyIds.length > 0
          ) {
            try {
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
            } catch {
              // ignore URL parse
            }
          }

          router.refresh();
          if (result.href) {
            router.push(result.href);
          }
          if (conversationMode && speechSupported) {
            setTimeout(() => {
              setSessionOverride("listening");
              startListening();
            }, 800);
          }
        } else {
          setToast({ message: result.message, variant: "error" });
          setSessionOverride("confirming");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Esecuzione azione non riuscita.";
        updateActiveMessages((current) =>
          current.map((item) => {
            if (item.id !== messageId || !item.pendingAction) {
              return item;
            }
            return {
              ...item,
              pendingAction: {
                ...item.pendingAction,
                status: "failed",
              },
              content: `${item.content}\n\n✗ ${message}`,
            };
          })
        );
        setToast({ message, variant: "error" });
        setSessionOverride(conversationMode ? "listening" : "idle");
      } finally {
        setExecutingCopilotId(null);
      }
    },
    [
      conversationMode,
      memory,
      messages,
      router,
      speechSupported,
      startListening,
      updateActiveMessages,
    ]
  );

  const handleCancelCopilot = useCallback(
    (messageId: string) => {
      updateActiveMessages((current) =>
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
      setSessionOverride(conversationMode ? "listening" : "idle");
    },
    [conversationMode, updateActiveMessages]
  );

  const handleModifyCopilot = useCallback(
    (messageId: string) => {
      handleCancelCopilot(messageId);
      const draft = "Modifica il giro: ";
      setInput(draft);
      voiceBufferRef.current = draft;
      setSessionOverride(conversationMode ? "listening" : "proposing");
      window.setTimeout(() => {
        inputRef.current?.focus();
        const length = draft.length;
        inputRef.current?.setSelectionRange(length, length);
      }, 0);
    },
    [conversationMode, handleCancelCopilot]
  );

  const handleRegenerateCopilot = useCallback(
    (messageId: string) => {
      handleCancelCopilot(messageId);
      void sendMessage("Rigenera il giro", {
        latitude: lastLocationRef.current?.lat ?? null,
        longitude: lastLocationRef.current?.lng ?? null,
      });
    },
    [handleCancelCopilot, sendMessage]
  );

  const handleToggleDebriefField = useCallback(
    (messageId: string, key: JoyDebriefFieldKey) => {
      updateActiveMessages((current) =>
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
    [updateActiveMessages]
  );

  const showWelcome = messages.length === 0;
  const visibleQuickActions = guideMode ? GUIDE_QUICK_ACTIONS : QUICK_ACTIONS;
  const memoryLabel = [formatMemoryBadge(memory), longMemoryBrief]
    .filter(Boolean)
    .join(" · ") || null;

  return (
    <>
      <div
        className={`flex min-h-[calc(100dvh-8rem)] flex-col gap-4 lg:min-h-[calc(100dvh-10rem)] ${
          guideMode ? "" : "lg:flex-row"
        }`}
      >
        {!guideMode ? (
          <Card className="flex w-full shrink-0 flex-col border-slate-200 lg:w-64 xl:w-72">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Conversazioni</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleNewChat()}
                title="Nuova chat"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
            </div>
            <JoyAiConversationSidebar
              conversations={conversations}
              activeConversationId={activeConversationId}
              renamingId={renamingId}
              renameValue={renameValue}
              onSelect={setActiveConversationId}
              onRenameStart={handleRenameStart}
              onRenameChange={setRenameValue}
              onRenameCommit={handleRenameCommit}
              onRenameCancel={() => {
                setRenamingId(null);
                setRenameValue("");
              }}
              onDelete={(id) => void handleDeleteChat(id)}
            />
          </Card>
        ) : null}

        <Card className="flex min-h-[min(520px,70dvh)] flex-1 flex-col overflow-hidden border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">JOY Command Center</p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  AI Sales Operating System
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={conversationMode ? "primary" : "outline"}
                size={guideMode ? "md" : "sm"}
                onClick={handleToggleConversationMode}
                className={guideMode ? "min-h-11 px-4 text-sm" : undefined}
              >
                {conversationMode ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                {conversationMode ? "In conversazione" : "Conversazione"}
              </Button>
              {isDevVoicePanel ? (
                <Button
                  type="button"
                  variant={showVoiceTest ? "primary" : "outline"}
                  size={guideMode ? "md" : "sm"}
                  onClick={() => setShowVoiceTest((value) => !value)}
                  className={
                    guideMode
                      ? "min-h-11 border-amber-400 px-4 text-sm text-amber-900"
                      : "border-amber-400 text-amber-900"
                  }
                  title="DEV — confronto voci Joy"
                >
                  <Headphones className="h-4 w-4" />
                  Test Voce
                </Button>
              ) : null}
              <Button
                type="button"
                variant={guideMode ? "primary" : "outline"}
                size={guideMode ? "md" : "sm"}
                onClick={() => setGuideMode((value) => !value)}
                className={guideMode ? "min-h-11 px-4 text-sm" : undefined}
              >
                <Compass className="h-4 w-4" />
                Guida
              </Button>
              {!guideMode ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleNewChat()}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    Nuova chat
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      clearJoyConversationMemory();
                      setMemory({});
                      void handleDeleteChat(activeConversationId);
                    }}
                    className="text-slate-500"
                  >
                    <Trash2 className="h-4 w-4" />
                    Elimina
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 border-b border-slate-100 px-4 py-2 sm:px-5">
            <JoySessionStatusBar
              state={sessionState}
              conversationMode={conversationMode}
              guideMode={guideMode}
              memoryLabel={memoryLabel}
            />
            <JoyVoiceControls compact />
            {isDevVoicePanel && showVoiceTest ? (
              <div className="py-2">
                <JoyVoiceTestPanel />
              </div>
            ) : null}
            {companyId ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>
                  <strong>Contesto azienda attivo</strong>
                  {" — "}
                  {companyName ?? "Azienda selezionata"}
                </span>
                <a
                  href={`/companies/${companyId}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  Apri scheda
                </a>
              </div>
            ) : null}
            <div className={`flex flex-wrap gap-2 ${guideMode ? "gap-3" : ""}`}>
              {PRIMARY_COMMAND_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.id}
                    type="button"
                    disabled={isStreaming}
                    onClick={() => handlePrimaryCommand(action.id)}
                    className={`min-h-12 flex-1 rounded-xl bg-gradient-to-br ${action.tone} px-3 text-sm font-semibold text-white shadow-sm sm:flex-none sm:min-w-[9.5rem]`}
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                );
              })}
            </div>
            {!guideMode ? (
              <div className={`flex flex-wrap gap-2 ${guideMode ? "gap-3" : ""}`}>
                {visibleQuickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isStreaming}
                      onClick={() => void handleQuickAction(action)}
                      className="rounded-full text-xs"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
            {showWelcome && showCommandBoard ? (
              <div className="mx-auto max-w-3xl space-y-4 py-2">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-slate-900">Ciao, sono Joy</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Una sola intelligenza operativa: consiglio, priorità, giro e registrazione
                    con conferma.
                  </p>
                </div>
                <JoyCommandCenterPanel
                  snapshot={commandSnapshot}
                  loading={commandLoading}
                  dayOps={dayOps}
                  dayOpsBrief={dayOpsBrief}
                  dismissedIds={dismissedIds}
                  onPrompt={handleCommandPrompt}
                  onIgnoreCard={handleIgnoreCard}
                  onResumeDay={handleResumeDay}
                  onEditDay={handleEditDay}
                  onClearDay={handleClearDay}
                />
              </div>
            ) : null}

            {showWelcome && !showCommandBoard ? (
              <div className="mx-auto max-w-2xl space-y-4 py-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                  <Sparkles className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Ti ascolto</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Parla o scrivi. Confermo sempre prima di salvare.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="min-h-11 rounded-full border border-indigo-200 bg-white px-4 py-1.5 text-sm font-medium text-indigo-800 transition-colors hover:bg-indigo-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCommandBoard(true)}
                >
                  Torna al Command Center
                </Button>
              </div>
            ) : null}

            {messages.length > 0 ? (
              <div className="mb-2 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => {
                    setShowCommandBoard(true);
                    void handleNewChat();
                  }}
                >
                  Torna al Command Center
                </Button>
              </div>
            ) : null}

            {messages.map((message, index) => {
              const isAssistant = message.role === "assistant";
              const isLastAssistant =
                isAssistant && !messages.slice(index + 1).some((m) => m.role === "assistant");
              const isCurrentlyStreaming =
                isStreaming && message.id === streamingMessageId && !message.content;

              return (
                <div key={message.id} className="space-y-2">
                  <JoyAiMessageBubble
                    message={message}
                    userDisplayName={userDisplayName}
                    userAvatarUrl={userAvatarUrl}
                    executingCopilotId={executingCopilotId}
                    onConfirmCopilot={handleConfirmCopilot}
                    onCancelCopilot={handleCancelCopilot}
                    onModifyCopilot={handleModifyCopilot}
                    onRegenerateCopilot={handleRegenerateCopilot}
                    onToggleDebriefField={handleToggleDebriefField}
                  />
                  {isAssistant && message.content && !isCurrentlyStreaming && !guideMode ? (
                    <div className="flex flex-wrap gap-2 pl-11">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-slate-500"
                        onClick={() => void handleCopyResponse(message.content)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copia risposta
                      </Button>
                      {isLastAssistant ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-slate-500"
                          disabled={isStreaming}
                          onClick={handleRegenerate}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Rigenera risposta
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {isCurrentlyStreaming ? (
                    <div className="ml-11 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                      Sto pensando...
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              unlockJoyAudioFromUserGesture();
              void sendMessage(input);
            }}
            className="border-t border-slate-100 bg-white/90 p-3 backdrop-blur sm:p-4"
          >
            {interimTranscript ? (
              <p className="mb-2 text-xs text-indigo-700">Ascolto: {interimTranscript}</p>
            ) : null}
            <div className="flex items-end gap-2">
              {speechSupported ? (
                <Button
                  type="button"
                  variant={isListening ? "primary" : "outline"}
                  size={guideMode ? "md" : "sm"}
                  className={guideMode ? "min-h-12 min-w-12 rounded-xl" : "h-11 w-11 rounded-xl p-0"}
                  onClick={() => {
                    unlockJoyAudioFromUserGesture();
                    toggleListening();
                    if (!isListening) {
                      setSessionOverride("listening");
                      if (!conversationMode) {
                        setConversationMode(true);
                      }
                    }
                  }}
                  title={isListening ? "Ferma microfono" : "Parla con Joy"}
                >
                  {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  <span className="sr-only">Microfono</span>
                </Button>
              ) : null}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  voiceBufferRef.current = event.target.value;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                rows={guideMode ? 2 : 1}
                placeholder={
                  guideMode
                    ? "Parla o scrivi… es. organiza giro domani"
                    : "Chiedi a Joy… oppure «Joy registra: …»"
                }
                disabled={isStreaming || Boolean(executingCopilotId)}
                className={`max-h-32 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 ${
                  guideMode ? "min-h-[56px] text-base" : "min-h-[44px] text-sm"
                }`}
              />
              <Button
                type="submit"
                disabled={isStreaming || Boolean(executingCopilotId) || !input.trim()}
                className={`shrink-0 rounded-xl ${guideMode ? "min-h-12 px-5 text-sm" : "h-11 px-4"}`}
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className={guideMode ? "" : "sr-only"}>Invia</span>
              </Button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {conversationMode
                ? "Modalità Conversazione attiva — di «fine sessione» per chiudere. Nessun salvataggio senza conferma."
                : "Invio · Maiusc+Invio nuova riga · Azioni solo con conferma Copilot"}
            </p>
          </form>
        </Card>
      </div>

      {speechSupported ? (
        <button
          type="button"
          onClick={() => {
            handlePrimaryCommand("talk");
          }}
          className={`fixed bottom-[4.75rem] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-4 ring-white transition lg:bottom-8 ${
            isListening
              ? "bg-rose-600 text-white"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
          title="Parla con Joy"
          aria-label="Parla con Joy"
        >
          {isListening ? <Mic className="h-6 w-6 animate-pulse" /> : <Mic className="h-6 w-6" />}
        </button>
      ) : null}

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
