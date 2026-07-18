"use client";

import { useEffect, useState } from "react";
import {
  isJoyVoiceBusy,
  joyVoice,
  type JoyVoiceSnapshot,
} from "@/lib/voice/joy-voice-queue";

const INITIAL: JoyVoiceSnapshot = {
  state: "idle",
  engine: "none",
  enabled: true,
  lastText: null,
  lastDisplayText: null,
  warning: null,
  error: null,
  diagnostics: {
    provider: null,
    model: null,
    voice: null,
    fallbackActive: false,
    ttsRequestCount: 0,
    audioDurationSec: null,
    audioSizeBytes: null,
    cached: false,
    contentType: null,
    playError: null,
    httpStatus: null,
  },
};

export function useJoyVoice() {
  const [snapshot, setSnapshot] = useState<JoyVoiceSnapshot>(INITIAL);

  useEffect(() => {
    return joyVoice.subscribe(setSnapshot);
  }, []);

  return {
    ...snapshot,
    speak: joyVoice.speak,
    repeat: joyVoice.repeat,
    interrupt: joyVoice.interrupt,
    pause: joyVoice.pause,
    resume: joyVoice.resume,
    setEnabled: joyVoice.setEnabled,
    unlockFromUserGesture: joyVoice.unlockFromUserGesture,
    isSpeaking: isJoyVoiceBusy(snapshot.state),
    isPreparing: snapshot.state === "preparing" || snapshot.state === "ready",
  };
}
