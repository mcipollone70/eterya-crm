"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarClock,
  Check,
  Loader2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Target,
  User,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { CalendarSyncBadge } from "@/features/calendar-sync/components/calendar-sync-badge";
import {
  AGENDA_KIND_COLORS,
  AGENDA_KIND_LABELS,
  type AgendaItem,
} from "@/lib/constants/agenda";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import { formatVisitDate } from "@/lib/last-visit/format";
import { CompleteVisitForm } from "@/features/visits/components/complete-visit-form";
import { parseAgendaItemId } from "@/lib/constants/agenda";
import {
  agendaCancelItemAction,
  agendaCompleteItemAction,
  agendaPostponeFollowUpAction,
  agendaUpdateItemAction,
} from "../actions/agenda-actions";

interface AgendaItemRowProps {
  item: AgendaItem;
  compact?: boolean;
  calendarSyncStatus?: string;
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AgendaItemRow({
  item,
  compact = false,
  calendarSyncStatus,
}: AgendaItemRowProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const parsed = parseAgendaItemId(item.id);
  const sourceId = parsed?.sourceId ?? "";

  function handleQuickComplete() {
    startTransition(async () => {
      const result = await agendaCompleteItemAction(item.id, item.companyId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await agendaCancelItemAction(item.id, item.companyId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function handlePostpone() {
    startTransition(async () => {
      if (!item.companyId) {
        return;
      }
      const result = await agendaPostponeFollowUpAction(item.id, item.companyId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const scheduledRaw = String(formData.get("scheduled_at") ?? "");

    startTransition(async () => {
      const result = await agendaUpdateItemAction({
        compositeId: item.id,
        companyId: item.companyId,
        scheduledAt: scheduledRaw ? new Date(scheduledRaw).toISOString() : undefined,
        notes: String(formData.get("notes") ?? "") || null,
        title: item.kind === "reminder" ? String(formData.get("title") ?? "") : undefined,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div
      className={`rounded-lg border p-3 ${AGENDA_KIND_COLORS[item.kind]} ${
        compact ? "text-xs" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{item.title}</span>
            <Badge variant="default">{AGENDA_KIND_LABELS[item.kind]}</Badge>
            <Badge variant="muted">{item.statusLabel}</Badge>
            {item.priority && <Badge variant="warning">{item.priority}</Badge>}
            <CalendarSyncBadge status={calendarSyncStatus} />
          </div>

          <p className="text-slate-700">{formatVisitDate(item.scheduledAt)}</p>

          {item.companyName && (
            <p className="text-slate-600">
              {item.companyName}
              {item.contactName ? ` · ${item.contactName}` : ""}
            </p>
          )}

          {item.notes && !compact && <p className="text-slate-600">{item.notes}</p>}

          {item.operatorName && !compact && (
            <p className="text-xs text-slate-500">Agente: {item.operatorName}</p>
          )}
        </div>

        {!compact && item.canComplete && !isEditing && (
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <div className="flex flex-wrap gap-1">
              {item.kind === "visit" && item.companyId ? (
                <CompleteVisitForm
                  visitId={sourceId}
                  companyId={item.companyId}
                  defaultNotes={item.notes}
                  compact
                />
              ) : (
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:w-auto sm:h-8 sm:px-3 sm:text-xs"
                  disabled={isPending}
                  onClick={handleQuickComplete}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Completa
                </Button>
              )}
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="hidden sm:inline-flex sm:h-8 sm:px-3 sm:text-xs"
                onClick={() => setShowMoreActions((prev) => !prev)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full sm:hidden"
                onClick={() => setShowMoreActions((prev) => !prev)}
              >
                <MoreHorizontal className="h-4 w-4" />
                Altre azioni
              </Button>
            </div>
            <div className={`flex flex-wrap gap-1 ${showMoreActions ? "flex" : "hidden sm:flex"}`}>
                {item.canEdit && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4" />
                    Modifica
                  </Button>
                )}
                {item.kind === "follow_up" && item.companyId && (
                  <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handlePostpone}>
                    <CalendarClock className="h-4 w-4" />
                    Rimanda
                  </Button>
                )}
                {item.canEdit && (
                  <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleCancel}>
                    <X className="h-4 w-4" />
                    Annulla
                  </Button>
                )}
              </div>
          </div>
        )}
      </div>

      {!compact && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {item.companyId && (
            <Link
              href={`/companies/${item.companyId}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/60 bg-white/70 px-2.5 py-2 text-xs font-medium hover:bg-white"
            >
              <Building2 className="h-3 w-3" />
              Azienda
            </Link>
          )}
          {item.contactId && (
            <Link
              href={`/contacts/${item.contactId}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/60 bg-white/70 px-2.5 py-2 text-xs font-medium hover:bg-white"
            >
              <User className="h-3 w-3" />
              Contatto
            </Link>
          )}
          {item.kind === "visit" && item.companyId && (
            <>
              <Link
                href={`/visits?company=${item.companyId}&briefing=${item.companyId}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/60 bg-white/70 px-2.5 py-2 text-xs font-medium hover:bg-white"
              >
                <Sparkles className="h-3 w-3" />
                Briefing
              </Link>
              <Link
                href={`/visits?company=${item.companyId}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/60 bg-white/70 px-2.5 py-2 text-xs font-medium hover:bg-white"
              >
                <MapPin className="h-3 w-3" />
                Visita
              </Link>
            </>
          )}
          {item.companyId && (
            <Link
              href={companyRegisterVisitHref(item.companyId)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/60 bg-white/70 px-2.5 py-2 text-xs font-medium hover:bg-white"
            >
              <MapPin className="h-3 w-3" />
              Registra
            </Link>
          )}
          {item.opportunityId && (
            <Link
              href="/opportunities"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/60 bg-white/70 px-2.5 py-2 text-xs font-medium hover:bg-white"
            >
              <Target className="h-3 w-3" />
              {item.opportunityTitle ?? "Opportunità"}
            </Link>
          )}
        </div>
      )}

      {isEditing && (
        <form onSubmit={handleEditSubmit} className="mt-3 space-y-3 rounded-lg border border-white/70 bg-white/80 p-3">
          {item.kind === "reminder" && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Titolo</span>
              <input
                type="text"
                name="title"
                defaultValue={item.title}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Data e ora</span>
            <input
              type="datetime-local"
              name="scheduled_at"
              defaultValue={toDateTimeLocal(item.scheduledAt)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Note</span>
            <input
              type="text"
              name="notes"
              defaultValue={item.notes ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              Salva
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(false)}>
              Annulla
            </Button>
          </div>
        </form>
      )}

      {error && !isEditing && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
