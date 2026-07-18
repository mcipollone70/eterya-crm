/**
 * Profilo vocale centrale Joy — solo sintesi vocale (OpenAI TTS).
 * La voce di produzione resta un default tecnico; la scelta definitiva
 * la fa l'utente dal pannello di confronto DEV.
 */

export const JOY_TTS_PROVIDER = "openai" as const;
export const JOY_TTS_MODEL = "gpt-4o-mini-tts" as const;

/**
 * Default tecnico corrente (non definitivo): l'utente confronta e sceglie.
 * Non impostare una voce "winner" in UI.
 */
export const JOY_TTS_VOICE = "marin" as const;
/** Tutte le voci supportate da gpt-4o-mini-tts nell'integrazione attuale. */
export type JoyTtsVoiceId =
  | "alloy"
  | "ash"
  | "ballad"
  | "coral"
  | "echo"
  | "fable"
  | "nova"
  | "onyx"
  | "sage"
  | "shimmer"
  | "verse"
  | "marin"
  | "cedar";

export const JOY_TTS_VOICES: ReadonlyArray<{
  id: JoyTtsVoiceId;
  label: string;
  note: string;
  /** Hint genere percettivo (solo confronto; non filtro). */
  genderHint: "female" | "male" | "neutral";
}> = [
  { id: "coral", label: "Coral", note: "Calda, amichevole", genderHint: "female" },
  { id: "nova", label: "Nova", note: "Energica, chiara", genderHint: "female" },
  { id: "shimmer", label: "Shimmer", note: "Leggera, brillante", genderHint: "female" },
  { id: "sage", label: "Sage", note: "Calma, misurata", genderHint: "female" },
  { id: "ballad", label: "Ballad", note: "Morbida, melodica", genderHint: "female" },
  { id: "marin", label: "Marin", note: "Naturale, conversazionale", genderHint: "female" },
  { id: "alloy", label: "Alloy", note: "Neutra, bilanciata", genderHint: "neutral" },
  { id: "ash", label: "Ash", note: "Chiara, articolata", genderHint: "neutral" },
  { id: "echo", label: "Echo", note: "Risonante, nitida", genderHint: "male" },
  { id: "fable", label: "Fable", note: "Espressiva, narrativa", genderHint: "neutral" },
  { id: "onyx", label: "Onyx", note: "Profonda, autorevole", genderHint: "male" },
  { id: "verse", label: "Verse", note: "Ritmica, poetica", genderHint: "neutral" },
  { id: "cedar", label: "Cedar", note: "Calda, stabile", genderHint: "male" },
] as const;

/** @deprecated Usa JOY_TTS_VOICES — alias per compatibilità pannello. */
export const JOY_TTS_AB_CANDIDATES = JOY_TTS_VOICES;

export const JOY_TTS_RESPONSE_FORMAT = "mp3" as const;

/**
 * Target conversazionale: poche frasi naturali (~8–20s tipici).
 * Continuity test / raw possono arrivare fino a MAX.
 */
export const JOY_SPOKEN_TARGET_CHARS = 420;
export const JOY_SPOKEN_MAX_CHARS = 900;
export const JOY_TTS_API_MAX_CHARS = 900;

/**
 * Instructions OpenAI: tono umano italiano, ritmo naturale, niente robot.
 */
export const JOY_TTS_INSTRUCTIONS = [
  "Speak exclusively in natural Italian as Joy, a warm adult Italian woman and commercial CRM colleague.",
  "Tone: professional, reassuring, lightly energetic — never advertising, never call-center, never navigator robot.",
  "Prosody: medium conversational pace; short natural pauses only at commas and sentence ends; varied intonation like a real person.",
  "Avoid: flat monotone, word-by-word chopping, exaggerated emphasis, childish or cartoon voice, rushed speech.",
  "Deliver the entire input as one continuous utterance with smooth breath groups.",
].join(" ");

export const JOY_VOICE_PROFILE = {
  id: "joy-it-commercial-female-v3",
  locale: "it-IT",
  displayName: "Joy — voce commerciale italiana",
  /** Default tecnico — non è la scelta definitiva utente. */
  defaultVoice: JOY_TTS_VOICE,
  semanticDescription: JOY_TTS_INSTRUCTIONS,
  openai: {
    provider: JOY_TTS_PROVIDER,
    model: JOY_TTS_MODEL,
    voice: JOY_TTS_VOICE,
    responseFormat: JOY_TTS_RESPONSE_FORMAT,
  },
} as const;

export type JoyVoiceProfile = typeof JOY_VOICE_PROFILE;

/** Frase standard per confronto voci (pannello DEV). */
export const JOY_VOICE_COMPARE_PHRASE =
  "Buongiorno Marco. Ho trovato quattro prospect a Latina e ho organizzato il percorso per tenerti impegnato fino alle sedici. Vuoi che ti mostri la prima azienda?";

/**
 * Frase lunga per test continuità ≥25s a ritmo naturale (~150 parole/min).
 * Una sola richiesta TTS → un solo MP3 continuo.
 */
export const JOY_VOICE_CONTINUITY_PHRASE = [
  "Buongiorno Marco. Ho trovato quattro prospect a Latina e ho organizzato il percorso per tenerti impegnato fino alle sedici.",
  "Il primo è Rossi Serramenti, poi trovi Bianchi Infissi e due aziende nuove zona sud.",
  "Ti tengo il ritmo senza fretta: partiamo dalla più calda, chiudiamo i follow-up e se vuoi ti leggo anche gli altri.",
  "Dimmi pure se preferisci partire subito oppure se vuoi prima un riepilogo breve del giro.",
].join(" ");

/** Testi di prova (solo ascolto — nessun salvataggio CRM). */
export const JOY_VOICE_TEST_SAMPLES = [
  {
    id: "compare",
    label: "Confronto",
    text: JOY_VOICE_COMPARE_PHRASE,
  },
  {
    id: "continuity",
    label: "Continuità 25s+",
    text: JOY_VOICE_CONTINUITY_PHRASE,
  },
  {
    id: "greeting",
    label: "Saluto",
    text: "Buongiorno, sono Joy. Sono pronta ad aiutarti con la giornata commerciale.",
  },
  {
    id: "briefing",
    label: "Briefing",
    text: "Hai tre priorità oggi: due follow-up in ritardo e una visita strategica vicino a te.",
  },
  {
    id: "confirm",
    label: "Conferma",
    text: "Ho una proposta pronta. Conferma, modifica, oppure dimmi un altro comando.",
  },
  {
    id: "followup",
    label: "Follow-up",
    text: "Ricorda di richiamare il cliente di questa mattina entro fine giornata.",
  },
] as const;

export function isJoyTtsVoiceId(value: string): value is JoyTtsVoiceId {
  return JOY_TTS_VOICES.some((v) => v.id === value);
}
