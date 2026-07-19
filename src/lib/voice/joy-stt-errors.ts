/** User-facing STT error messages — distinct per failure mode. No secrets. */

export type JoySttErrorCode =
  | "mic_denied"
  | "mic_unavailable"
  | "no_audio"
  | "empty_blob"
  | "recorder_unsupported"
  | "recorder_failed"
  | "speech_no_result"
  | "speech_network"
  | "speech_aborted"
  | "speech_other"
  | "offline"
  | "auth"
  | "not_configured"
  | "transcribe_http"
  | "transcribe_empty"
  | "transcribe_upstream"
  | "too_long"
  | "unknown";

export const JOY_STT_ERROR_MESSAGES: Record<JoySttErrorCode, string> = {
  mic_denied: "Permesso microfono negato. Abilitalo nelle impostazioni del browser.",
  mic_unavailable: "Microfono non disponibile su questo dispositivo.",
  no_audio: "Non ho ricevuto audio. Riprova tenendo premuto o parlando più vicino.",
  empty_blob: "Non ho ricevuto audio (registrazione vuota). Riprova.",
  recorder_unsupported: "Registrazione audio non supportata su questo browser.",
  recorder_failed: "Registrazione audio non riuscita. Riprova.",
  speech_no_result: "Non ho capito. Riprova o usa la registrazione.",
  speech_network: "Riconoscimento vocale online non disponibile. Provo con registrazione.",
  speech_aborted: "Ascolto interrotto.",
  speech_other: "Errore riconoscimento vocale. Riprova.",
  offline: "Sei offline. Serve connessione per trascrivere.",
  auth: "Sessione scaduta. Ricarica la pagina e riprova.",
  not_configured: "Trascrizione non configurata sul server. Contatta l'amministratore.",
  transcribe_http: "Errore di rete durante la trascrizione. Riprova.",
  transcribe_empty: "Trascrizione vuota. Ripeti il comando più chiaramente.",
  transcribe_upstream: "Servizio di trascrizione temporaneamente non disponibile.",
  too_long: "Registrazione troppo lunga (max 30 secondi).",
  unknown: "Errore imprevisto durante l'ascolto. Riprova.",
};

export function joySttMessage(code: JoySttErrorCode): string {
  return JOY_STT_ERROR_MESSAGES[code];
}

export function mapSpeechRecognitionError(error: string): JoySttErrorCode {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "mic_denied";
    case "no-speech":
      return "speech_no_result";
    case "network":
      return "speech_network";
    case "aborted":
      return "speech_aborted";
    case "audio-capture":
      return "mic_unavailable";
    default:
      return "speech_other";
  }
}
