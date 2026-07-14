"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, X } from "lucide-react";
import { Button } from "@/components/ui";
import { updateVisitNotesAction } from "../actions/auto-mode-actions";
import { useSpeechRecognition } from "@/features/voice/hooks/use-speech-recognition";

interface AutoModeRecordSheetProps {
  visitId: string;
  companyId: string;
  companyName: string;
  initialNotes?: string | null;
  onClose: () => void;
  onSaved: (notes: string) => void;
}

export function AutoModeRecordSheet({
  visitId,
  companyId,
  companyName,
  initialNotes,
  onClose,
  onSaved,
}: AutoModeRecordSheetProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const appendTranscript = useCallback((chunk: string) => {
    const trimmed = chunk.trim();
    if (!trimmed) {
      return;
    }
    setNotes((current) => (current ? `${current.trimEnd()}\n${trimmed}` : trimmed));
  }, []);

  const {
    isSupported,
    isListening,
    interimTranscript,
    error: speechError,
    toggleListening,
  } = useSpeechRecognition({ onFinalChunk: appendTranscript });

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateVisitNotesAction(visitId, companyId, notes);
      if (!result.success) {
        setError(result.message);
        return;
      }
      onSaved(notes);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-3 sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-medium text-indigo-700">Registra visita</p>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{companyName}</h2>
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

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <Button
            type="button"
            size="lg"
            variant={isListening ? "danger" : "outline"}
            className="h-auto min-h-16 w-full text-lg"
            onClick={toggleListening}
            disabled={!isSupported}
          >
            <Mic className="h-6 w-6" />
            {isListening ? "Ferma dettatura" : "Detta note visita"}
          </Button>

          {!isSupported ? (
            <p className="text-base text-slate-500">
              Dettatura non disponibile su questo browser. Digita le note manualmente.
            </p>
          ) : null}

          {isListening && interimTranscript ? (
            <p className="text-base italic text-slate-500">In ascolto: {interimTranscript}</p>
          ) : null}

          {speechError ? <p className="text-base text-rose-700">{speechError}</p> : null}

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={8}
            placeholder="Note sulla visita in corso..."
            className="field-input w-full rounded-xl border border-slate-200 px-4 py-3 text-lg"
          />
        </div>

        <div className="space-y-3 border-t border-slate-200 p-4 sm:p-6">
          {error ? <p className="text-base text-rose-700">{error}</p> : null}
          <Button
            type="button"
            size="lg"
            className="h-auto min-h-16 w-full text-lg"
            disabled={isPending}
            onClick={handleSave}
          >
            {isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : null}
            Salva note
          </Button>
        </div>
      </div>
    </div>
  );
}
