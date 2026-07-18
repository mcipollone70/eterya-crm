"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarPlus, Loader2, Mic, Save } from "lucide-react";
import { Button, StickyActionBar } from "@/components/ui";
import { CompanySelect } from "@/features/companies/components/company-select";
import type { CompanySelectOption } from "@/features/companies/components/company-select";
import { saveFollowUpAction } from "@/features/activities/actions/follow-up-actions";
import { agendaSaveReminderAction } from "@/features/agenda/actions/agenda-actions";
import { saveVisitAction } from "@/features/visits/actions/visit-mutations";
import { CONTACT_HISTORY_TYPE_OPTIONS } from "@/lib/constants/contact-history";
import { FOLLOW_UP_PRIORITY_OPTIONS } from "@/lib/constants/follow-up";
import {
  defaultReminderTitle,
  VOICE_INTENT_OPTIONS,
  type VoiceIntent,
} from "@/lib/voice/constants";
import type { ActivityPriority } from "@/lib/supabase/types";
import { useSpeechRecognition } from "../hooks/use-speech-recognition";

interface VoiceOperationalHubProps {
  defaultCompanyId?: string;
  defaultIntent?: VoiceIntent;
}

function defaultDateTimeLocal(hoursAhead = 1): string {
  const date = new Date();
  date.setHours(date.getHours() + hoursAhead, 0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function defaultVisitDateTimeLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function VoiceOperationalHub({
  defaultCompanyId = "",
  defaultIntent = "visit_note",
}: VoiceOperationalHubProps) {
  const router = useRouter();
  const [intent, setIntent] = useState<VoiceIntent>(defaultIntent);
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [selectedCompany, setSelectedCompany] = useState<CompanySelectOption | null>(null);
  const [transcript, setTranscript] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultDateTimeLocal());
  const [visitCompletedAt, setVisitCompletedAt] = useState(defaultVisitDateTimeLocal());
  const [reminderTitle, setReminderTitle] = useState("");
  const [activityType, setActivityType] = useState("call");
  const [priority, setPriority] = useState<ActivityPriority>("medium");
  const [message, setMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const appendTranscript = useCallback((chunk: string) => {
    const trimmed = chunk.trim();
    if (!trimmed) {
      return;
    }
    setTranscript((current) => {
      const next = current ? `${current.trimEnd()}\n${trimmed}` : trimmed;
      setReminderTitle((title) =>
        intent === "reminder" && !title.trim() ? defaultReminderTitle(next) : title
      );
      return next;
    });
  }, [intent]);

  const {
    isSupported,
    isListening,
    interimTranscript,
    error: speechError,
    toggleListening,
  } = useSpeechRecognition({ onFinalChunk: appendTranscript });

  function handleReset() {
    setTranscript("");
    setMessage(null);
    setSubmitError(null);
    setReminderTitle("");
    setAwaitingConfirm(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitError(null);

    if (!transcript.trim()) {
      setSubmitError("Detta o inserisci il testo prima di salvare.");
      return;
    }

    if (intent !== "reminder" && !companyId) {
      setSubmitError("Seleziona un'azienda.");
      return;
    }

    if (intent === "reminder" && !reminderTitle.trim()) {
      setSubmitError("Inserisci un titolo per il promemoria.");
      return;
    }

    if (!awaitingConfirm) {
      setAwaitingConfirm(true);
      return;
    }

    startTransition(async () => {
      let result: { success: boolean; message: string };

      if (intent === "visit_note") {
        result = await saveVisitAction({
          companyId,
          completedAt: visitCompletedAt
            ? new Date(visitCompletedAt).toISOString()
            : new Date().toISOString(),
          outcome: null,
          notes: transcript.trim(),
          durationMinutes: null,
          nextCallbackAt: null,
        });
      } else if (intent === "follow_up") {
        result = await saveFollowUpAction({
          companyId,
          activityType,
          description: transcript.trim(),
          priority,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        });
      } else {
        result = await agendaSaveReminderAction({
          title: reminderTitle.trim(),
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
          notes: transcript.trim(),
          companyId: companyId || null,
        });
      }

      if (!result.success) {
        setSubmitError(result.message);
        return;
      }

      setMessage(result.message);
      handleReset();
      router.refresh();
    });
  }

  const selectedCompanyName = selectedCompany?.name ?? null;

  return (
    <div className="space-y-4 pb-24 sm:space-y-6 sm:pb-0">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-slate-900">Tipo operazione</p>
        <div className="flex flex-wrap gap-2">
          {VOICE_INTENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setIntent(option.value);
                if (option.value === "reminder" && transcript.trim() && !reminderTitle.trim()) {
                  setReminderTitle(defaultReminderTitle(transcript));
                }
              }}
              className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium sm:flex-none sm:h-9 ${
                intent === option.value
                  ? option.value === "visit_note"
                    ? "border-violet-200 bg-violet-50 text-violet-700"
                    : option.value === "follow_up"
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {option.value === "visit_note" && <CalendarPlus className="h-4 w-4" />}
              {option.value === "follow_up" && <Mic className="h-4 w-4" />}
              {option.value === "reminder" && <Bell className="h-4 w-4" />}
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <form id="voice-operational-form" onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        {selectedCompanyName && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
            Azienda: <span className="font-medium">{selectedCompanyName}</span>
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            Azienda {intent === "reminder" ? "(opzionale)" : ""}
          </span>
          <CompanySelect
            value={companyId}
            onChange={setCompanyId}
            onCompanyChange={setSelectedCompany}
            required={intent !== "reminder"}
            allowEmpty
            emptyLabel={intent === "reminder" ? "Nessuna azienda" : "Seleziona azienda"}
            placeholder={intent === "reminder" ? "Nessuna azienda" : "Seleziona azienda"}
            selectClassName="field-input"
            pinnedIds={defaultCompanyId ? [defaultCompanyId] : []}
          />
        </label>

        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">Dettatura vocale</p>
            {isSupported ? (
              <Button
                type="button"
                size="lg"
                variant={isListening ? "danger" : "outline"}
                className="w-full sm:w-auto sm:h-8 sm:px-3 sm:text-xs"
                onClick={toggleListening}
              >
                <Mic className="h-5 w-5 sm:h-4 sm:w-4" />
                {isListening ? "Ferma dettatura" : "Inizia dettatura"}
              </Button>
            ) : (
              <p className="text-xs text-slate-500">
                Browser non supportato — digita manualmente il testo sotto.
              </p>
            )}
          </div>
          {isListening && interimTranscript && (
            <p className="mb-2 text-xs italic text-slate-600">In ascolto: {interimTranscript}</p>
          )}
          {(speechError || submitError) && (
            <p className="mb-2 text-sm text-rose-700">{speechError ?? submitError}</p>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Testo trascritto (revisione obbligatoria)
            </span>
            <textarea
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              rows={6}
              required
              placeholder="Il testo apparirà qui dopo la dettatura. Puoi modificarlo prima di salvare."
              className="field-input w-full rounded-lg border border-slate-200 bg-white px-3"
            />
          </label>
        </div>

        {intent === "visit_note" && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Data visita</span>
            <input
              type="datetime-local"
              value={visitCompletedAt}
              onChange={(event) => setVisitCompletedAt(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        )}

        {intent === "follow_up" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Tipo attività</span>
              <select
                value={activityType}
                onChange={(event) => setActivityType(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {CONTACT_HISTORY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Priorità</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as ActivityPriority)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {FOLLOW_UP_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Scadenza follow-up</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
        )}

        {intent === "reminder" && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Titolo promemoria</span>
              <input
                type="text"
                value={reminderTitle}
                onChange={(event) => setReminderTitle(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Data e ora</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </>
        )}

        {message && <p className="text-sm text-emerald-700">{message}</p>}

        {awaitingConfirm && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Confermi il salvataggio?</p>
            <p className="mt-1 text-amber-800">
              Il testo trascritto verrà registrato solo dopo la conferma.
            </p>
          </div>
        )}

        <div className="hidden flex-wrap gap-2 sm:flex">
          <Button type="submit" size="sm" disabled={isPending || !transcript.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {awaitingConfirm ? "Conferma salvataggio" : "Conferma e salva"}
          </Button>
          {awaitingConfirm && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setAwaitingConfirm(false)}
            >
              Indietro
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleReset}>
            Annulla testo
          </Button>
        </div>

        <p className="hidden text-xs text-slate-500 sm:block">
          Nessun salvataggio automatico: rivedi sempre il testo trascritto e conferma con il pulsante
          Salva.
        </p>
      </form>

      {transcript.trim() && (
        <StickyActionBar className="sm:hidden">
          <div className="flex gap-2">
            <Button
              type="submit"
              form="voice-operational-form"
              size="lg"
              className="flex-1"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {awaitingConfirm ? "Conferma" : "Salva"}
            </Button>
            {awaitingConfirm ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={isPending}
                onClick={() => setAwaitingConfirm(false)}
              >
                Indietro
              </Button>
            ) : null}
          </div>
        </StickyActionBar>
      )}
    </div>
  );
}
