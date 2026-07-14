import Link from "next/link";
import {
  Briefcase,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui";
import type { JoyChatActionButton, JoyChatMessage } from "../types/joy-chat";

const ACTION_ICONS: Partial<Record<JoyChatActionButton["kind"], typeof Sparkles>> = {
  open_company: Briefcase,
  plan_visit: CalendarPlus,
  call: Phone,
  navigate: MapPin,
  briefing: Sparkles,
  follow_up: MessageSquare,
};

function renderMessageContent(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

interface JoyChatMessageBubbleProps {
  message: JoyChatMessage;
  executingCopilotId?: string | null;
  onConfirmCopilot?: (messageId: string) => void;
  onCancelCopilot?: (messageId: string) => void;
}

export function JoyChatMessageBubble({
  message,
  executingCopilotId,
  onConfirmCopilot,
  onCancelCopilot,
}: JoyChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const pending = message.pendingAction;
  const isExecuting = pending && executingCopilotId === pending.id;
  const showCopilotConfirm =
    pending?.status === "pending" && onConfirmCopilot && onCancelCopilot;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] space-y-3 sm:max-w-[80%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            isUser
              ? "bg-indigo-600 text-white"
              : "border border-slate-200 bg-white text-slate-700"
          }`}
        >
          <div className="whitespace-pre-wrap">
            {isUser ? message.content : renderMessageContent(message.content)}
          </div>
        </div>

        {!isUser && pending && pending.status === "executed" ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            Azione completata
          </div>
        ) : null}

        {!isUser && pending && pending.status === "cancelled" ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <X className="h-4 w-4" />
            Azione annullata
          </div>
        ) : null}

        {!isUser && showCopilotConfirm ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Conferma azione Copilot
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{pending.title}</p>
            <p className="mt-0.5 text-xs text-slate-600">{pending.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={Boolean(isExecuting)}
                onClick={() => onConfirmCopilot(message.id)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isExecuting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Conferma
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(isExecuting)}
                onClick={() => onCancelCopilot(message.id)}
              >
                Annulla
              </Button>
            </div>
          </div>
        ) : null}

        {!isUser && message.items && message.items.length > 0 && (
          <ul className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            {message.items.map((item) => (
              <li key={item.id} className="text-xs text-slate-600">
                <span className="font-medium text-slate-900">{item.title}</span>
                {item.subtitle ? ` · ${item.subtitle}` : ""}
              </li>
            ))}
          </ul>
        )}

        {!isUser && message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.actions.map((action) => {
              const Icon = ACTION_ICONS[action.kind];
              const isExternal = action.external || action.href.startsWith("tel:");
              const className = "inline-flex";

              if (isExternal) {
                return (
                  <a
                    key={action.id}
                    href={action.href}
                    target={action.href.startsWith("tel:") ? undefined : "_blank"}
                    rel={action.href.startsWith("tel:") ? undefined : "noopener noreferrer"}
                    className={className}
                  >
                    <Button variant="outline" size="sm" type="button">
                      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                      {action.label}
                      {!action.href.startsWith("tel:") ? (
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      ) : null}
                    </Button>
                  </a>
                );
              }

              return (
                <Link key={action.id} href={action.href} className={className}>
                  <Button variant="outline" size="sm" type="button">
                    {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                    {action.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
