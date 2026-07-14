"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  type BrowserSpeechRecognition,
} from "@/lib/voice/browser-speech";

interface UseSpeechRecognitionOptions {
  lang?: string;
  onFinalChunk?: (text: string) => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { lang = "it-IT", onFinalChunk } = options;
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setInterimTranscript("");

    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      setError("Riconoscimento vocale non supportato su questo browser.");
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? "";
        if (!text) {
          continue;
        }
        if (result.isFinal) {
          onFinalChunk?.(text.trim());
        } else {
          interim += text;
        }
      }
      setInterimTranscript(interim.trim());
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setError(
          event.error === "not-allowed"
            ? "Permesso microfono negato."
            : `Errore riconoscimento vocale: ${event.error}`
        );
      }
      setIsListening(false);
      setInterimTranscript("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setError("Impossibile avviare il microfono.");
      setIsListening(false);
    }
  }, [lang, onFinalChunk]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
