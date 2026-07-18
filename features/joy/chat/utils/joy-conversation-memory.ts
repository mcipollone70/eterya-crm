import type { JoyChatMessage } from "../types/joy-chat";
import type { JoyConversationGoal, JoyConversationMemory } from "../types/joy-session";

const MEMORY_STORAGE_KEY = "eterya-joy-conversation-memory";

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
}

export function loadJoyConversationMemory(): JoyConversationMemory {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    // Prefer localStorage (persiste tra sessioni tab); migra da sessionStorage se presente.
    const localRaw = window.localStorage.getItem(MEMORY_STORAGE_KEY);
    if (localRaw) {
      return JSON.parse(localRaw) as JoyConversationMemory;
    }
    const sessionRaw = window.sessionStorage.getItem(MEMORY_STORAGE_KEY);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw) as JoyConversationMemory;
      try {
        window.localStorage.setItem(MEMORY_STORAGE_KEY, sessionRaw);
        window.sessionStorage.removeItem(MEMORY_STORAGE_KEY);
      } catch {
        // ignore quota / private mode
      }
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

export function persistJoyConversationMemory(memory: JoyConversationMemory): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      MEMORY_STORAGE_KEY,
      JSON.stringify({ ...memory, updatedAt: new Date().toISOString() })
    );
  } catch {
    // ignore quota errors
  }
}

export function clearJoyConversationMemory(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(MEMORY_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.removeItem(MEMORY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function mergeJoyConversationMemory(
  current: JoyConversationMemory,
  patch: Partial<JoyConversationMemory>
): JoyConversationMemory {
  const next: JoyConversationMemory = {
    ...current,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    ),
  };

  if (patch.tourDraft === null) {
    next.tourDraft = null;
  } else if (patch.tourDraft) {
    next.tourDraft = {
      ...(current.tourDraft ?? { phase: "intake" as const }),
      ...patch.tourDraft,
    };
  }

  return next;
}

function inferGoalFromText(text: string): JoyConversationGoal {
  const t = text.toLowerCase();
  if (/registra|debrief/.test(t)) return "debrief";
  if (/giro|tour|percorso/.test(t)) return "tour";
  if (/briefing|scheda/.test(t)) return "briefing";
  if (/coach|consigli|priorit/.test(t)) return "coach";
  if (/fine\s+giornata|riepiloga/.test(t)) return "end_of_day";
  if (/fatturare|obiettivo|target\s+vendite/.test(t)) return "sales_goal";
  if (/ore\s+liber|tempo\s+liber|due\s+ore/.test(t)) return "free_time";
  if (/buongiorno|inizia\s+la\s+giornata|prepara\s+(la\s+)?giornata|piano/.test(t)) {
    return "morning_plan";
  }
  if (/apri|cerca|azienda|cliente/.test(t)) return "search";
  return "general";
}

/** Estrae indizi di memoria da un messaggio utente (città, CAP, destinazione, goal). */
export function extractMemoryHintsFromUserText(text: string): Partial<JoyConversationMemory> {
  const patch: Partial<JoyConversationMemory> = {};
  const trimmed = text.trim();
  if (!trimmed) {
    return patch;
  }

  patch.conversationGoal = inferGoalFromText(trimmed);
  patch.lastContextDate = new Date().toISOString().slice(0, 10);

  const capMatch = trimmed.match(/\bCAP\s*(\d{5})\b/i) ?? trimmed.match(/\b(\d{5})\b/);
  if (capMatch?.[1]) {
    patch.lastCap = capMatch[1];
  }

  const provinceMatch = trimmed.match(
    /provincia(?:\s+di)?\s+([A-Za-zÀ-ù]{2,}(?:\s+[A-Za-zÀ-ù]{2,})?|\b[A-Za-z]{2}\b)/i
  );
  if (provinceMatch?.[1]) {
    patch.lastProvince = provinceMatch[1].trim();
  }

  // Non trattare «fino alle 16:00» come destinazione geografica.
  if (!/\bfino\s+alle\s+\d/i.test(trimmed) && !/\bentro\s+le\s+\d/i.test(trimmed)) {
    const destinazioneMatch = trimmed.match(
      /(?:fino a|arrivo a|destinazione|fine|termina(?:re)?(?:\s+a)?)\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,40})/i
    );
    if (destinazioneMatch?.[1]) {
      patch.lastDestinazione = destinazioneMatch[1].trim().replace(/[?.!,]+$/, "");
    }
  }

  const comuneMatch = trimmed.match(
    /(?:prospect|clienti|aziende|comune(?:\s+di)?|zona(?:\s+di)?)\s+\b(?:a|di|in)\b\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,40})/i
  ) ?? trimmed.match(
    /\b(?:a|di|in)\b\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,40})/i
  );
  if (comuneMatch?.[1]) {
    const stop =
      /^(che|mi|me|ci|ti|si|fino|alle|entro|con|per|oggi|domani|tengano|impegnato|impegnati|impegnino|impegnami|visite|tappe|prospect|clienti|aziende|ore|minuti|e|o|ma|poi|dopo|prima|via|viale|corso|piazza|cap|provincia|giro|tour)$/i;
    const parts = comuneMatch[1]
      .trim()
      .replace(/[?.!,;:]+$/g, "")
      .split(/\s+/)
      .filter(Boolean);
    const kept: string[] = [];
    for (const part of parts) {
      if (stop.test(part)) break;
      if (/^\d/.test(part)) break;
      kept.push(part);
      if (kept.length >= 3) break;
    }
    const candidate = kept.join(" ").trim();
    if (
      candidate.length > 2 &&
      !/^(oggi|domani|prospect|clienti|visite|giro|cap|alle|provincia)$/i.test(candidate)
    ) {
      patch.lastComune = candidate;
    }
  }

  const contactMatch = trimmed.match(
    /(?:referente|contatto|sig\.?\s*|sig\.ra\s*|con)\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,40})/i
  );
  if (contactMatch?.[1]) {
    const name = contactMatch[1].trim().replace(/[?.!,]+$/, "");
    if (name.length > 2 && !/^(il|la|un|una|cliente|azienda)$/i.test(name)) {
      patch.lastContactName = name;
    }
  }

  const goalMatch =
    trimmed.match(
      /(?:fatturare|obiettivo|target)\s*(?:di\s*)?(?:almeno\s*)?(\d+(?:[.,]\d+)?)\s*(k|mila)?/i
    ) ?? null;
  if (goalMatch?.[1]) {
    let amount = Number(goalMatch[1].replace(",", "."));
    if ((goalMatch[2] ?? "").toLowerCase().startsWith("k") || (goalMatch[2] ?? "").toLowerCase().startsWith("mila")) {
      amount *= 1000;
    }
    if (Number.isFinite(amount) && amount > 0) {
      patch.salesGoalAmount = amount;
      patch.salesGoalPeriod = /settiman/i.test(trimmed)
        ? "week"
        : /ann[oi]/i.test(trimmed)
          ? "year"
          : "month";
    }
  }

  return patch;
}

/** Aggiorna la memoria dalla risposta assistente (azioni azienda, pending Copilot). */
export function extractMemoryFromAssistantMessage(
  message: JoyChatMessage
): Partial<JoyConversationMemory> {
  const patch: Partial<JoyConversationMemory> = {};

  const openCompany = message.actions?.find((action) => action.kind === "open_company");
  if (openCompany) {
    const companyId = openCompany.href.match(/\/companies\/([^/?#]+)/)?.[1];
    if (companyId) {
      patch.lastCompanyId = companyId;
      patch.selectedClientId = companyId;
      const nameFromLabel = openCompany.label.replace(/^Apri\s+/i, "").trim();
      if (nameFromLabel) {
        patch.lastCompanyName = nameFromLabel;
        patch.selectedClientName = nameFromLabel;
      }
    }
  }

  const pending = message.pendingAction;
  if (pending?.operation) {
    patch.lastProposedAction = pending.title;
    const op = pending.operation;
    if ("companyId" in op && op.companyId) {
      patch.lastCompanyId = op.companyId;
      patch.selectedClientId = op.companyId;
    }
    if ("companyName" in op && op.companyName) {
      patch.lastCompanyName = op.companyName;
      patch.selectedClientName = op.companyName;
    }
    if (
      op.type === "create_visit" ||
      op.type === "update_visit" ||
      op.type === "cancel_visit" ||
      op.type === "complete_visit"
    ) {
      if ("visitId" in op && op.visitId) {
        patch.lastVisitId = op.visitId;
      }
    }
    if (op.type === "create_opportunity") {
      patch.lastOpportunityTitle = op.title;
      patch.conversationGoal = "debrief";
    }
    if (op.type === "create_quote") {
      patch.lastQuoteTitle = op.title;
    }
    if (op.type === "create_order") {
      patch.lastOrderTitle = op.title;
    }
    if (op.type === "create_follow_up" || op.type === "update_follow_up") {
      patch.lastFollowUpLabel =
        ("description" in op && op.description) ||
        `Follow-up ${op.companyName}`;
      if ("followUpId" in op && op.followUpId) {
        patch.lastFollowUpId = op.followUpId;
      }
    }
    if (op.type === "navigate" && op.href.includes("/giro-visite")) {
      patch.lastRouteLabel = op.label;
      patch.conversationGoal = "tour";
    }
  }

  for (const followOp of pending?.followUpOperations ?? []) {
    if (followOp.type === "create_opportunity") {
      patch.lastOpportunityTitle = followOp.title;
    }
    if (followOp.type === "create_follow_up") {
      patch.lastFollowUpLabel = followOp.description ?? `Follow-up ${followOp.companyName}`;
    }
    if (followOp.type === "complete_visit" && followOp.visitId) {
      patch.lastVisitId = followOp.visitId;
    }
  }

  return patch;
}

export function resolveCompanyQueryFromMemory(
  companyQuery: string | null | undefined,
  memory: JoyConversationMemory
): string | null {
  const trimmed = companyQuery?.trim() ?? "";
  if (trimmed) {
    return trimmed;
  }
  return memory.selectedClientName ?? memory.lastCompanyName ?? null;
}

export function formatMemoryBadge(memory: JoyConversationMemory): string | null {
  const parts: string[] = [];
  const client = memory.selectedClientName ?? memory.lastCompanyName;
  if (client) {
    parts.push(client);
  }
  if (memory.lastContactName) {
    parts.push(memory.lastContactName);
  }
  if (memory.lastComune) {
    parts.push(memory.lastComune);
  }
  if (memory.lastProvince) {
    parts.push(memory.lastProvince);
  }
  if (memory.lastCap) {
    parts.push(`CAP ${memory.lastCap}`);
  }
  if (memory.lastDestinazione) {
    parts.push(`→ ${memory.lastDestinazione}`);
  }
  if (memory.lastOpportunityTitle) {
    parts.push(memory.lastOpportunityTitle);
  }
  if (memory.lastProposedAction) {
    parts.push(memory.lastProposedAction);
  }
  if (memory.conversationGoal && memory.conversationGoal !== "general") {
    const goalLabels: Record<string, string> = {
      morning_plan: "piano",
      tour: "giro",
      debrief: "debrief",
      briefing: "briefing",
      coach: "coach",
      end_of_day: "fine giornata",
      search: "ricerca",
    };
    parts.push(goalLabels[memory.conversationGoal] ?? memory.conversationGoal);
  }
  if (memory.tourDraft?.phase === "intake") {
    parts.push("giro in definizione");
  } else if (memory.tourDraft?.phase === "proposed" || memory.tourDraft?.phase === "active") {
    const n = memory.tourDraft.stopCompanyIds?.length ?? 0;
    parts.push(n > 0 ? `giro ${n} tappe` : "giro proposto");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
