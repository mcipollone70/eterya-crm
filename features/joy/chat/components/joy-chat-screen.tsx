"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Bot, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { sendJoyChatMessageAction } from "../actions/joy-chat-actions";
import type { JoyChatMessage } from "../types/joy-chat";
import { JoyChatMessageBubble } from "./joy-chat-message";

export const JOY_CHAT_STORAGE_KEY = "joy-chat-history";
const MAX_STORED_MESSAGES = 80;

const SUGGESTED_PROMPTS = [
  "Chi devo visitare oggi?",
  "Quali clienti non vedo da un anno?",
  "Quante opportunità sopra 10.000 € ho?",
  "Chi è interessato alle VEPA?",
  "Organizzami il giro migliore",
  "Mostrami i clienti vicino a Latina",
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
  const [messages, setMessages] = useState<JoyChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
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
  }, [messages, isPending]);

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
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50/80 via-white to-white shadow-sm sm:min-h-[calc(100dvh-10rem)]">
      <div className="flex items-center justify-between gap-3 border-b border-violet-100 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Joy Chat</p>
            <p className="text-xs text-slate-500">Assistente conversazionale sul campo</p>
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
              <h2 className="text-lg font-semibold text-slate-900">Ciao, sono Joy</h2>
              <p className="mt-1 text-sm text-slate-600">
                Chiedimi visite, clienti, opportunità, radar o azioni rapide sul CRM.
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
          <JoyChatMessageBubble key={message.id} message={message} />
        ))}

        {isPending ? (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
              Joy sta analizzando i dati...
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
            placeholder="Scrivi a Joy..."
            disabled={isPending}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
          />
          <Button
            type="submit"
            disabled={isPending || !input.trim()}
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
          Joy interroga aziende, visite, agenda, opportunità, radar e Google Calendar.
        </p>
      </form>
    </div>
  );
}
