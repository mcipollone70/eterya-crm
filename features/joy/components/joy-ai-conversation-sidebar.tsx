"use client";

import { useCallback, useEffect, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { JoyAiConversation } from "../chat/utils/joy-ai-conversations";

function formatConversationDate(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface JoyAiConversationSidebarProps {
  conversations: JoyAiConversation[];
  activeConversationId: string;
  renamingId: string | null;
  renameValue: string;
  onSelect: (id: string) => void;
  onRenameStart: (conversation: JoyAiConversation) => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onDelete: (id: string) => void;
}

export function JoyAiConversationSidebar({
  conversations,
  activeConversationId,
  renamingId,
  renameValue,
  onSelect,
  onRenameStart,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onDelete,
}: JoyAiConversationSidebarProps) {
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const sorted = [...conversations].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );

  const handleRenameKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onRenameCommit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onRenameCancel();
      }
    },
    [onRenameCancel, onRenameCommit]
  );

  return (
    <div className="max-h-36 overflow-y-auto p-2 sm:max-h-48 lg:max-h-[calc(100dvh-14rem)]">
      {sorted.map((conversation) => {
        const isActive = conversation.id === activeConversationId;
        const isRenaming = renamingId === conversation.id;

        return (
          <div
            key={conversation.id}
            className={`group mb-1 flex items-start gap-1 rounded-lg px-2 py-1.5 transition-colors ${
              isActive ? "bg-indigo-50" : "hover:bg-slate-50"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              className="min-w-0 flex-1 text-left"
            >
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(event) => onRenameChange(event.target.value)}
                  onBlur={onRenameCommit}
                  onKeyDown={handleRenameKeyDown}
                  onClick={(event) => event.stopPropagation()}
                  className="w-full rounded border border-indigo-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-100"
                />
              ) : (
                <>
                  <p
                    className={`truncate text-sm ${
                      isActive ? "font-medium text-indigo-900" : "text-slate-700"
                    }`}
                  >
                    {conversation.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {formatConversationDate(conversation.updatedAt)}
                  </p>
                </>
              )}
            </button>

            {!isRenaming ? (
              <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-700"
                  title="Rinomina"
                  aria-label="Rinomina conversazione"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRenameStart(conversation);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                  title="Elimina"
                  aria-label="Elimina conversazione"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(conversation.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
