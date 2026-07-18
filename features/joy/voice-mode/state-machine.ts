import type { JoyGuideState } from "./types";

/** Allowed transitions for Joy guide-mode voice loop. */
const TRANSITIONS: Record<JoyGuideState, readonly JoyGuideState[]> = {
  idle: ["listening", "interpreting", "paused", "error"],
  listening: ["transcribing", "interpreting", "paused", "speaking", "idle", "error"],
  transcribing: ["interpreting", "listening", "paused", "error"],
  interpreting: ["confirming", "executing", "speaking", "listening", "paused", "error"],
  confirming: ["executing", "speaking", "listening", "paused", "idle", "error"],
  executing: ["speaking", "confirming", "listening", "paused", "error"],
  speaking: ["listening", "paused", "idle", "confirming", "error"],
  paused: ["listening", "idle", "speaking", "error"],
  error: ["idle", "listening", "paused"],
};

export function canTransition(
  from: JoyGuideState,
  to: JoyGuideState
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function transitionJoyGuideState(
  from: JoyGuideState,
  to: JoyGuideState
): JoyGuideState {
  if (!canTransition(from, to)) {
    throw new Error(`Transizione guida non valida: ${from} → ${to}`);
  }
  return to;
}

/** Soft transition: stays on `from` if illegal (UI-safe). */
export function tryTransitionJoyGuideState(
  from: JoyGuideState,
  to: JoyGuideState
): JoyGuideState {
  return canTransition(from, to) ? to : from;
}

/** Mic must be off while TTS or while executing/interpreting. */
export function shouldSuspendMic(state: JoyGuideState): boolean {
  return (
    state === "speaking" ||
    state === "interpreting" ||
    state === "executing" ||
    state === "transcribing" ||
    state === "paused" ||
    state === "idle" ||
    state === "error"
  );
}

/** After speaking (and not confirming), auto-resume listening. */
export function shouldAutoListenAfterSpeak(
  state: JoyGuideState,
  options?: { confirming?: boolean; paused?: boolean }
): boolean {
  if (options?.paused) return false;
  if (options?.confirming) return true;
  return state === "speaking" || state === "listening";
}
