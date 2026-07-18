/**
 * Day operational memory — typed, editable, clearable, localStorage only.
 * Survives refresh without DB migrations. Complements long-term + conversation memory.
 */

export type JoyDayOpsSlotStatus =
  | "planned"
  | "in_progress"
  | "done"
  | "cancelled"
  | "skipped";

export interface JoyDayOpsSlot {
  id: string;
  kind: "visit" | "call" | "follow_up" | "quote" | "other";
  title: string;
  companyId?: string | null;
  companyName?: string | null;
  status: JoyDayOpsSlotStatus;
  plannedAt?: string | null;
  note?: string | null;
}

export interface JoyDayOpsState {
  /** YYYY-MM-DD local day key */
  dayKey: string;
  goalNote?: string | null;
  freeMinutes?: number | null;
  earlyFinish: boolean;
  cancelledVisitCount: number;
  position?: { lat: number; lng: number; label?: string | null; at?: string | null } | null;
  nextActionPrompt?: string | null;
  slots: JoyDayOpsSlot[];
  overrides: Array<{
    id: string;
    decisionId?: string | null;
    note: string;
    at: string;
  }>;
  dismissedSuggestionIds: string[];
  updatedAt: string | null;
}

const STORAGE_KEY = "eterya-joy-day-ops-v1";

export function todayDayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function emptyJoyDayOps(dayKey = todayDayKey()): JoyDayOpsState {
  return {
    dayKey,
    goalNote: null,
    freeMinutes: null,
    earlyFinish: false,
    cancelledVisitCount: 0,
    position: null,
    nextActionPrompt: null,
    slots: [],
    overrides: [],
    dismissedSuggestionIds: [],
    updatedAt: null,
  };
}

function readStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalize(raw: Partial<JoyDayOpsState> | null, dayKey: string): JoyDayOpsState {
  const base = emptyJoyDayOps(dayKey);
  if (!raw || raw.dayKey !== dayKey) {
    return base;
  }
  return {
    ...base,
    goalNote: raw.goalNote ?? null,
    freeMinutes:
      typeof raw.freeMinutes === "number" && Number.isFinite(raw.freeMinutes)
        ? raw.freeMinutes
        : null,
    earlyFinish: Boolean(raw.earlyFinish),
    cancelledVisitCount: Math.max(0, Number(raw.cancelledVisitCount) || 0),
    position: raw.position ?? null,
    nextActionPrompt: raw.nextActionPrompt ?? null,
    slots: Array.isArray(raw.slots) ? raw.slots.slice(0, 40) : [],
    overrides: Array.isArray(raw.overrides) ? raw.overrides.slice(0, 30) : [],
    dismissedSuggestionIds: Array.isArray(raw.dismissedSuggestionIds)
      ? raw.dismissedSuggestionIds.slice(0, 40)
      : [],
    updatedAt: raw.updatedAt ?? null,
  };
}

export function loadJoyDayOps(dayKey = todayDayKey()): JoyDayOpsState {
  const storage = readStorage();
  if (!storage) return emptyJoyDayOps(dayKey);
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyJoyDayOps(dayKey);
    return normalize(JSON.parse(raw) as Partial<JoyDayOpsState>, dayKey);
  } catch {
    return emptyJoyDayOps(dayKey);
  }
}

export function persistJoyDayOps(state: JoyDayOpsState): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() })
    );
  } catch {
    // quota / private mode
  }
}

export function clearJoyDayOps(dayKey = todayDayKey()): JoyDayOpsState {
  const next = emptyJoyDayOps(dayKey);
  persistJoyDayOps(next);
  return next;
}

export function patchJoyDayOps(
  patch: Partial<Omit<JoyDayOpsState, "dayKey">>,
  dayKey = todayDayKey()
): JoyDayOpsState {
  const current = loadJoyDayOps(dayKey);
  const next: JoyDayOpsState = {
    ...current,
    ...patch,
    dayKey,
    slots: patch.slots ?? current.slots,
    overrides: patch.overrides ?? current.overrides,
    dismissedSuggestionIds:
      patch.dismissedSuggestionIds ?? current.dismissedSuggestionIds,
  };
  persistJoyDayOps(next);
  return next;
}

export function upsertJoyDayOpsSlot(
  slot: Omit<JoyDayOpsSlot, "id"> & { id?: string },
  dayKey = todayDayKey()
): JoyDayOpsState {
  const current = loadJoyDayOps(dayKey);
  const id = slot.id ?? `slot-${Date.now()}`;
  const nextSlot: JoyDayOpsSlot = {
    id,
    kind: slot.kind,
    title: slot.title.trim(),
    companyId: slot.companyId ?? null,
    companyName: slot.companyName ?? null,
    status: slot.status,
    plannedAt: slot.plannedAt ?? null,
    note: slot.note ?? null,
  };
  const others = current.slots.filter((item) => item.id !== id);
  return patchJoyDayOps({ slots: [nextSlot, ...others].slice(0, 40) }, dayKey);
}

export function markJoyDayEarlyFinish(dayKey = todayDayKey()): JoyDayOpsState {
  return patchJoyDayOps({ earlyFinish: true }, dayKey);
}

export function recordJoyDayCancellation(dayKey = todayDayKey()): JoyDayOpsState {
  const current = loadJoyDayOps(dayKey);
  return patchJoyDayOps(
    { cancelledVisitCount: current.cancelledVisitCount + 1 },
    dayKey
  );
}

export function setJoyDayFreeMinutes(
  freeMinutes: number,
  dayKey = todayDayKey()
): JoyDayOpsState {
  return patchJoyDayOps({ freeMinutes: Math.max(0, Math.round(freeMinutes)) }, dayKey);
}

export function setJoyDayPosition(
  position: { lat: number; lng: number; label?: string | null },
  dayKey = todayDayKey()
): JoyDayOpsState {
  return patchJoyDayOps(
    {
      position: {
        lat: position.lat,
        lng: position.lng,
        label: position.label ?? null,
        at: new Date().toISOString(),
      },
    },
    dayKey
  );
}

export function setJoyDayNextAction(
  prompt: string | null,
  dayKey = todayDayKey()
): JoyDayOpsState {
  return patchJoyDayOps({ nextActionPrompt: prompt }, dayKey);
}

export function recordJoyDayOverride(input: {
  note: string;
  decisionId?: string | null;
  dayKey?: string;
}): JoyDayOpsState {
  const dayKey = input.dayKey ?? todayDayKey();
  const current = loadJoyDayOps(dayKey);
  return patchJoyDayOps(
    {
      overrides: [
        {
          id: `override-${Date.now()}`,
          decisionId: input.decisionId ?? null,
          note: input.note.trim(),
          at: new Date().toISOString(),
        },
        ...current.overrides,
      ].slice(0, 30),
    },
    dayKey
  );
}

export function formatJoyDayOpsBrief(state: JoyDayOpsState): string | null {
  const parts: string[] = [];
  if (state.goalNote) parts.push(`obiettivo: ${state.goalNote.slice(0, 40)}`);
  if (state.freeMinutes != null && state.freeMinutes > 0) {
    parts.push(`${state.freeMinutes} min liberi`);
  }
  if (state.earlyFinish) parts.push("chiusura anticipata");
  if (state.cancelledVisitCount > 0) {
    parts.push(`${state.cancelledVisitCount} cancellazioni`);
  }
  const open = state.slots.filter((s) => s.status === "planned" || s.status === "in_progress");
  if (open.length > 0) parts.push(`${open.length} slot aperti`);
  if (state.nextActionPrompt) parts.push(`prossima: ${state.nextActionPrompt.slice(0, 36)}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
