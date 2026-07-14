export const VOICE_INTENT_OPTIONS = [
  { value: "visit_note", label: "Nota visita" },
  { value: "follow_up", label: "Follow-up" },
  { value: "reminder", label: "Promemoria" },
] as const;

export type VoiceIntent = (typeof VOICE_INTENT_OPTIONS)[number]["value"];

export function isVoiceIntent(value: string | undefined): value is VoiceIntent {
  return VOICE_INTENT_OPTIONS.some((option) => option.value === value);
}

export function defaultReminderTitle(transcript: string): string {
  const line = transcript.trim().split(/\n/)[0]?.trim() ?? "";
  if (!line) {
    return "Promemoria vocale";
  }
  return line.length > 80 ? `${line.slice(0, 77)}...` : line;
}
