import "server-only";

import type {
  JoyChatResponse,
  JoyCopilotOperation,
  JoyDebriefFieldToggle,
} from "../types/joy-chat";
import type { JoyConversationMemory } from "../types/joy-session";
import {
  buildDebriefFields,
  formatCrmOutcomeLabel,
  parseJoyDebrief,
} from "../utils/parse-joy-debrief";
import { resolveCompanyQueryFromMemory } from "../utils/joy-conversation-memory";
import { escapeIlikePattern } from "@/features/search/utils/escape-ilike";
import { createServerClient } from "@/lib/supabase/server";

type CompanyMatch = { id: string; name: string };

function newMessageId(): string {
  return `joy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newPendingId(): string {
  return `copilot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function scheduleFromHint(hint: string | null): string {
  const date = new Date();
  date.setHours(10, 0, 0, 0);
  const normalized = (hint ?? "").toLowerCase();

  if (normalized.includes("domani")) {
    date.setDate(date.getDate() + 1);
  } else if (normalized.includes("lunedì") || normalized.includes("lunedi")) {
    const day = date.getDay();
    const add = (1 - day + 7) % 7 || 7;
    date.setDate(date.getDate() + add);
  } else if (normalized.includes("venerdì") || normalized.includes("venerdi")) {
    const day = date.getDay();
    const add = (5 - day + 7) % 7 || 7;
    date.setDate(date.getDate() + add);
  } else if (normalized.includes("prossima settimana")) {
    date.setDate(date.getDate() + 7);
  } else {
    const days = normalized.match(/tra\s+(\d+)/);
    if (days) {
      date.setDate(date.getDate() + Number(days[1]));
    } else {
      date.setDate(date.getDate() + 2);
    }
  }

  return date.toISOString();
}

async function resolveCompany(
  query: string | null,
  memory: JoyConversationMemory,
  contextCompanyId?: string | null
): Promise<CompanyMatch | null> {
  if (contextCompanyId?.trim()) {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("companies")
      .select("id,name")
      .eq("id", contextCompanyId.trim())
      .maybeSingle();
    if (data) {
      return { id: data.id, name: data.name };
    }
  }

  if (memory.selectedClientId || memory.lastCompanyId) {
    const id = memory.selectedClientId ?? memory.lastCompanyId;
    if (id) {
      const supabase = await createServerClient();
      const { data } = await supabase.from("companies").select("id,name").eq("id", id).maybeSingle();
      if (data) {
        return { id: data.id, name: data.name };
      }
    }
  }

  const nameQuery = resolveCompanyQueryFromMemory(query, memory);
  if (!nameQuery) {
    return null;
  }

  const pattern = escapeIlikePattern(nameQuery);
  if (!pattern) {
    return null;
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("companies")
    .select("id,name")
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(3);

  if (!data || data.length === 0) {
    return null;
  }
  if (data.length === 1) {
    return data[0];
  }
  const exact = data.find((item) => item.name.toLowerCase() === nameQuery.toLowerCase());
  return exact ?? data[0];
}

async function resolvePrimaryContact(
  companyId: string
): Promise<{ id: string; name: string } | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("contacts")
    .select("id,full_name")
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("full_name", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.id) {
    return null;
  }
  return { id: data.id, name: data.full_name ?? "Referente" };
}

function extractCompanyFromDebrief(message: string): string | null {
  const match = message.match(
    /(?:presso|da|di|per|cliente|azienda)\s+([A-Za-zÀ-ù0-9][A-Za-zÀ-ù0-9\s&.'-]{1,50})/i
  );
  return match?.[1]?.trim().replace(/[?.!,]+$/, "") ?? null;
}

export async function processJoyDebrief(
  message: string,
  memory: JoyConversationMemory = {},
  contextCompanyId?: string | null
): Promise<JoyChatResponse | null> {
  const proposal = parseJoyDebrief(message);
  if (!proposal) {
    return null;
  }

  const companyQuery = extractCompanyFromDebrief(message);
  const company = await resolveCompany(companyQuery, memory, contextCompanyId);

  if (!company) {
    return {
      message: {
        id: newMessageId(),
        role: "assistant",
        content:
          "Per il debriefing indica l'azienda (es. «Joy registra presso Rossi: interessati a VEPA») oppure apri Joy dalla scheda azienda. Memorizzo il contesto per le richieste successive.",
        createdAt: new Date().toISOString(),
      },
      memoryPatch: { conversationGoal: "debrief" },
      sessionState: "proposing",
    };
  }

  const contact = await resolvePrimaryContact(company.id);

  const noteBody = [
    proposal.notes,
    proposal.crmVisitOutcome
      ? `Esito visita: ${formatCrmOutcomeLabel(proposal.crmVisitOutcome)}`
      : proposal.visitOutcome
        ? `Esito visita: ${proposal.visitOutcome}`
        : null,
    proposal.productInterests.length > 0
      ? `Interessi: ${proposal.productInterests.join(", ")}`
      : null,
    proposal.competitors.length > 0
      ? `Concorrenti: ${proposal.competitors.join(", ")}`
      : null,
    proposal.customerRequests.length > 0
      ? `Richieste: ${proposal.customerRequests.join("; ")}`
      : null,
    proposal.problems.length > 0
      ? `Problemi/obiezioni: ${proposal.problems.join("; ")}`
      : null,
    proposal.opportunityProbability != null
      ? `Probabilità stimata: ${proposal.opportunityProbability}%`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const operations: JoyCopilotOperation[] = [];

  // Nota commerciale (sempre proposta; salvataggio solo se checkbox attivo)
  operations.push({
    type: "create_note",
    companyId: company.id,
    companyName: company.name,
    title: `Debrief · ${company.name}`,
    notes: noteBody,
  });

  // Esito su record visits (complete/create via saveVisitAction)
  if (proposal.crmVisitOutcome) {
    operations.push({
      type: "complete_visit",
      companyId: company.id,
      companyName: company.name,
      visitId: memory.lastVisitId ?? null,
      outcome: proposal.crmVisitOutcome,
      notes: noteBody.slice(0, 500),
      completedAt: new Date().toISOString(),
    });
  }

  if (proposal.followUpSuggestion) {
    operations.push({
      type: "create_follow_up",
      companyId: company.id,
      companyName: company.name,
      scheduledAt: scheduleFromHint(proposal.followUpScheduledHint),
      description: [
        proposal.followUpSuggestion,
        proposal.productInterests.length > 0
          ? `Interessi: ${proposal.productInterests.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  if (proposal.opportunityTitle) {
    operations.push({
      type: "create_opportunity",
      companyId: company.id,
      companyName: company.name,
      title: proposal.opportunityTitle,
      probability: proposal.opportunityProbability,
    });
  }

  if (proposal.reminderTitle) {
    operations.push({
      type: "create_reminder",
      title: proposal.reminderTitle,
      scheduledAt: scheduleFromHint(proposal.followUpScheduledHint),
      companyId: company.id,
      notes: proposal.notes.slice(0, 240),
    });
  }

  const debriefFields: JoyDebriefFieldToggle[] = buildDebriefFields({
    hasNote: true,
    hasVisitOutcome: Boolean(proposal.crmVisitOutcome),
    hasFollowUp: Boolean(proposal.followUpSuggestion),
    hasOpportunity: Boolean(proposal.opportunityTitle),
    hasReminder: Boolean(proposal.reminderTitle),
  });

  const actionLabels = debriefFields.map((field) => field.label);
  const primary = operations[0];
  const followUpOperations = operations.slice(1);

  return {
    message: {
      id: newMessageId(),
      role: "assistant",
      content: [
        proposal.summaryText.replace(
          /Seleziona i campi.+$/m,
          `Azienda: **${company.name}**.\n\nCampi proposti: **${actionLabels.join(" · ")}**.\nSeleziona/deseleziona oppure di' «togli opportunità», «probabilità 60%». Conferma per salvare solo i campi attivi.`
        ),
      ].join("\n"),
      createdAt: new Date().toISOString(),
      pendingAction: {
        id: newPendingId(),
        title: `Salva debrief · ${company.name}`,
        description: `Salverò: ${actionLabels.join(", ")}`,
        operation: primary,
        followUpOperations: followUpOperations.length > 0 ? followUpOperations : undefined,
        debriefFields,
        status: "pending",
      },
    },
    memoryPatch: {
      lastCompanyId: company.id,
      lastCompanyName: company.name,
      selectedClientId: company.id,
      selectedClientName: company.name,
      lastContactId: contact?.id ?? memory.lastContactId ?? null,
      lastContactName: contact?.name ?? memory.lastContactName ?? null,
      conversationGoal: "debrief",
      lastProposedAction: `Debrief ${company.name}`,
      lastContextDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    },
    sessionState: "confirming",
  };
}
