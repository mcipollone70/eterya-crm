"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Send, Sparkles, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui";
import { sendJoyChatMessageAction } from "../actions/joy-chat-actions";
import { executeJoyCopilotActionBatch } from "../actions/joy-copilot-actions";
import type { JoyChatMessage, JoyDebriefFieldKey } from "../types/joy-chat";
import { JoyChatMessageBubble } from "./joy-chat-message";
import { JoyCopilotToast } from "./joy-copilot-toast";
import { filterDebriefOperationsForConfirm } from "../utils/parse-joy-debrief";

export const JOY_CHAT_STORAGE_KEY = "joy-chat-history";
const MAX_STORED_MESSAGES = 80;

const SUGGESTED_PROMPTS = [
  "Pianifica una visita da Rossi domani alle 15",
  "Sposta la visita di Bianchi a venerdì",
  "Crea un follow-up da Rossi tra 20 giorni",
  "Apri l'azienda Rossi",
  "Organizza il mio giro di domani",
  "Fammi vedere le opportunità oltre 15.000 euro",
];

function newUserMessage(content: string): JoyChatMessage {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };
}

function loadStoredMessages(): JoyChatMessage[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(JOY_CHAT_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as JoyChatMessage[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_STORED_MESSAGES) : [];
  } catch {
    return [];
  }
}

function persistMessages(messages: JoyChatMessage[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    JOY_CHAT_STORAGE_KEY,
    JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))
  );
}

export function JoyChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<JoyChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [executingCopilotId, setExecutingCopilotId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate from localStorage after mount (avoids SSR/localStorage mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount hydration
    setMessages(loadStoredMessages());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    persistMessages(messages);
  }, [messages, hydrated]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages, isPending, executingCopilotId]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isPending) {
        return;
      }

      const userMessage = newUserMessage(trimmed);
      setMessages((current) => [...current, userMessage]);
      setInput("");

      startTransition(async () => {
        const response = await sendJoyChatMessageAction(trimmed);
        setMessages((current) => [...current, response.message]);
      });
    },
    [isPending]
  );

  const handleConfirmCopilot = useCallback(
    async (messageId: string) => {
      const target = messages.find((message) => message.id === messageId);
      const pending = target?.pendingAction;
      if (!pending || pending.status !== "pending") {
        return;
      }

      setExecutingCopilotId(pending.id);

      try {
        const filtered = filterDebriefOperationsForConfirm(pending);
        if (!filtered.operation) {
          setToast({
            message: "Seleziona almeno un campo da salvare.",
            variant: "error",
          });
          setExecutingCopilotId(null);
          return;
        }

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
          router.refresh();
          if (result.href) {
            router.push(result.href);
          }
        } else {
          setToast({ message: result.message, variant: "error" });
        }
      } finally {
        setExecutingCopilotId(null);
      }
    },
    [messages, router]
  );

  const handleCancelCopilot = useCallback((messageId: string) => {
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
  }, []);

  const handleModifyCopilot = useCallback(
    (messageId: string) => {
      handleCancelCopilot(messageId);
      setInput("Modifica il giro: ");
    },
    [handleCancelCopilot]
  );

  const handleRegenerateCopilot = useCallback(
    (messageId: string) => {
      handleCancelCopilot(messageId);
      sendMessage("Rigenera il giro");
    },
    [handleCancelCopilot, sendMessage]
  );

  const handleToggleDebriefField = useCallback((messageId: string, key: JoyDebriefFieldKey) => {
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
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(JOY_CHAT_STORAGE_KEY);
    }
  };

  const showWelcome = hydrated && messages.length === 0;

  return (
    <>
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50/80 via-white to-white shadow-sm sm:min-h-[calc(100dvh-10rem)]">
        <div className="flex items-center justify-between gap-3 border-b border-violet-100 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Joy Chat & Copilot</p>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Zap className="h-3 w-3 text-amber-500" />
                Assistente conversazionale con azioni operative
              </p>
            </div>
          </div>
          {messages.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="text-slate-500"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Svuota</span>
            </Button>
          ) : null}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {showWelcome ? (
            <div className="mx-auto max-w-2xl space-y-4 py-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Ciao, sono Joy Copilot</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Chiedi informazioni o esegui azioni nel CRM. Ogni operazione richiede conferma.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 transition-colors hover:bg-violet-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <JoyChatMessageBubble
              key={message.id}
              message={message}
              executingCopilotId={executingCopilotId}
              onConfirmCopilot={handleConfirmCopilot}
              onCancelCopilot={handleCancelCopilot}
              onModifyCopilot={handleModifyCopilot}
              onRegenerateCopilot={handleRegenerateCopilot}
              onToggleDebriefField={handleToggleDebriefField}
            />
          ))}

          {isPending ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                Joy sta analizzando la richiesta...
              </div>
            </div>
          ) : null}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-violet-100 bg-white/90 p-3 backdrop-blur sm:p-4"
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Scrivi a Joy o chiedi un'azione..."
              disabled={isPending || Boolean(executingCopilotId)}
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
            />
            <Button
              type="submit"
              disabled={isPending || Boolean(executingCopilotId) || !input.trim()}
              className="h-11 shrink-0 rounded-xl px-4"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Invia</span>
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-slate-400">
            Joy può interrogare il CRM ed eseguire visite, follow-up, promemoria e navigazione.
          </p>
        </form>
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
