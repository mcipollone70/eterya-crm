import type { JoyChatMessage } from "../types/joy-chat";
import type { JoyConversationMemory } from "../types/joy-session";

export interface StreamJoyChatOptions {
  message: string;
  latitude?: number | null;
  longitude?: number | null;
  companyId?: string | null;
  memory?: JoyConversationMemory | null;
  autoBriefing?: boolean;
  guideMode?: boolean;
  /** Joy Drive: risposte ancora più brevi (dettagli a schermo, sintesi vocale). */
  driveMode?: boolean;
  onMeta: (
    partial: Omit<JoyChatMessage, "content">,
    extras?: {
      memoryPatch?: JoyConversationMemory | null;
      sessionState?: string | null;
    }
  ) => void;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}

export interface StreamJoyChatResult {
  message: JoyChatMessage;
  error: string | null;
  memoryPatch?: JoyConversationMemory | null;
  sessionState?: string | null;
}

export async function streamJoyChatMessage(
  options: StreamJoyChatOptions
): Promise<StreamJoyChatResult> {
  const response = await fetch("/api/joy-ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: options.message,
      latitude: options.latitude ?? null,
      longitude: options.longitude ?? null,
      companyId: options.companyId ?? null,
      memory: options.memory ?? null,
      autoBriefing: options.autoBriefing ?? false,
      guideMode: options.guideMode ?? false,
      driveMode: options.driveMode ?? false,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    let errorMessage = "Impossibile contattare Joy AI.";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        errorMessage = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error("Risposta streaming non disponibile.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let meta: Omit<JoyChatMessage, "content"> | null = null;
  let error: string | null = null;
  let memoryPatch: JoyConversationMemory | null = null;
  let sessionState: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const event = (() => {
        try {
          return JSON.parse(line) as {
            type: "meta" | "chunk" | "done";
            message?: Omit<JoyChatMessage, "content">;
            text?: string;
            error?: string | null;
            memoryPatch?: JoyConversationMemory | null;
            sessionState?: string | null;
          };
        } catch {
          return null;
        }
      })();

      if (!event) {
        continue;
      }

      if (event.type === "meta" && event.message) {
        meta = event.message;
        memoryPatch = event.memoryPatch ?? null;
        sessionState = event.sessionState ?? null;
        options.onMeta(event.message, {
          memoryPatch,
          sessionState,
        });
      } else if (event.type === "chunk" && event.text) {
        content += event.text;
        options.onChunk(event.text);
      } else if (event.type === "done") {
        error = event.error ?? null;
      }
    }
  }

  if (!meta) {
    throw new Error("Risposta Joy AI incompleta.");
  }

  return {
    message: {
      ...meta,
      content,
    },
    error,
    memoryPatch,
    sessionState,
  };
}
