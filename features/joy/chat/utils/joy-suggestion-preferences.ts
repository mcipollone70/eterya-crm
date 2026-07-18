/** Preferenze suggerimenti proattivi Joy — solo localStorage, niente sync server. */

const PREFS_STORAGE_KEY = "eterya-joy-suggestion-prefs";

export interface JoySuggestionPreferences {
  /** id suggerimento → ISO dismiss fino a (o "forever") */
  dismissed: Record<string, string>;
  /** tipi silenziati: coach | free_time | morning | eod */
  mutedKinds: string[];
  updatedAt?: string;
}

const EMPTY_PREFS: JoySuggestionPreferences = {
  dismissed: {},
  mutedKinds: [],
};

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadJoySuggestionPreferences(): JoySuggestionPreferences {
  const storage = readStorage();
  if (!storage) {
    return { ...EMPTY_PREFS };
  }
  try {
    const raw = storage.getItem(PREFS_STORAGE_KEY);
    if (!raw) {
      return { ...EMPTY_PREFS };
    }
    const parsed = JSON.parse(raw) as JoySuggestionPreferences;
    return {
      dismissed: parsed.dismissed ?? {},
      mutedKinds: Array.isArray(parsed.mutedKinds) ? parsed.mutedKinds : [],
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return { ...EMPTY_PREFS };
  }
}

export function persistJoySuggestionPreferences(
  prefs: JoySuggestionPreferences
): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({ ...prefs, updatedAt: new Date().toISOString() })
    );
  } catch {
    // ignore quota
  }
}

export function dismissJoySuggestion(
  id: string,
  untilIsoOrForever: string = "forever"
): JoySuggestionPreferences {
  const prefs = loadJoySuggestionPreferences();
  const next = {
    ...prefs,
    dismissed: { ...prefs.dismissed, [id]: untilIsoOrForever },
  };
  persistJoySuggestionPreferences(next);
  return next;
}

export function isJoySuggestionActive(
  id: string,
  kind?: string
): boolean {
  const prefs = loadJoySuggestionPreferences();
  if (kind && prefs.mutedKinds.includes(kind)) {
    return false;
  }
  const until = prefs.dismissed[id];
  if (!until) {
    return true;
  }
  if (until === "forever") {
    return false;
  }
  const ts = Date.parse(until);
  if (Number.isNaN(ts)) {
    return false;
  }
  return Date.now() > ts;
}

export function muteJoySuggestionKind(kind: string): JoySuggestionPreferences {
  const prefs = loadJoySuggestionPreferences();
  if (prefs.mutedKinds.includes(kind)) {
    return prefs;
  }
  const next = {
    ...prefs,
    mutedKinds: [...prefs.mutedKinds, kind],
  };
  persistJoySuggestionPreferences(next);
  return next;
}
