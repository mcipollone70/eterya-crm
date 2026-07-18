"use client";

import { Bot } from "lucide-react";
import { Avatar } from "@/components/ui";
import type { JoyChatMessage, JoyDebriefFieldKey } from "../chat/types/joy-chat";
import { JoyChatMessageBubble } from "../chat/components/joy-chat-message";

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface JoyAiMessageBubbleProps {
  message: JoyChatMessage;
  userDisplayName: string;
  userAvatarUrl?: string | null;
  executingCopilotId?: string | null;
  onConfirmCopilot?: (messageId: string) => void;
  onCancelCopilot?: (messageId: string) => void;
  onModifyCopilot?: (messageId: string) => void;
  onRegenerateCopilot?: (messageId: string) => void;
  onToggleDebriefField?: (messageId: string, key: JoyDebriefFieldKey) => void;
}

export function JoyAiMessageBubble({
  message,
  userDisplayName,
  userAvatarUrl,
  executingCopilotId,
  onConfirmCopilot,
  onCancelCopilot,
  onModifyCopilot,
  onRegenerateCopilot,
  onToggleDebriefField,
}: JoyAiMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {isUser ? (
        <Avatar
          name={userDisplayName}
          src={userAvatarUrl ?? undefined}
          size="sm"
          className="mt-1 shrink-0"
        />
      ) : (
        <div
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm"
          aria-label="Joy AI"
        >
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div className={`min-w-0 max-w-[85%] space-y-1 sm:max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`flex items-center gap-2 text-[11px] text-slate-400 ${isUser ? "justify-end" : "justify-start"}`}>
          <span className="font-medium text-slate-500">{isUser ? "Tu" : "Joy AI"}</span>
          <span aria-hidden>·</span>
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
        </div>

        <JoyChatMessageBubble
          message={message}
          embedded
          executingCopilotId={executingCopilotId}
          onConfirmCopilot={onConfirmCopilot}
          onCancelCopilot={onCancelCopilot}
          onModifyCopilot={onModifyCopilot}
          onRegenerateCopilot={onRegenerateCopilot}
          onToggleDebriefField={onToggleDebriefField}
        />
      </div>
    </div>
  );
}
