"use client";

import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui";
import { useSpeechRecognition } from "../hooks/use-speech-recognition";

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function VoiceDictationButton({
  onTranscript,
  disabled = false,
  size = "sm",
}: VoiceDictationButtonProps) {
  const { isSupported, isListening, interimTranscript, error, toggleListening } =
    useSpeechRecognition({
      onFinalChunk: (chunk) => {
        onTranscript(chunk);
      },
    });

  if (!isSupported) {
    return (
      <p className="text-xs text-slate-500">
        Dettatura vocale non disponibile su questo browser. Usa Chrome o Edge, oppure digita il
        testo.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size={size}
        variant={isListening ? "danger" : "outline"}
        disabled={disabled}
        onClick={toggleListening}
      >
        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {isListening ? "Ferma dettatura" : "Detta"}
      </Button>
      {isListening && interimTranscript && (
        <p className="text-xs italic text-slate-500">In ascolto: {interimTranscript}</p>
      )}
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
