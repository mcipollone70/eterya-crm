/**
 * Web Speech API — NON usato come motore Joy in produzione.
 * Conservato solo per cancelBrowserSpeech (pulizia residui) e
 * isSpeechSynthesisSupported. La coda joy-voice-queue non auto-avvia
 * mai questa sintesi robotica.
 */

let sessionVoice: SpeechSynthesisVoice | null = null;
let voicesReadyPromise: Promise<void> | null = null;
let lastFallbackWarning: string | null = null;

const BROWSER_LANG = "it-IT";
const BROWSER_RATE = 0.96;
const BROWSER_PITCH = 1.02;

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function getBrowserTtsWarning(): string | null {
  return lastFallbackWarning;
}

function waitForVoices(): Promise<void> {
  if (!isSpeechSynthesisSupported()) {
    return Promise.resolve();
  }

  if (voicesReadyPromise) {
    return voicesReadyPromise;
  }

  voicesReadyPromise = new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve();
      return;
    }

    const onChanged = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onChanged);
      resolve();
    };
    window.speechSynthesis.addEventListener("voiceschanged", onChanged);
    window.setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onChanged);
      resolve();
    }, 1500);
  });

  return voicesReadyPromise;
}

function scoreItalianFemaleVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  if (!lang.startsWith("it")) {
    return -1;
  }

  let score = 10;
  if (lang === "it-it") score += 5;
  if (
    /female|donna|elsa|paola|alice|silvia|federica|giorgia|milena|claire|sabina|zira/.test(
      name
    )
  ) {
    score += 8;
  }
  if (/male|uomo|luca|diego|cosimo|pietro|mark|david/.test(name)) {
    score -= 6;
  }
  if (voice.localService) score += 2;
  return score;
}

function pickSessionItalianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (sessionVoice) {
    const stillThere = voices.find(
      (voice) => voice.voiceURI === sessionVoice?.voiceURI && voice.name === sessionVoice.name
    );
    if (stillThere) {
      return stillThere;
    }
  }

  const ranked = voices
    .map((voice) => ({ voice, score: scoreItalianFemaleVoice(voice) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score);

  sessionVoice = ranked[0]?.voice ?? null;

  if (!sessionVoice) {
    lastFallbackWarning =
      "Nessuna voce italiana affidabile sul dispositivo.";
  } else {
    lastFallbackWarning = null;
  }

  return sessionVoice;
}

export function cancelBrowserSpeech(): void {
  if (!isSpeechSynthesisSupported()) {
    return;
  }
  window.speechSynthesis.cancel();
}

/**
 * @deprecated Non chiamato dalla coda Joy. Mantenuto per test manuali isolati.
 */
export async function speakWithBrowserFallback(text: string): Promise<"ok" | "no_voice"> {
  if (!isSpeechSynthesisSupported() || !text.trim()) {
    return "no_voice";
  }

  await waitForVoices();
  cancelBrowserSpeech();

  const spoken = text.trim();
  const voices = window.speechSynthesis.getVoices();
  const voice = pickSessionItalianVoice(voices);

  if (!voice) {
    return "no_voice";
  }

  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = BROWSER_LANG;
    utterance.rate = BROWSER_RATE;
    utterance.pitch = BROWSER_PITCH;
    utterance.voice = voice;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const keepAlive = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        window.clearInterval(keepAlive);
        return;
      }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10_000);

    utterance.onend = () => {
      window.clearInterval(keepAlive);
      finish();
    };
    utterance.onerror = () => {
      window.clearInterval(keepAlive);
      finish();
    };

    window.speechSynthesis.speak(utterance);
  });

  return "ok";
}
