/**
 * Long commercial life memory — localStorage only (no new DB tables).
 * Complements session JoyConversationMemory + joy_conversations.
 */

import type { JoyLongTermMemory } from "../types";

const STORAGE_KEY = "eterya-joy-long-memory-v1";

export const EMPTY_JOY_LONG_MEMORY: JoyLongTermMemory = {
  promises: [],
  preferences: {},
  clientNotes: [],
  successes: [],
  errors: [],
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

export function loadJoyLongTermMemory(): JoyLongTermMemory {
  const storage = readStorage();
  if (!storage) {
    return { ...EMPTY_JOY_LONG_MEMORY };
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...EMPTY_JOY_LONG_MEMORY };
    }
    const parsed = JSON.parse(raw) as JoyLongTermMemory;
    return {
      promises: Array.isArray(parsed.promises) ? parsed.promises : [],
      preferences: parsed.preferences ?? {},
      clientNotes: Array.isArray(parsed.clientNotes) ? parsed.clientNotes : [],
      successes: Array.isArray(parsed.successes) ? parsed.successes : [],
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      lastDayStartAt: parsed.lastDayStartAt ?? null,
      lastDayEndAt: parsed.lastDayEndAt ?? null,
      lastWeeklyReviewAt: parsed.lastWeeklyReviewAt ?? null,
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return { ...EMPTY_JOY_LONG_MEMORY };
  }
}

export function persistJoyLongTermMemory(memory: JoyLongTermMemory): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...memory, updatedAt: new Date().toISOString() })
    );
  } catch {
    // quota / private mode
  }
}

export function mergeJoyLongTermMemory(
  current: JoyLongTermMemory,
  patch: Partial<JoyLongTermMemory>
): JoyLongTermMemory {
  return {
    ...current,
    ...patch,
    preferences: {
      ...current.preferences,
      ...(patch.preferences ?? {}),
    },
    promises: patch.promises ?? current.promises,
    clientNotes: patch.clientNotes ?? current.clientNotes,
    successes: patch.successes ?? current.successes,
    errors: patch.errors ?? current.errors,
  };
}

export function recordJoyPromise(input: {
  text: string;
  companyId?: string | null;
  companyName?: string | null;
  dueDate?: string | null;
}): JoyLongTermMemory {
  const current = loadJoyLongTermMemory();
  const next = mergeJoyLongTermMemory(current, {
    promises: [
      {
        id: `promise-${Date.now()}`,
        text: input.text.trim(),
        companyId: input.companyId ?? null,
        companyName: input.companyName ?? null,
        dueDate: input.dueDate ?? null,
        createdAt: new Date().toISOString(),
      },
      ...current.promises,
    ].slice(0, 40),
  });
  persistJoyLongTermMemory(next);
  return next;
}

export function recordJoySuccess(text: string, companyId?: string | null): JoyLongTermMemory {
  const current = loadJoyLongTermMemory();
  const next = mergeJoyLongTermMemory(current, {
    successes: [
      {
        id: `success-${Date.now()}`,
        text: text.trim(),
        companyId: companyId ?? null,
        createdAt: new Date().toISOString(),
      },
      ...current.successes,
    ].slice(0, 30),
  });
  persistJoyLongTermMemory(next);
  return next;
}

export function recordJoyError(text: string): JoyLongTermMemory {
  const current = loadJoyLongTermMemory();
  const next = mergeJoyLongTermMemory(current, {
    errors: [
      {
        id: `error-${Date.now()}`,
        text: text.trim(),
        createdAt: new Date().toISOString(),
      },
      ...current.errors,
    ].slice(0, 30),
  });
  persistJoyLongTermMemory(next);
  return next;
}

export function upsertJoyClientNote(input: {
  companyId: string;
  companyName?: string | null;
  note: string;
}): JoyLongTermMemory {
  const current = loadJoyLongTermMemory();
  const others = current.clientNotes.filter((item) => item.companyId !== input.companyId);
  const next = mergeJoyLongTermMemory(current, {
    clientNotes: [
      {
        companyId: input.companyId,
        companyName: input.companyName ?? null,
        note: input.note.trim(),
        updatedAt: new Date().toISOString(),
      },
      ...others,
    ].slice(0, 50),
  });
  persistJoyLongTermMemory(next);
  return next;
}

export function markJoyDayStart(): JoyLongTermMemory {
  const current = loadJoyLongTermMemory();
  const next = mergeJoyLongTermMemory(current, {
    lastDayStartAt: new Date().toISOString(),
  });
  persistJoyLongTermMemory(next);
  return next;
}

export function markJoyDayEnd(): JoyLongTermMemory {
  const current = loadJoyLongTermMemory();
  const next = mergeJoyLongTermMemory(current, {
    lastDayEndAt: new Date().toISOString(),
  });
  persistJoyLongTermMemory(next);
  return next;
}

export function formatLongMemoryBrief(memory: JoyLongTermMemory): string | null {
  const parts: string[] = [];
  if (memory.promises.length > 0) {
    parts.push(`${memory.promises.length} promesse aperte`);
  }
  if (memory.preferences.preferredZones?.length) {
    parts.push(`zone: ${memory.preferences.preferredZones.slice(0, 3).join(", ")}`);
  }
  if (memory.successes[0]) {
    parts.push(`ultimo successo: ${memory.successes[0].text.slice(0, 40)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
