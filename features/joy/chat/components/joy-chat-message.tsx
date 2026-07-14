import Link from "next/link";
import {
  Briefcase,
  CalendarPlus,
  ExternalLink,
  MapPin,
  MessageSquare,
  Phone,
  Sparkles,
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
}

export function JoyChatMessageBubble({ message }: JoyChatMessageBubbleProps) {
  const isUser = message.role === "user";

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
