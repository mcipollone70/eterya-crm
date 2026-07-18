import { joySafeLog } from "@/features/joy/os/logging/joy-safe-logger";
import type { JoyGuideState, JoyVoiceIntentType } from "./types";

export interface JoyVoiceDiagEvent {
  state?: JoyGuideState;
  intent?: JoyVoiceIntentType | null;
  confidence?: number | null;
  sttMs?: number | null;
  interpretMs?: number | null;
  ttsMs?: number | null;
  action?: string | null;
  errorCode?: string | null;
}

/** Safe diagnostic log — no PII, no secrets, truncated. */
export function logJoyVoiceDiag(
  phase: string,
  event: JoyVoiceDiagEvent = {}
): void {
  joySafeLog("info", "voice-mode", phase.slice(0, 80), {
    state: event.state ?? null,
    intent: event.intent ?? null,
    confidence:
      event.confidence != null ? Math.round(event.confidence * 100) / 100 : null,
    sttMs: event.sttMs ?? null,
    interpretMs: event.interpretMs ?? null,
    ttsMs: event.ttsMs ?? null,
    action: event.action ? event.action.slice(0, 40) : null,
    errorCode: event.errorCode ?? null,
  });
}
