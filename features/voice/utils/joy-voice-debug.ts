/** Client-side debug timeline for Joy Drive voice (?debug=1). No secrets/tokens. */

export type JoyVoiceDebugPhase =
  | "MIC_BUTTON_CLICKED"
  | "MIC_PERMISSION"
  | "STREAM_LIVE"
  | "RECORDER_STARTED"
  | "CHUNK_RECEIVED"
  | "RECORDER_STOPPED"
  | "AUDIO_BLOB_READY"
  | "SPEECH_STARTED"
  | "SPEECH_RESULT"
  | "SPEECH_ERROR"
  | "SPEECH_FALLBACK"
  | "TRANSCRIBE_REQUEST"
  | "TRANSCRIBE_RESPONSE"
  | "TRANSCRIPT_SHOWN"
  | "COMMAND_SUBMITTED"
  | "COMMAND_EXECUTED"
  | "ERROR";

export interface JoyVoiceDebugEvent {
  id: string;
  phase: JoyVoiceDebugPhase;
  at: number;
  outcome: string;
  detail?: string;
}

let seq = 0;

export function createJoyVoiceDebugEvent(
  phase: JoyVoiceDebugPhase,
  outcome: string,
  detail?: string
): JoyVoiceDebugEvent {
  seq += 1;
  return {
    id: `dbg-${Date.now()}-${seq}`,
    phase,
    at: Date.now(),
    outcome: outcome.slice(0, 120),
    detail: detail ? detail.slice(0, 160) : undefined,
  };
}

export function formatDebugTime(at: number, startAt: number): string {
  const ms = Math.max(0, at - startAt);
  if (ms < 1000) return `+${ms}ms`;
  return `+${(ms / 1000).toFixed(1)}s`;
}

export function isJoyVoiceDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    return false;
  }
}
