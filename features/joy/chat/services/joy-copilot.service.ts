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

export interface JoyCopilotContext {
  companyId?: string | null;
  memory?: {
    lastCompanyId?: string | null;
    lastCompanyName?: string | null;
    selectedClientId?: string | null;
    selectedClientName?: string | null;
  } | null;
}

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

async function resolveCompanyById(companyId: string): Promise<CompanyMatch | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("companies")
    .select("id,name")
    .eq("id", companyId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  return { id: data.id, name: data.name };
}

async function resolveSingleCompany(
  query: string | null | undefined,
  contextCompanyId?: string | null,
  memory?: JoyCopilotContext["memory"]
): Promise<{ company: CompanyMatch | null; ambiguous: CompanyMatch[]; missingContext: boolean }> {
  const trimmed = query?.trim() ?? "";
  if (!trimmed) {
    const fallbackId =
      contextCompanyId?.trim() ||
      memory?.selectedClientId?.trim() ||
      memory?.lastCompanyId?.trim() ||
      "";
    if (fallbackId) {
      const company = await resolveCompanyById(fallbackId);
      return { company, ambiguous: [], missingContext: !company };
    }
    const fallbackName = memory?.selectedClientName ?? memory?.lastCompanyName;
    if (fallbackName?.trim()) {
      const matches = await searchCompanies(fallbackName.trim(), 5);
      if (matches.length === 1) {
        return { company: matches[0], ambiguous: [], missingContext: false };
      }
      if (matches.length > 1) {
        const exact = matches.find(
          (item) => item.name.toLowerCase() === fallbackName.trim().toLowerCase()
        );
        if (exact) {
          return { company: exact, ambiguous: [], missingContext: false };
        }
        return { company: null, ambiguous: matches, missingContext: false };
      }
    }
    return { company: null, ambiguous: [], missingContext: true };
  }

  const matches = await searchCompanies(trimmed, 5);
  if (matches.length === 0) {
    return { company: null, ambiguous: [], missingContext: false };
  }
  if (matches.length === 1) {
    return { company: matches[0], ambiguous: [], missingContext: false };
  }

  const exact = matches.find(
    (item) => item.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) {
    return { company: exact, ambiguous: [], missingContext: false };
  }

  return { company: null, ambiguous: matches, missingContext: false };
}

function companyResolveError(
  companyQuery: string | null | undefined,
  ambiguous: CompanyMatch[],
  missingContext: boolean
): JoyChatResponse {
  if (missingContext) {
    return {
      message: assistantMessage(
        "Specifica l'azienda (es. «crea preventivo per Rossi») oppure apri Joy AI dalla scheda azienda."
      ),
    };
  }
  if (ambiguous.length > 0) {
    const list = ambiguous.map((item) => `• **${item.name}**`).join("\n");
    return {
      message: assistantMessage(
        `Ho trovato più aziende simili a "${companyQuery}". Specifica il nome esatto:\n\n${list}`
      ),
    };
  }
  return {
    message: assistantMessage(`Non ho trovato l'azienda "${companyQuery}".`),
  };
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

async function handleCreateVisit(
  intent: JoyCopilotIntent & { type: "create_visit" },
  context: JoyCopilotContext
) {
  const { company, ambiguous, missingContext } = await resolveSingleCompany(
    intent.companyQuery,
    context.companyId,
    context.memory
  );
  if (!company) {
    return companyResolveError(intent.companyQuery, ambiguous, missingContext);
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

async function handleUpdateVisit(
  intent: JoyCopilotIntent & { type: "update_visit" },
  context: JoyCopilotContext
) {
  const { company, ambiguous, missingContext } = await resolveSingleCompany(
    intent.companyQuery,
    context.companyId,
    context.memory
  );
  if (!company) {
    return companyResolveError(intent.companyQuery, ambiguous, missingContext);
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

async function handleCancelVisit(
  intent: JoyCopilotIntent & { type: "cancel_visit" },
  context: JoyCopilotContext
) {
  const { company, ambiguous, missingContext } = await resolveSingleCompany(
    intent.companyQuery,
    context.companyId,
    context.memory
  );
  if (!company) {
    return companyResolveError(intent.companyQuery, ambiguous, missingContext);
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
  intent: JoyCopilotIntent & { type: "create_follow_up" },
  context: JoyCopilotContext
) {
  const { company, ambiguous, missingContext } = await resolveSingleCompany(
    intent.companyQuery,
    context.companyId,
    context.memory
  );
  if (!company) {
    return companyResolveError(intent.companyQuery, ambiguous, missingContext);
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
  intent: JoyCopilotIntent & { type: "update_follow_up" },
  context: JoyCopilotContext
) {
  const { company, ambiguous, missingContext } = await resolveSingleCompany(
    intent.companyQuery,
    context.companyId,
    context.memory
  );
  if (!company) {
    return companyResolveError(intent.companyQuery, ambiguous, missingContext);
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
  intent: JoyCopilotIntent & { type: "create_reminder" },
  context: JoyCopilotContext
) {
  const scheduledAt = resolveScheduleOrFallback(intent.scheduleText, 1);
  const scheduleLabel = formatItalianScheduleLabel(scheduledAt);
  const title = intent.title?.trim() || "Promemoria Joy";

  let companyId: string | null = null;
  let companyName: string | null = null;

  if (intent.companyQuery || context.companyId) {
    const { company } = await resolveSingleCompany(
      intent.companyQuery,
      context.companyId,
      context.memory
    );
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

async function handleOpenCompany(
  intent: JoyCopilotIntent & { type: "open_company" },
  context: JoyCopilotContext = {}
) {
  const { company, ambiguous } = await resolveSingleCompany(
    intent.query,
    context.companyId,
    context.memory
  );
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
  const href = intent.minAmount
    ? `/opportunities?min=${Math.round(intent.minAmount)}`
    : "/opportunities";

  return buildPendingResponse(
    `Aprire l'elenco opportunità${filterNote}?`,
    "Apri opportunità",
    intent.minAmount
      ? `Pipeline sopra ${formatOpportunityAmount(intent.minAmount)}`
      : "Pipeline opportunità",
    {
      type: "navigate",
      href,
      label: "Opportunità",
    }
  );
}

async function handleCreateCommercialDraft(
  kind: "create_opportunity" | "create_quote" | "create_order" | "create_sample" | "create_service_ticket",
  companyQuery: string | null,
  title: string | null,
  context: JoyCopilotContext
) {
  const { company, ambiguous, missingContext } = await resolveSingleCompany(
    companyQuery,
    context.companyId,
    context.memory
  );
  if (!company) {
    return companyResolveError(companyQuery, ambiguous, missingContext);
  }

  const labels = {
    create_opportunity: {
      noun: "opportunità",
      confirmTitle: "Conferma opportunità",
      defaultTitle: `Opportunità ${company.name}`,
    },
    create_quote: {
      noun: "preventivo",
      confirmTitle: "Conferma preventivo",
      defaultTitle: `Preventivo ${company.name}`,
    },
    create_order: {
      noun: "ordine",
      confirmTitle: "Conferma ordine",
      defaultTitle: `Ordine ${company.name}`,
    },
    create_sample: {
      noun: "campione",
      confirmTitle: "Conferma campione",
      defaultTitle: `Campione ${company.name}`,
    },
    create_service_ticket: {
      noun: "ticket assistenza",
      confirmTitle: "Conferma ticket",
      defaultTitle: `Assistenza ${company.name}`,
    },
  } as const;

  const meta = labels[kind];
  const resolvedTitle = title?.trim() || meta.defaultTitle;

  return buildPendingResponse(
    `Creare una bozza **${meta.noun}** per **${company.name}** («${resolvedTitle}»)?`,
    meta.confirmTitle,
    `${company.name} · ${resolvedTitle}`,
    {
      type: kind,
      companyId: company.id,
      companyName: company.name,
      title: resolvedTitle,
    }
  );
}

async function handleCreateNote(
  intent: JoyCopilotIntent & { type: "create_note" },
  context: JoyCopilotContext
) {
  const { company, ambiguous, missingContext } = await resolveSingleCompany(
    intent.companyQuery,
    context.companyId,
    context.memory
  );
  if (!company) {
    return companyResolveError(intent.companyQuery, ambiguous, missingContext);
  }

  const notes = intent.notes.trim() || "Nota da Joy AI";

  return buildPendingResponse(
    `Salvare la nota su **${company.name}**?\n\n«${notes}»`,
    "Conferma nota",
    `${company.name} · nota`,
    {
      type: "create_note",
      companyId: company.id,
      companyName: company.name,
      title: `Nota · ${company.name}`,
      notes,
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
      href: "/giro-visite",
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

export async function processJoyCopilotCommand(
  message: string,
  context: JoyCopilotContext = {}
): Promise<JoyChatResponse | null> {
  const intent = parseJoyCopilotIntent(message);
  if (!intent) {
    return null;
  }

  switch (intent.type) {
    case "create_visit":
      return handleCreateVisit(intent, context);
    case "update_visit":
      return handleUpdateVisit(intent, context);
    case "cancel_visit":
      return handleCancelVisit(intent, context);
    case "create_follow_up":
      return handleCreateFollowUp(intent, context);
    case "update_follow_up":
      return handleUpdateFollowUp(intent, context);
    case "create_reminder":
      return handleCreateReminder(intent, context);
    case "create_opportunity":
      return handleCreateCommercialDraft(
        "create_opportunity",
        intent.companyQuery,
        intent.title,
        context
      );
    case "create_quote":
      return handleCreateCommercialDraft(
        "create_quote",
        intent.companyQuery,
        intent.title,
        context
      );
    case "create_order":
      return handleCreateCommercialDraft(
        "create_order",
        intent.companyQuery,
        intent.title,
        context
      );
    case "create_sample":
      return handleCreateCommercialDraft(
        "create_sample",
        intent.companyQuery,
        intent.title,
        context
      );
    case "create_service_ticket":
      return handleCreateCommercialDraft(
        "create_service_ticket",
        intent.companyQuery,
        intent.title,
        context
      );
    case "create_note":
      return handleCreateNote(intent, context);
    case "open_company":
      return handleOpenCompany(intent, context);
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
