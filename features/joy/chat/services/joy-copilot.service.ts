import "server-only";

import { listFollowUps } from "@/features/activities/services/follow-ups.service";
import { escapeIlikePattern } from "@/features/search/utils/escape-ilike";
import { listVisits } from "@/features/visits/services/visits.service";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { createServerClient } from "@/lib/supabase/server";
import type {
  JoyChatMessage,
  JoyChatResponse,
  JoyCopilotOperation,
  JoyCopilotPendingAction,
} from "../types/joy-chat";
import {
  formatItalianScheduleLabel,
  parseItalianSchedule,
  toDateKey,
} from "../utils/parse-italian-schedule";
import {
  parseJoyCopilotIntent,
  resolveScheduleIso,
  type JoyCopilotIntent,
} from "../utils/parse-joy-copilot-intent";

type CompanyMatch = {
  id: string;
  name: string;
};

function newMessageId(): string {
  return `joy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newPendingId(): string {
  return `copilot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function assistantMessage(
  content: string,
  pendingAction?: JoyCopilotPendingAction
): JoyChatMessage {
  return {
    id: newMessageId(),
    role: "assistant",
    content,
    pendingAction,
    createdAt: new Date().toISOString(),
  };
}

function buildPendingResponse(
  content: string,
  title: string,
  description: string,
  operation: JoyCopilotOperation
): JoyChatResponse {
  return {
    message: assistantMessage(content, {
      id: newPendingId(),
      title,
      description,
      operation,
      status: "pending",
    }),
  };
}

async function searchCompanies(query: string, limit = 5): Promise<CompanyMatch[]> {
  const pattern = escapeIlikePattern(query);
  if (!pattern) {
    return [];
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("companies")
    .select("id,name")
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(limit);

  return (data ?? []) as CompanyMatch[];
}

async function resolveSingleCompany(
  query: string
): Promise<{ company: CompanyMatch | null; ambiguous: CompanyMatch[] }> {
  const matches = await searchCompanies(query, 5);
  if (matches.length === 0) {
    return { company: null, ambiguous: [] };
  }
  if (matches.length === 1) {
    return { company: matches[0], ambiguous: [] };
  }

  const exact = matches.find(
    (item) => item.name.toLowerCase() === query.trim().toLowerCase()
  );
  if (exact) {
    return { company: exact, ambiguous: [] };
  }

  return { company: null, ambiguous: matches };
}

async function findNextScheduledVisit(companyId: string) {
  const [today, upcoming, overdue] = await Promise.all([
    listVisits({ companyId, period: "today", limit: 10 }),
    listVisits({ companyId, period: "upcoming", limit: 10 }),
    listVisits({ companyId, period: "overdue", limit: 5 }),
  ]);

  const visits = [...(overdue.data ?? []), ...(today.data ?? []), ...(upcoming.data ?? [])]
    .filter((visit) => visit.status === "scheduled" || visit.status === "in_progress")
    .sort((left, right) => left.scheduled_at.localeCompare(right.scheduled_at));

  return visits[0] ?? null;
}

async function findOpenFollowUp(companyId: string) {
  const { data } = await listFollowUps({ companyId, limit: 20 });
  return (
    (data ?? []).find((item) => item.status === "todo" || item.status === "postponed") ?? null
  );
}

function resolveScheduleOrFallback(scheduleText: string, fallbackDays = 1): string {
  if (scheduleText.trim()) {
    const parsed = parseItalianSchedule(scheduleText);
    if (parsed) {
      return parsed.toISOString();
    }
  }
  return resolveScheduleIso(scheduleText, fallbackDays);
}

async function handleCreateVisit(intent: JoyCopilotIntent & { type: "create_visit" }) {
  const { company, ambiguous } = await resolveSingleCompany(intent.companyQuery);
  if (!company) {
    if (ambiguous.length > 0) {
      const list = ambiguous.map((item) => `• **${item.name}**`).join("\n");
      return {
        message: assistantMessage(
          `Ho trovato più aziende simili a "${intent.companyQuery}". Specifica il nome esatto:\n\n${list}`
        ),
      };
    }
    return {
      message: assistantMessage(`Non ho trovato l'azienda "${intent.companyQuery}".`),
    };
  }

  const scheduledAt = resolveScheduleOrFallback(intent.scheduleText, 1);
  const scheduleLabel = formatItalianScheduleLabel(scheduledAt);

  return buildPendingResponse(
    `Vuoi pianificare una visita presso **${company.name}** per **${scheduleLabel}**?`,
    "Conferma visita",
    `${company.name} · ${scheduleLabel}`,
    {
      type: "create_visit",
      companyId: company.id,
      companyName: company.name,
      scheduledAt,
    }
  );
}

async function handleUpdateVisit(intent: JoyCopilotIntent & { type: "update_visit" }) {
  const { company, ambiguous } = await resolveSingleCompany(intent.companyQuery);
  if (!company) {
    if (ambiguous.length > 0) {
      return {
        message: assistantMessage(
          `Ho trovato più aziende per "${intent.companyQuery}". Specifica quale visita spostare.`
        ),
      };
    }
    return { message: assistantMessage(`Non ho trovato l'azienda "${intent.companyQuery}".`) };
  }

  const visit = await findNextScheduledVisit(company.id);
  if (!visit) {
    return {
      message: assistantMessage(
        `Non ci sono visite pianificate per **${company.name}** da spostare.`
      ),
    };
  }

  const scheduledAt = resolveScheduleOrFallback(intent.scheduleText, 2);
  const scheduleLabel = formatItalianScheduleLabel(scheduledAt);
  const currentLabel = formatItalianScheduleLabel(visit.scheduled_at);

  return buildPendingResponse(
    `Spostare la visita di **${company.name}** da **${currentLabel}** a **${scheduleLabel}**?`,
    "Conferma spostamento",
    `${company.name} · ${scheduleLabel}`,
    {
      type: "update_visit",
      visitId: visit.id,
      companyId: company.id,
      companyName: company.name,
      scheduledAt,
    }
  );
}

async function handleCancelVisit(intent: JoyCopilotIntent & { type: "cancel_visit" }) {
  const { company, ambiguous } = await resolveSingleCompany(intent.companyQuery);
  if (!company) {
    if (ambiguous.length > 0) {
      return {
        message: assistantMessage(
          `Ho trovato più aziende per "${intent.companyQuery}". Specifica quale visita annullare.`
        ),
      };
    }
    return { message: assistantMessage(`Non ho trovato l'azienda "${intent.companyQuery}".`) };
  }

  const visit = await findNextScheduledVisit(company.id);
  if (!visit) {
    return {
      message: assistantMessage(`Non ci sono visite pianificate per **${company.name}**.`),
    };
  }

  const currentLabel = formatItalianScheduleLabel(visit.scheduled_at);

  return buildPendingResponse(
    `Annullare la visita di **${company.name}** del **${currentLabel}**?`,
    "Conferma annullamento",
    `${company.name} · ${currentLabel}`,
    {
      type: "cancel_visit",
      visitId: visit.id,
      companyId: company.id,
      companyName: company.name,
    }
  );
}

async function handleCreateFollowUp(
  intent: JoyCopilotIntent & { type: "create_follow_up" }
) {
  if (!intent.companyQuery) {
    return {
      message: assistantMessage(
        "Per creare un follow-up indicami l'azienda, ad esempio: \"Crea un follow-up da Rossi tra 20 giorni\"."
      ),
    };
  }

  const { company, ambiguous } = await resolveSingleCompany(intent.companyQuery);
  if (!company) {
    if (ambiguous.length > 0) {
      return {
        message: assistantMessage(
          `Ho trovato più aziende per "${intent.companyQuery}". Specifica il cliente.`
        ),
      };
    }
    return { message: assistantMessage(`Non ho trovato l'azienda "${intent.companyQuery}".`) };
  }

  const scheduledAt = resolveScheduleOrFallback(intent.scheduleText, 7);
  const scheduleLabel = formatItalianScheduleLabel(scheduledAt);

  return buildPendingResponse(
    `Creare un follow-up per **${company.name}** il **${scheduleLabel}**?`,
    "Conferma follow-up",
    `${company.name} · ${scheduleLabel}`,
    {
      type: "create_follow_up",
      companyId: company.id,
      companyName: company.name,
      scheduledAt,
      description: intent.description,
    }
  );
}

async function handleUpdateFollowUp(
  intent: JoyCopilotIntent & { type: "update_follow_up" }
) {
  const { company, ambiguous } = await resolveSingleCompany(intent.companyQuery);
  if (!company) {
    if (ambiguous.length > 0) {
      return {
        message: assistantMessage(
          `Ho trovato più aziende per "${intent.companyQuery}". Specifica quale follow-up modificare.`
        ),
      };
    }
    return { message: assistantMessage(`Non ho trovato l'azienda "${intent.companyQuery}".`) };
  }

  const followUp = await findOpenFollowUp(company.id);
  if (!followUp) {
    return {
      message: assistantMessage(`Non ci sono follow-up aperti per **${company.name}**.`),
    };
  }

  const scheduledAt = resolveScheduleOrFallback(intent.scheduleText, 3);
  const scheduleLabel = formatItalianScheduleLabel(scheduledAt);
  const currentLabel = formatItalianScheduleLabel(followUp.scheduled_at);

  return buildPendingResponse(
    `Spostare il follow-up di **${company.name}** da **${currentLabel}** a **${scheduleLabel}**?`,
    "Conferma modifica follow-up",
    `${company.name} · ${scheduleLabel}`,
    {
      type: "update_follow_up",
      followUpId: followUp.id,
      companyId: company.id,
      companyName: company.name,
      scheduledAt,
    }
  );
}

async function handleCreateReminder(
  intent: JoyCopilotIntent & { type: "create_reminder" }
) {
  const scheduledAt = resolveScheduleOrFallback(intent.scheduleText, 1);
  const scheduleLabel = formatItalianScheduleLabel(scheduledAt);
  const title = intent.title?.trim() || "Promemoria Joy";

  let companyId: string | null = null;
  let companyName: string | null = null;

  if (intent.companyQuery) {
    const { company } = await resolveSingleCompany(intent.companyQuery);
    if (company) {
      companyId = company.id;
      companyName = company.name;
    }
  }

  const companyNote = companyName ? ` per **${companyName}**` : "";

  return buildPendingResponse(
    `Creare il promemoria **${title}**${companyNote} il **${scheduleLabel}**?`,
    "Conferma promemoria",
    `${title} · ${scheduleLabel}`,
    {
      type: "create_reminder",
      title,
      scheduledAt,
      companyId,
      notes: null,
    }
  );
}

async function handleOpenCompany(intent: JoyCopilotIntent & { type: "open_company" }) {
  const { company, ambiguous } = await resolveSingleCompany(intent.query);
  if (!company) {
    if (ambiguous.length > 1) {
      const list = ambiguous.map((item) => `• **${item.name}**`).join("\n");
      return {
        message: assistantMessage(
          `Ho trovato più aziende simili a "${intent.query}":\n\n${list}`
        ),
      };
    }
    return { message: assistantMessage(`Non ho trovato l'azienda "${intent.query}".`) };
  }

  return buildPendingResponse(
    `Aprire la scheda di **${company.name}**?`,
    "Apri azienda",
    company.name,
    {
      type: "navigate",
      href: `/companies/${company.id}`,
      label: company.name,
    }
  );
}

function handleOpenOpportunities(
  intent: JoyCopilotIntent & { type: "open_opportunities" }
) {
  const filterNote = intent.minAmount
    ? ` oltre **${formatOpportunityAmount(intent.minAmount)}**`
    : "";

  return buildPendingResponse(
    `Aprire l'elenco opportunità${filterNote}?`,
    "Apri opportunità",
    intent.minAmount
      ? `Pipeline sopra ${formatOpportunityAmount(intent.minAmount)}`
      : "Pipeline opportunità",
    {
      type: "navigate",
      href: "/opportunities",
      label: "Opportunità",
    }
  );
}

function handleOpenAgenda(intent: JoyCopilotIntent & { type: "open_agenda" }) {
  const date = parseItalianSchedule(intent.scheduleText ?? "oggi") ?? new Date();
  const dateKey = toDateKey(date);
  const label = formatItalianScheduleLabel(date.toISOString());

  return buildPendingResponse(
    `Aprire l'agenda del **${label}**?`,
    "Apri agenda",
    label,
    {
      type: "navigate",
      href: `/agenda?view=day&date=${dateKey}`,
      label: "Agenda",
    }
  );
}

function handleOpenRoutes(intent: JoyCopilotIntent & { type: "open_routes" }) {
  const date = parseItalianSchedule(intent.scheduleText ?? "domani") ?? new Date();
  const label = formatItalianScheduleLabel(date.toISOString());

  return buildPendingResponse(
    `Aprire il **Giro Visite** per **${label}**?`,
    "Apri giro visite",
    label,
    {
      type: "navigate",
      href: "/routes",
      label: "Giro Visite",
    }
  );
}

function handleOpenRadar() {
  return buildPendingResponse(
    "Aprire il **radar opportunità** sulla mappa?",
    "Apri radar",
    "Radar opportunità",
    {
      type: "navigate",
      href: "/maps",
      label: "Radar",
    }
  );
}

export async function processJoyCopilotCommand(message: string): Promise<JoyChatResponse | null> {
  const intent = parseJoyCopilotIntent(message);
  if (!intent) {
    return null;
  }

  switch (intent.type) {
    case "create_visit":
      return handleCreateVisit(intent);
    case "update_visit":
      return handleUpdateVisit(intent);
    case "cancel_visit":
      return handleCancelVisit(intent);
    case "create_follow_up":
      return handleCreateFollowUp(intent);
    case "update_follow_up":
      return handleUpdateFollowUp(intent);
    case "create_reminder":
      return handleCreateReminder(intent);
    case "open_company":
      return handleOpenCompany(intent);
    case "open_opportunities":
      return handleOpenOpportunities(intent);
    case "open_agenda":
      return handleOpenAgenda(intent);
    case "open_routes":
      return handleOpenRoutes(intent);
    case "open_radar":
      return handleOpenRadar();
    default:
      return null;
  }
}
