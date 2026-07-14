"use client";

import { useCallback } from "react";
import { VoiceDictationButton } from "./voice-dictation-button";

interface VoiceNotesInputProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  label?: string;
  required?: boolean;
  name?: string;
}

export function VoiceNotesInput({
  value,
  onChange,
  rows = 3,
  placeholder,
  label = "Testo",
  required = false,
  name,
}: VoiceNotesInputProps) {
  const appendTranscript = useCallback(
    (chunk: string) => {
      const trimmed = chunk.trim();
      if (!trimmed) {
        return;
      }
      onChange(value ? `${value.trimEnd()}\n${trimmed}` : trimmed);
    },
    [onChange, value]
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <VoiceDictationButton onTranscript={appendTranscript} />
      </div>
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      {value && (
        <p className="text-xs text-slate-500">
          Trascrizione in revisione — modifica il testo e conferma con Salva.
        </p>
      )}
    </div>
  );
}
