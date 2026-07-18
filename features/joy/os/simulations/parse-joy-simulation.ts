/**
 * Pure simulation intent detector — client + server safe (no DB).
 */

export type JoySimulationScenario =
  | "extra_visits"
  | "latina_only"
  | "more_showroom"
  | "follow_all_quotes"
  | "prioritize_vepa";

export function parseJoySimulationRequest(
  message: string
): JoySimulationScenario | null {
  const text = message
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (!text) return null;

  const isSim =
    /simula|simulazione|what\s*if|e\s+se|scenario|ipotizz/.test(text) ||
    /se\s+(facessi|facciamo|visitassi|seguissi|priorit)/.test(text);

  if (/latina/.test(text) && (isSim || /solo\s+latina|focus\s+latina/.test(text))) {
    return "latina_only";
  }
  if (/showroom/.test(text) && (isSim || /piu\s+showroom|più\s+showroom/.test(text))) {
    return "more_showroom";
  }
  if (
    /preventiv/.test(text) &&
    (isSim || /segui(ssi|re)?\s+tutti|tutti\s+i\s+preventivi/.test(text))
  ) {
    return "follow_all_quotes";
  }
  if (/\bvepa\b/.test(text) && (isSim || /priorit/.test(text))) {
    return "prioritize_vepa";
  }
  if (
    (isSim || /visite\s+in\s+piu|visite\s+extra|una\s+visita\s+in\s+piu/.test(text)) &&
    /visit/.test(text)
  ) {
    return "extra_visits";
  }
  if (isSim && /latina/.test(text)) return "latina_only";
  if (isSim && /showroom/.test(text)) return "more_showroom";
  if (isSim && /preventiv/.test(text)) return "follow_all_quotes";
  if (isSim && /\bvepa\b/.test(text)) return "prioritize_vepa";
  if (isSim) return "extra_visits";
  return null;
}
