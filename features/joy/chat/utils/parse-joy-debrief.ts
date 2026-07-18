import type {
  JoyCopilotOperation,
  JoyCopilotPendingAction,
  JoyDebriefFieldKey,
  JoyDebriefFieldToggle,
} from "../types/joy-chat";
import type { VisitOutcomeValue } from "@/lib/constants/last-visit";

export interface JoyDebriefProposal {
  notes: string;
  /** Esito interno debrief (prima del mapping CRM). */
  visitOutcome: string | null;
  /** Valore compatibile con visits.outcome. */
  crmVisitOutcome: VisitOutcomeValue | null;
  followUpSuggestion: string | null;
  followUpScheduledHint: string | null;
  opportunityTitle: string | null;
  opportunityProbability: number | null;
  reminderTitle: string | null;
  productInterests: string[];
  competitors: string[];
  customerRequests: string[];
  problems: string[];
  summaryText: string;
}

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Rileva comandi di debriefing post-visita. */
export function isJoyDebriefCommand(message: string): boolean {
  const text = normalize(message);
  return (
    /^(joy\s+)?registra\b/.test(text) ||
    /\bdebrief\b/.test(text) ||
    /registra\s+(la\s+)?(visita|nota|esito)/.test(text) ||
    /dopo\s+(la\s+)?visita/.test(text)
  );
}

/** Comandi vocali di modifica sulla proposta debrief già in conferma. */
export function isJoyDebriefVoiceEdit(message: string): boolean {
  const text = normalize(message);
  return (
    /togli\s+(preventivo|opportunita|follow.?up|promemoria|nota|esito)/.test(text) ||
    /rimuovi\s+(preventivo|opportunita|follow.?up|promemoria|nota|esito)/.test(text) ||
    /non\s+(creare|salvare)\s+(opportunita|follow.?up|promemoria|preventivo|nota)/.test(text) ||
    /senza\s+(opportunita|follow.?up|promemoria|preventivo|nota)/.test(text) ||
    /probabilit[aà]?\s*(?:al|a|=|:)?\s*\d{1,3}\s*%?/.test(text) ||
    /\d{1,3}\s*%/.test(text) ||
    /aggiungi\s+(follow.?up|opportunita|promemoria)/.test(text)
  );
}

function stripDebriefPrefix(message: string): string {
  return message
    .replace(/^(joy\s+)?registra[:\s,]*/i, "")
    .replace(/^debrief[:\s,]*/i, "")
    .trim();
}

function detectVisitOutcome(text: string): string | null {
  if (/ordine|ha\s+ordinato|chiuso\s+ordine/.test(text)) {
    return "ordine";
  }
  if (/preventivo|preventivato/.test(text)) {
    return "preventivo";
  }
  if (/interessat|positivo|buona\s+visita/.test(text)) {
    return "interessato";
  }
  if (/non\s+interess|rifiut|negativ/.test(text)) {
    return "non_interessato";
  }
  if (/assente|chiuso|non\s+trovat/.test(text)) {
    return "assente";
  }
  if (/richiam|richiamo|follow.?up|ricontatt/.test(text)) {
    return "da_richiamare";
  }
  if (/neutro|cos[iì]\s+cos[iì]/.test(text)) {
    return "neutro";
  }
  return null;
}

/** Mappa esiti debrief → valori schema CRM visits.outcome. */
export function mapDebriefOutcomeToCrm(
  outcome: string | null
): VisitOutcomeValue | null {
  if (!outcome) return null;
  switch (outcome) {
    case "ordine":
      return "ordine";
    case "preventivo":
      return "preventivo";
    case "interessato":
      return "positivo";
    case "non_interessato":
      return "non_interessato";
    case "assente":
      return "neutro";
    case "da_richiamare":
      return "neutro";
    case "neutro":
      return "neutro";
    case "positivo":
      return "positivo";
    case "negativo":
      return "negativo";
    default:
      return null;
  }
}

export function formatCrmOutcomeLabel(outcome: VisitOutcomeValue | null): string {
  if (!outcome) return "";
  const labels: Record<VisitOutcomeValue, string> = {
    positivo: "Positivo",
    neutro: "Neutro",
    negativo: "Negativo",
    non_interessato: "Non interessato",
    ordine: "Ordine",
    preventivo: "Preventivo richiesto",
  };
  return labels[outcome] ?? outcome;
}

function detectProductInterests(text: string): string[] {
  const interests: string[] = [];
  if (/\bvepa\b/.test(text)) {
    interests.push("VEPA");
  }
  if (/zanzarier/.test(text)) {
    interests.push("Zanzariere");
  }
  if (/tapparell/.test(text)) {
    interests.push("Tapparelle");
  }
  if (/persiane?/.test(text)) {
    interests.push("Persiane");
  }
  if (/porte?\b|portoncini/.test(text)) {
    interests.push("Porte");
  }
  if (/serrament/.test(text)) {
    interests.push("Serramenti");
  }
  if (/cassonett/.test(text)) {
    interests.push("Cassonetti");
  }
  return interests;
}

function detectCompetitors(text: string): string[] {
  const competitors: string[] = [];
  const match = text.match(
    /(?:concorrent[ei]|competitor|alternativa(?:\s+di)?|preferiscono|confrontano\s+con)\s+([a-z0-9àèéìòù\s&.'-]{2,40})/i
  );
  if (match?.[1]) {
    const name = match[1].trim().replace(/[?.!,]+$/, "");
    if (name.length > 1 && !/^(a|di|con|il|la|i|le)$/i.test(name)) {
      competitors.push(name);
    }
  }
  if (/concorrent|competitor/.test(text) && competitors.length === 0) {
    competitors.push("concorrenza menzionata");
  }
  return competitors;
}

function detectCustomerRequests(text: string): string[] {
  const requests: string[] = [];
  const patterns = [
    /(?:chiedono|chiede|richiedono|richiede|vogliono|vorrebbero)\s+([^.!?\n]{3,80})/gi,
    /(?:richiesta|request):\s*([^.!?\n]{3,80})/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[1]?.trim().replace(/[?.!,]+$/, "");
      if (value && value.length > 2) {
        requests.push(value);
      }
    }
  }
  return [...new Set(requests)].slice(0, 4);
}

function detectProblems(text: string): string[] {
  const problems: string[] = [];
  if (/prezzo\s+(?:alto|troppo)|costoso|budget/.test(text)) {
    problems.push("obiezione prezzo/budget");
  }
  if (/tempistiche|tempi\s+(?:lunghi|stretti)|consegna/.test(text)) {
    problems.push("obiezione tempi/consegna");
  }
  if (/qualit[aà]|difett|reclamo|problema/.test(text)) {
    problems.push("problema qualità/reclamo");
  }
  if (/assente|non\s+c'?era|chiuso/.test(text)) {
    problems.push("referente assente / sede chiusa");
  }
  const match = text.match(/(?:problema|criticita|criticità|ostacolo):\s*([^.!?\n]{3,80})/i);
  if (match?.[1]) {
    problems.push(match[1].trim());
  }
  return [...new Set(problems)].slice(0, 4);
}

function detectProbability(text: string, outcome: string | null): number | null {
  const pct = text.match(/(\d{1,3})\s*%/);
  if (pct) {
    const value = Number(pct[1]);
    if (Number.isFinite(value)) {
      return Math.max(5, Math.min(95, value));
    }
  }
  if (/alta\s+probabilit|molto\s+probabile|sicur[oa]/.test(text)) {
    return 75;
  }
  if (/media\s+probabilit|abbastanza\s+probabile/.test(text)) {
    return 50;
  }
  if (/bassa\s+probabilit|poco\s+probabile|difficile/.test(text)) {
    return 25;
  }
  if (outcome === "ordine") return 90;
  if (outcome === "preventivo") return 65;
  if (outcome === "interessato") return 45;
  if (outcome === "da_richiamare") return 35;
  if (outcome === "non_interessato") return 10;
  return null;
}

function detectFollowUpHint(text: string): string | null {
  if (/domani/.test(text)) return "domani";
  if (/venerd[iì]/.test(text)) return "venerdì";
  if (/luned[iì]/.test(text)) return "lunedì";
  if (/prossima\s+settimana/.test(text)) return "prossima settimana";
  const days = text.match(/tra\s+(\d+)\s+giorni?/);
  if (days) return `tra ${days[1]} giorni`;
  return null;
}

export function buildDebriefFields(params: {
  hasNote: boolean;
  hasVisitOutcome: boolean;
  hasFollowUp: boolean;
  hasOpportunity: boolean;
  hasReminder: boolean;
}): JoyDebriefFieldToggle[] {
  const fields: JoyDebriefFieldToggle[] = [];
  if (params.hasNote) {
    fields.push({ key: "note", label: "Nota", enabled: true });
  }
  if (params.hasVisitOutcome) {
    fields.push({ key: "visitOutcome", label: "Esito visita", enabled: true });
  }
  if (params.hasFollowUp) {
    fields.push({ key: "followUp", label: "Follow-up", enabled: true });
  }
  if (params.hasOpportunity) {
    fields.push({ key: "opportunity", label: "Opportunità", enabled: true });
  }
  if (params.hasReminder) {
    fields.push({ key: "reminder", label: "Promemoria", enabled: true });
  }
  return fields;
}

function setFieldEnabled(
  fields: JoyDebriefFieldToggle[] | undefined,
  key: JoyDebriefFieldKey,
  enabled: boolean
): JoyDebriefFieldToggle[] {
  const list = fields ?? [];
  const existing = list.find((item) => item.key === key);
  if (!existing) {
    if (!enabled) return list;
    const labels: Record<JoyDebriefFieldKey, string> = {
      note: "Nota",
      visitOutcome: "Esito visita",
      followUp: "Follow-up",
      opportunity: "Opportunità",
      reminder: "Promemoria",
    };
    return [...list, { key, label: labels[key], enabled: true }];
  }
  return list.map((item) => (item.key === key ? { ...item, enabled } : item));
}

/** Applica edit vocale a una pending debrief (checkbox + probabilità). */
export function applyJoyDebriefVoiceEdit(
  pending: JoyCopilotPendingAction,
  message: string
): JoyCopilotPendingAction | null {
  if (!pending.debriefFields || pending.debriefFields.length === 0) {
    return null;
  }
  if (!isJoyDebriefVoiceEdit(message)) {
    return null;
  }

  const text = normalize(message);
  let fields = [...pending.debriefFields];
  let followUps = [...(pending.followUpOperations ?? [])];
  let operation = pending.operation;
  let changed = false;

  const disable = (key: JoyDebriefFieldKey) => {
    fields = setFieldEnabled(fields, key, false);
    changed = true;
  };
  const enable = (key: JoyDebriefFieldKey) => {
    fields = setFieldEnabled(fields, key, true);
    changed = true;
  };

  if (/togli\s+preventivo|rimuovi\s+preventivo|senza\s+preventivo|non\s+(creare|salvare)\s+preventivo/.test(text)) {
    disable("opportunity");
  }
  if (
    /togli\s+opportunita|rimuovi\s+opportunita|senza\s+opportunita|non\s+(creare|salvare)\s+opportunita/.test(
      text
    )
  ) {
    disable("opportunity");
  }
  if (
    /togli\s+follow.?up|rimuovi\s+follow.?up|senza\s+follow.?up|non\s+(creare|salvare)\s+follow.?up/.test(
      text
    )
  ) {
    disable("followUp");
  }
  if (
    /togli\s+promemoria|rimuovi\s+promemoria|senza\s+promemoria|non\s+(creare|salvare)\s+promemoria/.test(
      text
    )
  ) {
    disable("reminder");
  }
  if (/togli\s+nota|rimuovi\s+nota|senza\s+nota|non\s+(creare|salvare)\s+nota/.test(text)) {
    disable("note");
  }
  if (/togli\s+esito|rimuovi\s+esito|senza\s+esito/.test(text)) {
    disable("visitOutcome");
  }

  if (/aggiungi\s+follow.?up/.test(text)) enable("followUp");
  if (/aggiungi\s+opportunita/.test(text)) enable("opportunity");
  if (/aggiungi\s+promemoria/.test(text)) enable("reminder");

  const pctMatch = text.match(/probabilit[aà]?\s*(?:al|a|=|:)?\s*(\d{1,3})/) ?? text.match(/(\d{1,3})\s*%/);
  if (pctMatch) {
    const value = Math.max(5, Math.min(95, Number(pctMatch[1])));
    if (Number.isFinite(value)) {
      followUps = followUps.map((op) =>
        op.type === "create_opportunity" ? { ...op, probability: value } : op
      );
      if (operation.type === "create_opportunity") {
        operation = { ...operation, probability: value };
      }
      enable("opportunity");
      changed = true;
    }
  }

  if (!changed) {
    return null;
  }

  const enabledLabels = fields.filter((f) => f.enabled).map((f) => f.label);
  return {
    ...pending,
    operation,
    followUpOperations: followUps.length > 0 ? followUps : undefined,
    debriefFields: fields,
    description: enabledLabels.length > 0
      ? `Salverò: ${enabledLabels.join(", ")}`
      : "Nessun campo selezionato",
  };
}

/** Filtra operazioni in base ai checkbox debrief abilitati. */
export function filterDebriefOperationsForConfirm(
  pending: JoyCopilotPendingAction
): { operation: JoyCopilotOperation | null; followUpOperations: JoyCopilotOperation[] } {
  const fields = pending.debriefFields;
  if (!fields || fields.length === 0) {
    return {
      operation: pending.operation,
      followUpOperations: pending.followUpOperations ?? [],
    };
  }

  const enabled = new Set(fields.filter((f) => f.enabled).map((f) => f.key));
  const allOps = [pending.operation, ...(pending.followUpOperations ?? [])];
  const selected: JoyCopilotOperation[] = [];

  for (const op of allOps) {
    if (op.type === "create_note" && enabled.has("note")) {
      selected.push(op);
    } else if (op.type === "complete_visit" && enabled.has("visitOutcome")) {
      selected.push(op);
    } else if (op.type === "create_follow_up" && enabled.has("followUp")) {
      selected.push(op);
    } else if (op.type === "create_opportunity" && enabled.has("opportunity")) {
      selected.push(op);
    } else if (op.type === "create_reminder" && enabled.has("reminder")) {
      selected.push(op);
    } else if (
      op.type !== "create_note" &&
      op.type !== "complete_visit" &&
      op.type !== "create_follow_up" &&
      op.type !== "create_opportunity" &&
      op.type !== "create_reminder"
    ) {
      selected.push(op);
    }
  }

  if (selected.length === 0) {
    return { operation: null, followUpOperations: [] };
  }

  return {
    operation: selected[0],
    followUpOperations: selected.slice(1),
  };
}

export function parseJoyDebrief(message: string): JoyDebriefProposal | null {
  if (!isJoyDebriefCommand(message)) {
    return null;
  }

  const transcript = stripDebriefPrefix(message) || message.trim();
  const text = normalize(transcript);
  const visitOutcome = detectVisitOutcome(text);
  const crmVisitOutcome = mapDebriefOutcomeToCrm(visitOutcome);
  const productInterests = detectProductInterests(text);
  const competitors = detectCompetitors(text);
  const customerRequests = detectCustomerRequests(transcript);
  const problems = detectProblems(text);
  const opportunityProbability = detectProbability(text, visitOutcome);
  const followUpScheduledHint = detectFollowUpHint(text);

  const wantsFollowUp =
    /richiam|follow.?up|ricontatt|tra\s+\d+|prossima\s+settimana|domani|venerd|luned/.test(
      text
    );
  const wantsOpportunity =
    /opportunit|trattativ|affare|deal/.test(text) ||
    visitOutcome === "interessato" ||
    visitOutcome === "preventivo" ||
    visitOutcome === "ordine";
  const wantsReminder = /promemoria|ricordami|reminder/.test(text);

  const followUpSuggestion = wantsFollowUp
    ? `Programmare un follow-up${followUpScheduledHint ? ` (${followUpScheduledHint})` : " di richiamo"}`
    : visitOutcome === "da_richiamare"
      ? "Programmare richiamo"
      : null;

  const opportunityTitle = wantsOpportunity
    ? productInterests.length > 0
      ? `Opportunità ${productInterests.join(" / ")}`
      : "Nuova opportunità commerciale"
    : null;

  const reminderTitle = wantsReminder
    ? "Promemoria post-visita"
    : productInterests.length > 0 && wantsFollowUp
      ? `Promemoria interessi: ${productInterests.join(", ")}`
      : null;

  const outcomeLabel = crmVisitOutcome
    ? formatCrmOutcomeLabel(crmVisitOutcome)
    : visitOutcome;

  const lines = [
    "**Proposta di debriefing** (nessun salvataggio automatico)",
    "",
    `Nota: «${transcript}»`,
    outcomeLabel ? `Esito visita suggerito: **${outcomeLabel}**` : null,
    productInterests.length > 0
      ? `Interessi prodotto: ${productInterests.join(", ")}`
      : null,
    competitors.length > 0 ? `Concorrenti: ${competitors.join(", ")}` : null,
    customerRequests.length > 0
      ? `Richieste cliente: ${customerRequests.join("; ")}`
      : null,
    problems.length > 0 ? `Problemi/obiezioni: ${problems.join("; ")}` : null,
    followUpSuggestion ? `Follow-up: ${followUpSuggestion}` : null,
    opportunityTitle
      ? `Opportunità: ${opportunityTitle}${
          opportunityProbability != null ? ` · prob. ~${opportunityProbability}%` : ""
        }`
      : null,
    reminderTitle ? `Promemoria: ${reminderTitle}` : null,
    "",
    "Seleziona i campi da salvare, oppure di' «togli opportunità», «probabilità 60%». Conferma solo quando sei pronto.",
  ].filter(Boolean);

  return {
    notes: transcript,
    visitOutcome,
    crmVisitOutcome,
    followUpSuggestion,
    followUpScheduledHint,
    opportunityTitle,
    opportunityProbability,
    reminderTitle: wantsReminder || (productInterests.length > 0 && wantsFollowUp)
      ? reminderTitle
      : null,
    productInterests,
    competitors,
    customerRequests,
    problems,
    summaryText: lines.join("\n"),
  };
}
