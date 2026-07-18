"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { CompanySelect } from "@/features/companies/components/company-select";
import { saveFollowUpAction } from "@/features/activities/actions/follow-up-actions";
import {
  completeScheduledVisitAction,
  scheduleVisitAction,
} from "@/features/visits/actions/visit-mutations";
import { VoiceNotesInput } from "@/features/voice/components/voice-notes-input";
import { CONTACT_HISTORY_TYPE_OPTIONS } from "@/lib/constants/contact-history";
import { VISIT_OUTCOME_OPTIONS } from "@/lib/constants/last-visit";
import type { AutoModeAppointment } from "../types/auto-mode";

interface AutoModeCompletionSheetProps {
  appointment: AutoModeAppointment;
  pendingNotes: string;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onCompleted: () => void;
}

function defaultDateTimeLocal(hoursAhead = 24): string {
  const date = new Date();
  date.setHours(date.getHours() + hoursAhead, 0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function defaultNextVisitDateTimeLocal(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AutoModeCompletionSheet({
  appointment,
  pendingNotes,
  userLocation,
  onClose,
  onCompleted,
}: AutoModeCompletionSheetProps) {
  const router = useRouter();
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState(pendingNotes || appointment.notes || "");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpAt, setFollowUpAt] = useState(defaultDateTimeLocal());
  const [followUpType, setFollowUpType] = useState("call");
  const [nextVisitEnabled, setNextVisitEnabled] = useState(false);
  const [nextVisitCompanyId, setNextVisitCompanyId] = useState(appointment.companyId);
  const [nextVisitAt, setNextVisitAt] = useState(defaultNextVisitDateTimeLocal());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);

    if (!outcome) {
      setError("Seleziona l'esito della visita.");
      return;
    }

    startTransition(async () => {
      const completeResult = await completeScheduledVisitAction(
        appointment.visitId,
        appointment.companyId,
        {
          completedAt: new Date().toISOString(),
          outcome,
          notes: notes.trim() || null,
          durationMinutes: null,
          nextCallbackAt: followUpEnabled ? new Date(followUpAt).toISOString() : null,
          checkInLatitude: userLocation?.lat ?? null,
          checkInLongitude: userLocation?.lng ?? null,
        }
      );

      if (!completeResult.success) {
        setError(completeResult.message);
        return;
      }

      if (followUpEnabled) {
        const followUpResult = await saveFollowUpAction({
          companyId: appointment.companyId,
          activityType: followUpType,
          description: notes.trim() || null,
          scheduledAt: new Date(followUpAt).toISOString(),
        });

        if (!followUpResult.success) {
          setError(followUpResult.message);
          return;
        }
      }

      if (nextVisitEnabled && nextVisitCompanyId && nextVisitAt) {
        const scheduleResult = await scheduleVisitAction({
          companyId: nextVisitCompanyId,
          scheduledAt: new Date(nextVisitAt).toISOString(),
          notes: null,
        });

        if (!scheduleResult.success) {
          setError(scheduleResult.message);
          return;
        }
      }

      router.refresh();
      onCompleted();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-3 sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-medium text-emerald-700">Fine visita</p>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{appointment.companyName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target flex items-center justify-center rounded-xl border border-slate-200 text-slate-600"
            aria-label="Chiudi"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Esito visita</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {VISIT_OUTCOME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setOutcome(option.value)}
                  className={`touch-target min-h-16 rounded-xl border px-3 py-3 text-base font-semibold transition-colors sm:text-lg ${
                    outcome === option.value
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Note vocali</h3>
            <div className="[&_textarea]:field-input [&_textarea]:min-h-[8rem] [&_textarea]:text-lg [&_span]:text-base">
              <VoiceNotesInput
                label="Note visita"
                value={notes}
                onChange={setNotes}
                rows={5}
                placeholder="Detta o scrivi le note della visita..."
              />
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-center gap-3 text-lg font-semibold text-slate-900">
              <input
                type="checkbox"
                checked={followUpEnabled}
                onChange={(event) => setFollowUpEnabled(event.target.checked)}
                className="h-5 w-5 rounded border-slate-300"
              />
              Pianifica follow-up
            </label>
            {followUpEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-base">
                  <span className="mb-1 block font-medium text-slate-700">Data e ora</span>
                  <input
                    type="datetime-local"
                    value={followUpAt}
                    onChange={(event) => setFollowUpAt(event.target.value)}
                    className="field-input w-full rounded-xl border border-slate-200 px-4 py-3"
                  />
                </label>
                <label className="block text-base">
                  <span className="mb-1 block font-medium text-slate-700">Tipo attività</span>
                  <select
                    value={followUpType}
                    onChange={(event) => setFollowUpType(event.target.value)}
                    className="field-input w-full rounded-xl border border-slate-200 px-4 py-3"
                  >
                    {CONTACT_HISTORY_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-center gap-3 text-lg font-semibold text-slate-900">
              <input
                type="checkbox"
                checked={nextVisitEnabled}
                onChange={(event) => setNextVisitEnabled(event.target.checked)}
                className="h-5 w-5 rounded border-slate-300"
              />
              Pianifica prossima visita
            </label>
            {nextVisitEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-base sm:col-span-2">
                  <span className="mb-1 block font-medium text-slate-700">Azienda</span>
                  <CompanySelect
                    value={nextVisitCompanyId}
                    onChange={setNextVisitCompanyId}
                    allowEmpty={false}
                    placeholder="Seleziona azienda"
                    selectClassName="field-input w-full rounded-xl border border-slate-200 px-4 py-3"
                    pinnedIds={[appointment.companyId]}
                  />
                </label>
                <label className="block text-base sm:col-span-2">
                  <span className="mb-1 block font-medium text-slate-700">Data e ora</span>
                  <input
                    type="datetime-local"
                    value={nextVisitAt}
                    onChange={(event) => setNextVisitAt(event.target.value)}
                    className="field-input w-full rounded-xl border border-slate-200 px-4 py-3"
                  />
                </label>
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-3 border-t border-slate-200 p-4 sm:p-6">
          {error ? <p className="text-base text-rose-700">{error}</p> : null}
          <Button
            type="button"
            size="lg"
            className="h-auto min-h-16 w-full text-lg"
            disabled={isPending}
            onClick={handleSubmit}
          >
            {isPending ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Check className="h-6 w-6" />
            )}
            Salva e passa alla prossima
          </Button>
          {nextVisitEnabled ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarPlus className="h-4 w-4" />
              La prossima visita verrà sincronizzata con Google Calendar se collegato.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
