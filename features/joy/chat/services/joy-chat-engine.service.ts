import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { getDailyVisitSuggestions } from "@/features/assistant/services/assistant-suggestions.service";
import { getGoogleCalendarConnectionView } from "@/features/calendar-sync/services/connection.service";
import { listOpportunities } from "@/features/opportunities/services/opportunities.service";
import { resolveCompanyIdsForProductFilters } from "@/features/products/services/company-product-interests.service";
import { analyzeOpportunityRadar } from "@/features/radar/services/opportunity-radar.service";
import { listCompanies } from "@/features/companies/services/companies.service";
import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { getQuotesDashboardMetrics } from "@/features/quotes/services/quotes.service";
import { escapeIlikePattern } from "@/features/search/utils/escape-ilike";
import {
  getAgendaToday,
  getAgendaTomorrow,
  getCompanyById,
  getCommercialStatistics,
  getContacts,
  getDailyBriefing,
  getEndOfDaySummary,
  getWeeklyBriefing,
  getFollowUps,
  getOverdueFollowUps,
  getOpportunities,
  getStaleOpportunities,
  getQuotes,
  getStatistics,
  getPipeline,
  getOrders,
  getProductCatalog,
  getSamples,
  getSamplesToRecover,
  getServiceTickets,
  getOpenServiceTickets,
  getDocuments,
  getCompanyBriefing,
  getCompanyTimeline,
  getDailyPlan,
  getVisitTours,
  getVisits,
  JOY_INSUFFICIENT_DATA_MESSAGE,
  searchCompanies,
} from "@/features/joy/tools";
import { getUserScopedTodayVisitPlan } from "@/features/dashboard/services/mission-control.service";
import { formatDistanceKm, getDistanceKm } from "@/features/maps/utils/geo-distance";
import {
  countUserCompletedVisitsToday,
} from "@/features/joy/services/joy-ai.service";
import {
  formatOpportunityAmount,
  isOpenOpportunityStage,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS, type ProductFamily } from "@/lib/constants/product-catalog";
import {
  formatLastVisitLabel,
  formatVisitDate,
  thresholdIsoDaysAgo,
} from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import type { JoyChatListItem, JoyChatMessage, JoyChatResponse } from "../types/joy-chat";
import {
  buildCompanyChatActions,
  buildJoyPromptAction,
  buildPageAction,
} from "../utils/joy-chat-action-builders";
import {
  withJoyConfirmationAsk,
} from "../utils/joy-operational-quality";
import { parseJoyIntent, type JoyIntent } from "../utils/parse-joy-intent";
import { processJoyCopilotCommand } from "./joy-copilot.service";
import { processJoyDebrief } from "./joy-debrief.service";
import {
  buildCommercialProposals,
  processJoyTourPlanning,
  proposeJoyTourPlan,
} from "./joy-tour-planner.service";
import {
  parseJoyTourPlanRequest,
  type JoyTourPlanRequest,
} from "../utils/parse-joy-tour-plan";
import type { JoyConversationMemory } from "../types/joy-session";
import { extractMemoryHintsFromUserText } from "../utils/joy-conversation-memory";
import {
  buildJoyOsFallbackNarrative,
  buildContradictionFromDecision,
  buildRecommendedPrompt,
  formatContradiction,
  runJoyOsCoach,
  runJoyOsLearning,
  runJoyOsRadar,
  runJoyOsReasoning,
  runJoyOsSellMoreToday,
  runJoyOsSimulation,
  runJoyOsStrategy,
} from "@/features/joy/os/joy-os";

export { joyResponseHasHelpdeskRedirect } from "../utils/joy-operational-quality";

const withConfirmationAsk = withJoyConfirmationAsk;

function insufficientDataResponse(): JoyChatResponse {
  return { message: assistantMessage(JOY_INSUFFICIENT_DATA_MESSAGE) };
}

function companyContextPrefix(context: JoyChatContext): string {
  return context.companyId?.trim() ? "**Contesto azienda attivo**\n\n" : "";
}

function withCompanyContext(content: string, context: JoyChatContext): string {
  const prefix = companyContextPrefix(context);
  return prefix ? `${prefix}${content}` : content;
}

function toolErrorResponse(context: JoyChatContext = {}): JoyChatResponse {
  return {
    message: assistantMessage(withCompanyContext(JOY_INSUFFICIENT_DATA_MESSAGE, context)),
  };
}

export interface JoyChatContext {
  latitude?: number | null;
  longitude?: number | null;
  companyId?: string | null;
  memory?: JoyConversationMemory | null;
  /** Se true, al primo messaggio con companyId prepara automaticamente il briefing. */
  autoBriefing?: boolean;
  /** Risposte più brevi (modalità Guida). */
  guideMode?: boolean;
  /** Joy Drive: sintesi ultra-breve per uso vocale su smartphone. */
  driveMode?: boolean;
}

function startOfTomorrowIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function endOfTomorrowIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

async function fetchTomorrowVisitPlan(userId: string | null) {
  const supabase = await createServerClient();
  const tomorrowStart = startOfTomorrowIso();
  const tomorrowEnd = endOfTomorrowIso();

  type VisitPlanRow = {
    id: string;
    company_id: string;
    scheduled_at: string;
    companies:
      | { name: string; city: string | null; province: string | null }
      | Array<{ name: string; city: string | null; province: string | null }>
      | null;
  };

  let query = supabase
    .from("visits")
    .select("id,company_id,scheduled_at,companies(name,city,province)")
    .in("status", ["scheduled", "in_progress"])
    .gte("scheduled_at", tomorrowStart)
    .lte("scheduled_at", tomorrowEnd)
    .order("scheduled_at", { ascending: true });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data } = await query;
  return (data ?? []).map((row) => {
    const visit = row as unknown as VisitPlanRow;
    const company = Array.isArray(visit.companies) ? visit.companies[0] : visit.companies;
    return {
      visitId: visit.id,
      companyId: visit.company_id,
      companyName: company?.name ?? "Azienda",
      city: company?.city ?? null,
      province: company?.province ?? null,
      scheduledAt: visit.scheduled_at,
    };
  });
}

const LIST_LIMIT = 12;

const CITY_CENTERS: Record<string, { lat: number; lng: number; province?: string }> = {
  latina: { lat: 41.4677, lng: 12.9037, province: "LT" },
  aprilia: { lat: 41.5947, lng: 12.6532, province: "LT" },
  terracina: { lat: 41.2917, lng: 13.2486, province: "LT" },
  frosinone: { lat: 41.6397, lng: 13.3426, province: "FR" },
  cassino: { lat: 41.4928, lng: 13.8314, province: "FR" },
  roma: { lat: 41.9028, lng: 12.4964, province: "RM" },
  viterbo: { lat: 42.4175, lng: 12.108, province: "VT" },
  rieti: { lat: 42.4042, lng: 12.8621, province: "RI" },
};

type CompanyRow = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  phone: string | null;
  contact_phone: string | null;
  mobile: string | null;
  latitude: number | null;
  longitude: number | null;
  last_visit_at: string | null;
};

function newMessageId(): string {
  return `joy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function resolvePhone(row: Pick<CompanyRow, "phone" | "contact_phone" | "mobile">): string | null {
  return row.phone ?? row.contact_phone ?? row.mobile ?? null;
}

function assistantMessage(
  content: string,
  options?: { actions?: JoyChatMessage["actions"]; items?: JoyChatListItem[] }
): JoyChatMessage {
  return {
    id: newMessageId(),
    role: "assistant",
    content,
    actions: options?.actions,
    items: options?.items,
    createdAt: new Date().toISOString(),
  };
}

function normalizeCityKey(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

async function fetchCompaniesByIds(ids: string[]): Promise<CompanyRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("companies")
    .select(
      "id,name,city,province,phone,contact_phone,mobile,latitude,longitude,last_visit_at"
    )
    .in("id", ids.slice(0, LIST_LIMIT))
    .order("name", { ascending: true });

  return (data ?? []) as CompanyRow[];
}

async function handleVisitsToday(userId: string | null): Promise<JoyChatResponse> {
  const [openVisits, completedTodayCount] = await Promise.all([
    getUserScopedTodayVisitPlan(userId),
    countUserCompletedVisitsToday(userId),
  ]);

  if (openVisits.length === 0 && completedTodayCount === 0) {
    const suggestions = await getDailyVisitSuggestions({ limit: 5, agentId: userId });
    const proposed = suggestions.data ?? [];
    if (proposed.length === 0) {
      return {
        message: assistantMessage(
          "Non ho visite in agenda né suggerimenti CRM per oggi. Dimmi una zona (es. Latina) o «Ho due ore libere» e costruisco un piano sui dati disponibili."
        ),
        sessionState: "proposing",
      };
    }

    const items: JoyChatListItem[] = proposed.map((item) => ({
      id: item.companyId,
      title: item.companyName,
      subtitle: [item.city, item.province].filter(Boolean).join(" · ") || "Suggerimento Joy",
    }));
    const lines = proposed.map(
      (item, index) =>
        `${index + 1}. **${item.companyName}**${item.city ? ` (${item.city})` : ""} — ${
          item.reasons?.[0] ?? `priorità ${item.tier}`
        }`
    );
    const actions = proposed.flatMap((item) =>
      buildCompanyChatActions(
        { id: item.companyId, name: item.companyName },
        `suggest-${item.companyId}`
      ).slice(0, 2)
    );

    return {
      message: assistantMessage(
        withConfirmationAsk(
          `Giornata senza visite pianificate. Ti propongo **${proposed.length}** tappe dai dati CRM:\n\n${lines.join("\n")}`
        ),
        {
          items,
          actions: dedupeActions([
            buildJoyPromptAction(
              "organize-tour",
              "Organizza questo giro",
              "Organizza il mio giro visite per oggi"
            ),
            ...actions,
          ]).slice(0, 16),
        }
      ),
      sessionState: "proposing",
    };
  }

  const companyIds = [...new Set(openVisits.map((visit) => visit.companyId))];
  const companies = await fetchCompaniesByIds(companyIds);
  const companyMap = new Map(companies.map((row) => [row.id, row]));

  const lines: string[] = [];
  const items: JoyChatListItem[] = [];
  const actions: JoyChatMessage["actions"] = [
    buildJoyPromptAction(
      "optimize-tour",
      "Ottimizza percorso",
      "Organizza il mio giro visite per oggi"
    ),
    buildJoyPromptAction("free-time", "Riempi slot liberi", "Ho due ore libere"),
  ];

  for (const visit of openVisits.slice(0, LIST_LIMIT)) {
    const company = companyMap.get(visit.companyId);
    const time = formatVisitDate(visit.scheduledAt);
    const location = [visit.city, visit.province].filter(Boolean).join(", ");
    lines.push(`• **${visit.companyName}** — ${time}${location ? ` (${location})` : ""}`);
    items.push({
      id: visit.visitId,
      title: visit.companyName,
      subtitle: `${time}${location ? ` · ${location}` : ""}`,
    });

    if (company) {
      actions.push(
        ...buildCompanyChatActions(
          {
            id: company.id,
            name: company.name,
            phone: resolvePhone(company),
            latitude: company.latitude,
            longitude: company.longitude,
          },
          `visit-${visit.visitId}`
        ).slice(0, 3)
      );
    }
  }

  if (completedTodayCount > 0) {
    lines.push(`\nHai già completato ${completedTodayCount} visita/e oggi.`);
  }

  return {
    message: assistantMessage(
      withConfirmationAsk(
        `Ecco le visite per oggi (${openVisits.length} da fare):\n\n${lines.join("\n")}`
      ),
      { items, actions: dedupeActions(actions).slice(0, 18) }
    ),
    sessionState: "proposing",
  };
}

function dedupeActions(actions: NonNullable<JoyChatMessage["actions"]>) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.href)) {
      return false;
    }
    seen.add(action.href);
    return true;
  });
}

async function handleInactiveClients(days: number, userId: string | null): Promise<JoyChatResponse> {
  const threshold = thresholdIsoDaysAgo(days);
  const supabase = await createServerClient();
  let query = supabase
    .from("companies")
    .select(
      "id,name,city,province,phone,contact_phone,mobile,latitude,longitude,last_visit_at"
    )
    .or(`last_visit_at.is.null,last_visit_at.lt.${threshold}`)
    .order("last_visit_at", { ascending: true, nullsFirst: true })
    .limit(LIST_LIMIT);

  if (userId) {
    query = applyAgentCompanyScope(query, userId);
  }

  const { data, error } = await query;

  if (error) {
    return { message: assistantMessage(`Errore nella ricerca clienti inattivi: ${error.message}`) };
  }

  const rows = (data ?? []) as CompanyRow[];
  if (rows.length === 0) {
    return {
      message: assistantMessage(
        `Ottimo! Non ho trovato clienti senza visita da più di ${days} giorni.`
      ),
    };
  }

  const lines = rows.map(
    (row, index) =>
      `${index + 1}. **${row.name}** — ${formatLastVisitLabel(row.last_visit_at)}${row.city ? ` (${row.city})` : ""}`
  );

  const actions = rows.flatMap((row) =>
    buildCompanyChatActions(
      {
        id: row.id,
        name: row.name,
        phone: resolvePhone(row),
        latitude: row.latitude,
        longitude: row.longitude,
      },
      `inactive-${row.id}`
    ).slice(0, 2)
  );

  return {
    message: assistantMessage(
      withConfirmationAsk(
        `Ho trovato ${rows.length} clienti senza visita da almeno ${days} giorni. Proposta recupero:\n\n${lines.join("\n")}`
      ),
      {
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: formatLastVisitLabel(row.last_visit_at),
        })),
        actions: dedupeActions([
          buildJoyPromptAction(
            "tour-inactive",
            "Organizza giro di recupero",
            "Organizza il mio giro visite per oggi"
          ),
          ...actions,
        ]).slice(0, 16),
      }
    ),
    sessionState: "proposing",
  };
}

async function handleOpportunitiesMinAmount(
  amount: number,
  userId: string | null
): Promise<JoyChatResponse> {
  const { data, error } = await listOpportunities({
    limit: 500,
    filters: userId ? { agentId: userId } : undefined,
  });
  if (error) {
    return { message: assistantMessage(`Errore opportunità: ${error}`) };
  }

  const matches = (data ?? [])
    .filter((item) => isOpenOpportunityStage(item.stage) && item.total_amount >= amount)
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, LIST_LIMIT);

  if (matches.length === 0) {
    return {
      message: assistantMessage(
        `Non ci sono opportunità aperte sopra ${formatOpportunityAmount(amount)}.`
      ),
    };
  }

  const total = matches.reduce((sum, item) => sum + item.total_amount, 0);
  const lines = matches.map(
    (item, index) =>
      `${index + 1}. **${item.company_name ?? item.title}** — ${formatOpportunityAmount(item.total_amount)} (${OPPORTUNITY_STAGE_LABELS[item.stage]})`
  );

  const actions = matches.flatMap((item) => {
    if (!item.company_id) {
      return [];
    }
    return buildCompanyChatActions(
      { id: item.company_id, name: item.company_name ?? item.title },
      `opp-${item.id}`
    ).slice(0, 2);
  });

  return {
    message: assistantMessage(
      withConfirmationAsk(
        `Hai ${matches.length} opportunità aperte sopra ${formatOpportunityAmount(amount)} per un totale di ${formatOpportunityAmount(total)}. Priorità di chiusura:\n\n${lines.join("\n")}`
      ),
      {
        items: matches.map((item) => ({
          id: item.id,
          title: item.company_name ?? item.title,
          subtitle: formatOpportunityAmount(item.total_amount),
        })),
        actions: dedupeActions([
          buildJoyPromptAction(
            "prep-top",
            "Prepara richiamo sulla top",
            matches[0]?.company_name
              ? `Prepara chiamata ${matches[0].company_name}`
              : "Coach commerciale"
          ),
          ...actions,
        ]).slice(0, 16),
      }
    ),
    sessionState: "proposing",
  };
}

async function handleProductInterest(family: ProductFamily): Promise<JoyChatResponse> {
  const label = PRODUCT_FAMILY_LABELS[family];
  const { companyIds, error } = await resolveCompanyIdsForProductFilters({ productFamily: family });
  if (error) {
    return { message: assistantMessage(`Errore interessi prodotto: ${error}`) };
  }

  if (!companyIds || companyIds.length === 0) {
    return {
      message: assistantMessage(
        `Nessun cliente con interesse registrato per ${label} nei dati CRM.`
      ),
    };
  }

  const rows = await fetchCompaniesByIds(companyIds);
  const top = rows.slice(0, 4);
  const lines = top.map(
    (row, index) =>
      `${index + 1}. **${row.name}**${row.city ? ` — ${row.city}` : ""} — interesse ${label} in scheda`
  );

  const actions = top.flatMap((row) =>
    buildCompanyChatActions(
      {
        id: row.id,
        name: row.name,
        phone: resolvePhone(row),
        latitude: row.latitude,
        longitude: row.longitude,
      },
      `product-${row.id}`
    ).slice(0, 2)
  );

  return {
    message: assistantMessage(
      withConfirmationAsk(
        `Per spingere **${label}** ti propongo queste ${top.length} aziende (su ${companyIds.length} con interesse CRM):\n\n${lines.join("\n")}`
      ),
      {
        items: top.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.city ?? label,
        })),
        actions: dedupeActions([
          buildJoyPromptAction(
            "tour-product",
            `Organizza giro ${label}`,
            `Organizza il mio giro visite per oggi focus ${label}`
          ),
          buildJoyPromptAction(
            "strategy-product",
            `Strategia ${label}`,
            `Voglio vendere ${label} oggi`
          ),
          ...actions,
        ]).slice(0, 16),
      }
    ),
    sessionState: "proposing",
  };
}

async function handleOptimizeTour(userId: string | null): Promise<JoyChatResponse> {
  const [scheduled, suggestionsResult] = await Promise.all([
    getUserScopedTodayVisitPlan(userId),
    getDailyVisitSuggestions({ limit: 8, agentId: userId }),
  ]);

  const suggestions = suggestionsResult.data ?? [];

  if (scheduled.length === 0 && suggestions.length === 0) {
    return {
      message: assistantMessage(
        "Non ho visite né suggerimenti CRM per un giro oggi. Dimmi zona/CAP (es. Latina) o «Ho due ore libere» e propongo tappe dai dati disponibili."
      ),
      sessionState: "proposing",
    };
  }

  const ordered = [...scheduled].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const lines: string[] = [];

  ordered.forEach((visit, index) => {
    lines.push(
      `${index + 1}. **${visit.companyName}** — ${formatVisitDate(visit.scheduledAt)}`
    );
  });

  if (suggestions.length > 0) {
    lines.push("\n**Clienti da inserire nel giro (suggeriti da Joy):**");
    suggestions.slice(0, 5).forEach((item, index) => {
      lines.push(
        `${ordered.length + index + 1}. ${item.companyName}${item.city ? ` (${item.city})` : ""} — priorità ${item.tier}`
      );
    });
  }

  const companyIds = [
    ...ordered.map((visit) => visit.companyId),
    ...suggestions.map((item) => item.companyId),
  ];
  const companies = await fetchCompaniesByIds(companyIds);
  const actions = companies.flatMap((row) =>
    buildCompanyChatActions(
      {
        id: row.id,
        name: row.name,
        phone: resolvePhone(row),
        latitude: row.latitude,
        longitude: row.longitude,
      },
      `tour-${row.id}`
    ).slice(0, 1)
  );

  return {
    message: assistantMessage(
      withConfirmationAsk(
        `Proposta giro ottimizzato per oggi:\n\n${lines.join("\n")}`
      ),
      {
        actions: dedupeActions([
          buildJoyPromptAction(
            "confirm-tour",
            "Conferma e organizza",
            "Organizza il mio giro visite per oggi"
          ),
          ...actions,
        ]).slice(0, 14),
      }
    ),
    sessionState: "proposing",
  };
}

async function handleNearbyCity(city: string, userId: string | null): Promise<JoyChatResponse> {
  const key = normalizeCityKey(city);
  const center = CITY_CENTERS[key];
  const supabase = await createServerClient();
  const pattern = escapeIlikePattern(city);

  let rows: Array<CompanyRow & { distanceKm?: number }> = [];

  if (pattern) {
    let cityQuery = supabase
      .from("companies")
      .select(
        "id,name,city,province,phone,contact_phone,mobile,latitude,longitude,last_visit_at"
      )
      .ilike("city", pattern)
      .limit(40);
    if (userId) {
      cityQuery = applyAgentCompanyScope(cityQuery, userId);
    }
    const { data: cityMatches } = await cityQuery;

    rows = (cityMatches ?? []) as CompanyRow[];

    if (center?.province) {
      let provinceQuery = supabase
        .from("companies")
        .select(
          "id,name,city,province,phone,contact_phone,mobile,latitude,longitude,last_visit_at"
        )
        .ilike("province", `%${center.province}%`)
        .limit(40);
      if (userId) {
        provinceQuery = applyAgentCompanyScope(provinceQuery, userId);
      }
      const { data: provinceMatches } = await provinceQuery;

      const merged = new Map(rows.map((row) => [row.id, row]));
      for (const row of (provinceMatches ?? []) as CompanyRow[]) {
        merged.set(row.id, row);
      }
      rows = [...merged.values()];
    }
  }

  if (center) {
    let geoQuery = supabase
      .from("companies")
      .select(
        "id,name,city,province,phone,contact_phone,mobile,latitude,longitude,last_visit_at"
      )
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(300);
    if (userId) {
      geoQuery = applyAgentCompanyScope(geoQuery, userId);
    }
    const { data: geoCompanies } = await geoQuery;

    const withDistance = (geoCompanies ?? [])
      .map((row) => {
        const company = row as CompanyRow;
        const distanceKm = getDistanceKm(
          center.lat,
          center.lng,
          company.latitude!,
          company.longitude!
        );
        return { ...company, distanceKm };
      })
      .filter((row) => row.distanceKm <= 30)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const merged = new Map<string, CompanyRow & { distanceKm?: number }>();
    for (const row of [...rows, ...withDistance]) {
      merged.set(row.id, row);
    }
    rows = [...merged.values()].slice(0, LIST_LIMIT);
  } else {
    rows = rows.slice(0, LIST_LIMIT);
  }

  if (rows.length === 0) {
    return {
      message: assistantMessage(
        `Non ho trovato clienti vicino a ${city}. Prova con il nome città o provincia.`,
        { actions: [buildPageAction("maps", "Cerca su mappa", "/maps")] }
      ),
    };
  }

  const lines = rows.map((row) => {
    const distance =
      row.distanceKm != null ? ` — ${formatDistanceKm(row.distanceKm)}` : "";
    return `• **${row.name}**${row.city ? ` (${row.city})` : ""}${distance}`;
  });

  const actions = rows.flatMap((row) =>
    buildCompanyChatActions(
      {
        id: row.id,
        name: row.name,
        phone: resolvePhone(row),
        latitude: row.latitude,
        longitude: row.longitude,
      },
      `nearby-${row.id}`
    ).slice(0, 2)
  );

  return {
    message: assistantMessage(
      `Clienti vicino a **${city}** (${rows.length} risultati):\n\n${lines.join("\n")}`,
      {
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle:
            [row.city, row.distanceKm != null ? formatDistanceKm(row.distanceKm) : null]
              .filter(Boolean)
              .join(" · ") || undefined,
        })),
        actions: dedupeActions([
          buildPageAction("maps-city", "Apri mappa", `/maps?city=${encodeURIComponent(city)}`),
          ...actions,
        ]).slice(0, 16),
      }
    ),
  };
}

async function handleOpenCompany(
  query: string,
  userId: string | null
): Promise<JoyChatResponse> {
  const result = await searchCompanies({ query, limit: 5, userId: userId ?? undefined });
  if (!result.hasData && result.error) {
    return insufficientDataResponse();
  }

  const rows = result.data.rows;
  if (rows.length === 0) {
    return {
      message: assistantMessage(
        `Non ho trovato aziende con nome simile a "${query}".`,
        { actions: [buildPageAction("companies", "Cerca in elenco", "/companies")] }
      ),
    };
  }

  if (rows.length === 1) {
    const company = rows[0];
    const location = [company.city, company.province].filter(Boolean).join(", ");
    const href = `/companies/${company.id}`;
    return {
      message: {
        id: newMessageId(),
        role: "assistant",
        content: `Trovata **${company.name}**${location ? ` (${location})` : ""}. Ultima visita: ${formatLastVisitLabel(company.last_visit_at)}.\n\nConferma per aprire la scheda (nessuna apertura automatica).`,
        actions: buildCompanyChatActions(
          {
            id: company.id,
            name: company.name,
            phone: resolvePhone(company),
            latitude: company.latitude,
            longitude: company.longitude,
          },
          "open-single"
        ),
        pendingAction: {
          id: `open-company-${company.id}`,
          title: `Apri ${company.name}`,
          description: `Aprire la scheda di ${company.name}`,
          operation: {
            type: "navigate",
            href,
            label: company.name,
          },
          status: "pending",
        },
        createdAt: new Date().toISOString(),
      },
      memoryPatch: {
        lastCompanyId: company.id,
        lastCompanyName: company.name,
        selectedClientId: company.id,
        selectedClientName: company.name,
        conversationGoal: "search",
      },
      sessionState: "confirming",
    };
  }

  const lines = rows.map((row) => `• **${row.name}**${row.city ? ` — ${row.city}` : ""}`);
  const actions = rows.map((row) =>
    buildPageAction(`open-${row.id}`, `Apri ${row.name}`, `/companies/${row.id}`)
  );

  return {
    message: assistantMessage(
      `Ho trovato ${rows.length} aziende simili a "${query}":\n\n${lines.join("\n")}\n\nDi' «Apri [nome esatto]» oppure tocca una scheda.`,
      {
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.city ?? undefined,
        })),
        actions,
      }
    ),
    memoryPatch: { conversationGoal: "search" },
  };
}

async function handleFollowUpsOverdue(context: JoyChatContext = {}): Promise<JoyChatResponse> {
  const result = await getOverdueFollowUps({
    companyId: context.companyId ?? undefined,
    limit: LIST_LIMIT,
  });
  if (!result.hasData && result.error) {
    return toolErrorResponse(context);
  }

  const items = result.data.rows;
  if (items.length === 0) {
    const upcoming = await getFollowUps({
      companyId: context.companyId ?? undefined,
      period: "next7",
      limit: LIST_LIMIT,
    });
    const rows = upcoming.data?.rows ?? [];
    if (rows.length === 0) {
      return {
        message: assistantMessage(
          withCompanyContext(
            "Nessun richiamo scaduto né in scadenza nei prossimi 7 giorni. Vuoi che proponga clienti trascurati da richiamare?",
            context
          )
        ),
        sessionState: "proposing",
      };
    }
    return handleFollowUpsList(rows, context, "Da richiamare nei prossimi 7 giorni");
  }

  return handleFollowUpsList(items, context, "Da richiamare subito (in ritardo)");
}

async function handleFollowUpsList(
  items: Array<{
    id: string;
    companyId?: string | null;
    companyName?: string | null;
    scheduledAt: string;
    priority: string;
  }>,
  context: JoyChatContext,
  headline: string
): Promise<JoyChatResponse> {
  const lines = items.map(
    (item, index) =>
      `${index + 1}. **${item.companyName ?? "Azienda"}** — ${formatVisitDate(item.scheduledAt)} (${item.priority})`
  );

  const actions = items.flatMap((item) => {
    if (!item.companyId) {
      return [];
    }
    return buildCompanyChatActions(
      { id: item.companyId, name: item.companyName ?? "Azienda" },
      `fu-${item.id}`
    ).filter((action) => action.kind === "follow_up" || action.kind === "call" || action.kind === "open_company");
  });

  const firstName = items[0]?.companyName;
  return {
    message: assistantMessage(
      withConfirmationAsk(
        withCompanyContext(
          `**${headline}** — ${items.length} nominativi dai dati CRM:\n\n${lines.join("\n")}`,
          context
        )
      ),
      {
        actions: dedupeActions([
          ...(firstName
            ? [
                buildJoyPromptAction(
                  "prep-call",
                  `Prepara chiamata ${firstName.slice(0, 18)}`,
                  `Prepara chiamata ${firstName}`
                ),
              ]
            : []),
          ...actions,
        ]).slice(0, 14),
      }
    ),
    sessionState: "proposing",
  };
}

async function handleAgendaToday(userId: string | null, context: JoyChatContext = {}): Promise<JoyChatResponse> {
  const result = await getAgendaToday(userId);
  if (!result.hasData && result.error) {
    return insufficientDataResponse();
  }

  const upcoming = result.data;
  if (upcoming.length === 0) {
    // Empty day → operational visit proposal (tour / free-time / sell-more), not calendar empty state.
    return proposeEmptyDayOperationalPlan(userId, context);
  }

  const lines = upcoming.slice(0, LIST_LIMIT).map(
    (item, index) =>
      `${index + 1}. **${item.title}** — ${formatVisitDate(item.scheduledAt)} (${item.kindLabel})`
  );

  return {
    message: assistantMessage(
      withConfirmationAsk(
        `Agenda di oggi (${upcoming.length} impegni):\n\n${lines.join("\n")}`
      ),
      {
        items: upcoming.slice(0, LIST_LIMIT).map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: `${formatVisitDate(item.scheduledAt)} · ${item.kindLabel}`,
        })),
        actions: [
          buildJoyPromptAction(
            "optimize",
            "Ottimizza il giro",
            "Organizza il mio giro visite per oggi"
          ),
          buildJoyPromptAction("free-time", "Riempi tempo libero", "Ho due ore libere"),
        ],
      }
    ),
    sessionState: "proposing",
  };
}

async function handleRadar(
  userId: string | null,
  context: JoyChatContext = {}
): Promise<JoyChatResponse> {
  const supabase = await createServerClient();
  let query = supabase
    .from("companies")
    .select("id,latitude,longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .in("commercial_status", ["prospect", "cliente"])
    .limit(200);

  if (userId) {
    query = applyAgentCompanyScope(query, userId);
  }

  const { data: companies } = await query;
  const rows = companies ?? [];
  if (rows.length === 0) {
    return {
      message: assistantMessage("Nessuna azienda geolocalizzata per il radar.", {
        actions: [buildPageAction("maps", "Apri mappa", "/maps")],
      }),
    };
  }

  const hasGps =
    context.latitude != null &&
    context.longitude != null &&
    Number.isFinite(context.latitude) &&
    Number.isFinite(context.longitude);

  const centerLat = hasGps
    ? Number(context.latitude)
    : rows.reduce((sum, row) => sum + Number(row.latitude), 0) / rows.length;
  const centerLng = hasGps
    ? Number(context.longitude)
    : rows.reduce((sum, row) => sum + Number(row.longitude), 0) / rows.length;

  const result = await analyzeOpportunityRadar({
    centerLat,
    centerLng,
    radiusKm: hasGps ? 20 : 10,
    companyIds: rows.map((row) => row.id),
  });

  const hits = result.items.slice(0, LIST_LIMIT);
  if (hits.length === 0) {
    return {
      message: assistantMessage(
        "Il radar non ha trovato opportunità nelle vicinanze con i dati geolocalizzati disponibili."
      ),
    };
  }

  const originLabel = hasGps ? "dalla tua posizione GPS" : "dal baricentro del portafoglio";
  const lines = hits.map(
    (item, index) =>
      `${index + 1}. **${item.companyName}** — ${formatDistanceKm(item.distanceKm)} · ${item.primaryReason}`
  );

  const actions = hits.flatMap((item) =>
    buildCompanyChatActions(
      {
        id: item.companyId,
        name: item.companyName,
        phone: item.phone,
        latitude: item.latitude,
        longitude: item.longitude,
      },
      `radar-${item.companyId}`
    ).slice(0, 2)
  );

  return {
    message: assistantMessage(
      withConfirmationAsk(
        `Radar (${originLabel}): ${hits.length} clienti interessanti:\n\n${lines.join("\n")}`
      ),
      {
        actions: dedupeActions([
          buildJoyPromptAction(
            "tour-radar",
            "Organizza giro su queste tappe",
            "Organizza il mio giro visite per oggi"
          ),
          ...actions,
        ]).slice(0, 16),
      }
    ),
    sessionState: "proposing",
  };
}

async function handleCalendarStatus(): Promise<JoyChatResponse> {
  const connection = await getGoogleCalendarConnectionView();
  if (!connection.configured) {
    return {
      message: assistantMessage(
        "Google Calendar non è configurato nel CRM. Chiedi all'amministratore di abilitare l'integrazione.",
        { actions: [buildPageAction("settings", "Impostazioni", "/settings")] }
      ),
    };
  }

  if (!connection.connected || connection.needsReconnect) {
    return {
      message: assistantMessage(
        "Google Calendar non è collegato o richiede riconnessione. Collega l'account dalle impostazioni.",
        { actions: [buildPageAction("settings-calendar", "Collega calendario", "/settings")] }
      ),
    };
  }

  const lastSync = connection.lastSyncAt
    ? formatVisitDate(connection.lastSyncAt)
    : "mai";
  const errorNote = connection.lastSyncError
    ? `\nUltimo errore sync: ${connection.lastSyncError}`
    : "";

  return {
    message: assistantMessage(
      `Google Calendar collegato (${connection.googleEmail ?? "account Google"}). Ultima sincronizzazione: ${lastSync}.${errorNote}`,
      { actions: [buildPageAction("agenda", "Vedi agenda", "/agenda")] }
    ),
  };
}

async function handlePipelineSummary(): Promise<JoyChatResponse> {
  const result = await getPipeline();
  if (result.error || !result.data) {
    return {
      message: assistantMessage(`Errore pipeline: ${result.error ?? "Dati non disponibili."}`),
    };
  }

  const { openCount, openValue, stages } = result.data;
  const stageLines = stages
    .filter((entry) => entry.count > 0)
    .map((entry) => `• **${entry.label}**: ${entry.count} · ${entry.totalAmount}`);

  return {
    message: assistantMessage(
      `Pipeline: ${openCount} opportunità aperte per ${openValue}.\n\n**Per fase:**\n${stageLines.join("\n")}\n\n${withConfirmationAsk("Priorità: chiudi le fasi più avanzate e riprendi le opportunità ferme.")}`,
      {
        actions: [
          buildJoyPromptAction("risk", "Chi rischio di perdere", "Chi rischio di perdere?"),
          buildJoyPromptAction("sell-more", "Piano vendite oggi", "Come vendiamo di più oggi?"),
        ],
      }
    ),
    sessionState: "proposing",
  };
}

async function handleOrdersSummary(context: JoyChatContext = {}): Promise<JoyChatResponse> {
  const result = await getOrders({ companyId: context.companyId ?? undefined });
  if (!result.hasData || !result.data) {
    return toolErrorResponse(context);
  }

  const { orderCount, totalValue, recentOrders } = result.data;
  const lines = recentOrders.map(
    (item) => `• **${item.companyName ?? item.title}** — ${item.amount}`
  );

  return {
    message: assistantMessage(
      withCompanyContext(
        `Ordini: ${orderCount} registrati per un totale di ${totalValue}.\n\n**Ultimi ordini:**\n${lines.length > 0 ? lines.join("\n") : "Nessun ordine recente."}`,
        context
      ),
      {
        actions: [buildPageAction("ordini", "Apri ordini", "/ordini")],
      }
    ),
  };
}

async function handleProductCatalog(): Promise<JoyChatResponse> {
  const result = await getProductCatalog();
  if (result.error || !result.data) {
    return {
      message: assistantMessage(`Errore catalogo: ${result.error ?? "Dati non disponibili."}`),
    };
  }

  const { totalProducts, activeProducts, families, sampleProducts } = result.data;
  const familyLines = families.map((entry) => `• **${entry.label}**: ${entry.count}`);
  const productLines = sampleProducts.map((item) => `• ${item.name} (${item.family})`);

  return {
    message: assistantMessage(
      `Catalogo: ${totalProducts} prodotti (${activeProducts} attivi).\n\n**Per famiglia:**\n${familyLines.join("\n")}\n\n**Esempi attivi:**\n${productLines.join("\n")}`,
      {
        actions: [buildPageAction("products", "Apri catalogo", "/products")],
      }
    ),
  };
}

async function handleSamplesSummary(): Promise<JoyChatResponse> {
  const result = await getSamples();
  if (result.error || !result.data) {
    return {
      message: assistantMessage(`Errore campioni: ${result.error ?? "Dati non disponibili."}`),
    };
  }

  const { total, outstanding, purchased, recentSamples } = result.data;
  const lines = recentSamples.map(
    (item) => `• **${item.companyName ?? item.title}** — ${item.title} (${item.status})`
  );

  return {
    message: assistantMessage(
      `Campioni: ${total} totali · ${outstanding} in prestito · ${purchased} convertiti in acquisto.\n\n**Ultimi campioni:**\n${lines.length > 0 ? lines.join("\n") : "Nessun campione registrato."}`,
      {
        actions: [
          buildPageAction("campioni", "Apri campioni", "/campioni"),
          buildPageAction("campioni-recupero", "Da recuperare", "/campioni?status=consegnato"),
        ],
      }
    ),
  };
}

async function handleSamplesToRecover(context: JoyChatContext = {}): Promise<JoyChatResponse> {
  const result = await getSamplesToRecover({
    companyId: context.companyId ?? undefined,
  });
  if (result.error || !result.data) {
    return {
      message: assistantMessage(
        withCompanyContext(
          `Errore campioni da recuperare: ${result.error ?? "Dati non disponibili."}`,
          context
        )
      ),
    };
  }

  return {
    message: assistantMessage(withCompanyContext(result.data.summaryText, context), {
      actions: [
        buildPageAction("campioni", "Apri campioni", "/campioni"),
        ...(result.data.samples[0]
          ? [
              buildPageAction(
                "sample-first",
                "Apri primo campione",
                `/campioni/${result.data.samples[0].id}`
              ),
            ]
          : []),
      ],
    }),
  };
}

async function handleServiceSummary(): Promise<JoyChatResponse> {
  const result = await getServiceTickets();
  if (result.error || !result.data) {
    return {
      message: assistantMessage(`Errore assistenza: ${result.error ?? "Dati non disponibili."}`),
    };
  }

  const { total, open, resolved, recentTickets } = result.data;
  const lines = recentTickets.map(
    (item) => `• **${item.companyName ?? item.title}** — ${item.title} (${item.status})`
  );

  return {
    message: assistantMessage(
      `Assistenza: ${total} ticket · ${open} aperti · ${resolved} risolti/chiusi.\n\n**Ultimi ticket:**\n${lines.length > 0 ? lines.join("\n") : "Nessun ticket registrato."}`,
      {
        actions: [buildPageAction("assistenza", "Apri assistenza", "/assistenza")],
      }
    ),
  };
}

async function handleOpenServiceTickets(context: JoyChatContext = {}): Promise<JoyChatResponse> {
  const result = await getOpenServiceTickets({
    companyId: context.companyId ?? undefined,
  });
  if (result.error || !result.data) {
    return {
      message: assistantMessage(
        withCompanyContext(
          `Errore ticket aperti: ${result.error ?? "Dati non disponibili."}`,
          context
        )
      ),
    };
  }

  return {
    message: assistantMessage(withCompanyContext(result.data.summaryText, context), {
      actions: [
        buildPageAction("assistenza", "Apri assistenza", "/assistenza"),
        ...(result.data.tickets[0]
          ? [
              buildPageAction(
                "ticket-first",
                "Apri primo ticket",
                `/assistenza/${result.data.tickets[0].id}`
              ),
            ]
          : []),
      ],
    }),
  };
}

async function handleDailyPlan(
  userId: string | null,
  context: JoyChatContext = {}
): Promise<JoyChatResponse> {
  const result = await getDailyPlan({ userId });
  if (result.error || !result.data) {
    return {
      message: assistantMessage(
        withCompanyContext(
          `Errore piano giornata: ${result.error ?? "Dati non disponibili."}`,
          context
        )
      ),
    };
  }

  return {
    message: assistantMessage(withCompanyContext(result.data.summaryText, context), {
      actions: [
        buildJoyPromptAction(
          "tour-plan",
          "Organizza giro",
          "Organizza il mio giro visite per oggi"
        ),
        buildJoyPromptAction("free-time", "Riempi tempo libero", "Ho due ore libere"),
        buildJoyPromptAction("callbacks", "Chi richiamare", "Chi devo richiamare?"),
      ],
    }),
    sessionState: "proposing",
  };
}

async function handleCompanyTimeline(
  context: JoyChatContext = {},
  query: string | null
): Promise<JoyChatResponse> {
  let companyId = context.companyId?.trim() ?? null;

  if (!companyId && query) {
    const search = await searchCompanies({ query, limit: 5 });
    const rows = search.data?.rows ?? [];
    if (!search.hasData || rows.length === 0) {
      return {
        message: assistantMessage(
          `Non trovo un'azienda per «${query}». Specifica il nome o apri Joy dalla scheda azienda.`
        ),
      };
    }
    if (rows.length > 1) {
      const lines = rows.map((item) => `• **${item.name}**${item.city ? ` (${item.city})` : ""}`);
      return {
        message: assistantMessage(
          `Trovate più aziende. Specifica meglio o apri Joy dalla scheda:\n${lines.join("\n")}`,
          {
            actions: rows.slice(0, 3).map((item) =>
              buildPageAction(`company-${item.id}`, item.name, `/joy-ai?company=${item.id}`)
            ),
          }
        ),
      };
    }
    companyId = rows[0].id;
  }

  if (!companyId) {
    return {
      message: assistantMessage(
        "Per la timeline indica l'azienda (es. «timeline commerciale [nome]») oppure apri Joy dalla scheda azienda."
      ),
    };
  }

  const result = await getCompanyTimeline(companyId);
  if (result.error || !result.data) {
    return {
      message: assistantMessage(
        withCompanyContext(
          `Errore timeline: ${result.error ?? "Dati non disponibili."}`,
          { ...context, companyId }
        )
      ),
    };
  }

  return {
    message: assistantMessage(
      withCompanyContext(result.data.summaryText, { ...context, companyId }),
      {
        actions: [
          buildPageAction("company", "Scheda azienda", `/companies/${companyId}`),
          buildPageAction("commercial", "Tab commerciale", `/companies/${companyId}?tab=commerciale`),
          buildPageAction("briefing", "Briefing", `/joy-ai?company=${companyId}`),
        ],
      }
    ),
  };
}

async function handleDocumentsSummary(): Promise<JoyChatResponse> {
  const result = await getDocuments();
  if (result.error || !result.data) {
    return {
      message: assistantMessage(`Errore documenti: ${result.error ?? "Dati non disponibili."}`),
    };
  }

  const { total, recentDocuments } = result.data;
  const lines = recentDocuments.map(
    (item) =>
      `• **${item.fileName}** (${item.kind})${item.entityName ? ` — ${item.entityName}` : ""}`
  );

  return {
    message: assistantMessage(
      `Documenti archiviati: ${total}.\n\n**Ultimi documenti:**\n${lines.length > 0 ? lines.join("\n") : "Nessun documento caricato."}`,
      {
        actions: [buildPageAction("documenti", "Apri documenti", "/documenti")],
      }
    ),
  };
}

async function handleContactsSummary(context: JoyChatContext = {}): Promise<JoyChatResponse> {
  const result = await getContacts({
    companyId: context.companyId ?? undefined,
    limit: LIST_LIMIT,
  });
  if (!result.hasData && result.error) {
    return toolErrorResponse(context);
  }

  const rows = result.data.rows;
  const total = result.data.total;
  if (rows.length === 0) {
    return {
      message: assistantMessage(
        withCompanyContext("Nessun contatto trovato nel CRM.", context),
        { actions: [buildPageAction("contacts", "Apri contatti", "/contacts")] }
      ),
    };
  }

  const lines = rows.map(
    (row) =>
      `• **${row.fullName}** — ${row.companyName ?? "Azienda"}${row.phone ? ` · ${row.phone}` : ""}`
  );

  return {
    message: assistantMessage(
      withCompanyContext(
        `Hai ${total} contatti nel CRM. Ecco i primi ${rows.length}:\n\n${lines.join("\n")}`,
        context
      ),
      {
        actions: [
          buildPageAction("contacts", "Apri contatti", "/contacts"),
          ...rows
            .filter((row) => row.phone)
            .slice(0, 4)
            .map((row) => ({
              id: `call-${row.id}`,
              kind: "call" as const,
              label: `Chiama ${row.fullName}`,
              href: `tel:${row.phone!.replace(/\s+/g, "")}`,
            })),
        ],
      }
    ),
  };
}

async function handleAgendaTomorrow(userId: string | null): Promise<JoyChatResponse> {
  const result = await getAgendaTomorrow(userId);
  if (!result.hasData && result.error) {
    return insufficientDataResponse();
  }

  const items = result.data;
  if (items.length === 0) {
    return {
      message: assistantMessage(
        withConfirmationAsk(
          "Domani non hai appuntamenti in agenda. Posso proporti un giro dalle aziende prioritarie CRM."
        ),
        {
          actions: [
            buildJoyPromptAction(
              "tour-tomorrow",
              "Proponi giro domani",
              "Organizza il mio giro visite per domani"
            ),
            buildJoyPromptAction("sell-more", "Piano vendite", "Come vendiamo di più oggi?"),
          ],
        }
      ),
      sessionState: "proposing",
    };
  }

  const lines = items.slice(0, LIST_LIMIT).map(
    (item, index) =>
      `${index + 1}. **${item.title}** — ${formatVisitDate(item.scheduledAt)} (${item.kindLabel})`
  );

  return {
    message: assistantMessage(
      withConfirmationAsk(
        `Appuntamenti di domani (${items.length}):\n\n${lines.join("\n")}`
      ),
      {
        items: items.slice(0, LIST_LIMIT).map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: `${formatVisitDate(item.scheduledAt)} · ${item.kindLabel}`,
        })),
        actions: [
          buildJoyPromptAction(
            "tour-tomorrow",
            "Ottimizza giro domani",
            "Organizza il mio giro visite per domani"
          ),
        ],
      }
    ),
    sessionState: "proposing",
  };
}

async function handleVisitsThisWeek(userId: string | null): Promise<JoyChatResponse> {
  const result = await getVisits({ userId, period: "week", limit: LIST_LIMIT });
  if (!result.hasData && result.error) {
    return insufficientDataResponse();
  }

  const rows = result.data.rows;
  const total = result.data.total;

  const lines = rows.map((row) => {
    const when = row.completedAt ? formatVisitDate(row.completedAt) : "—";
    return `• **${row.companyName}** — ${when}${row.city ? ` (${row.city})` : ""}`;
  });

  return {
    message: assistantMessage(
      `Hai completato **${total}** visita/e questa settimana.${rows.length > 0 ? `\n\n**Ultime visite:**\n${lines.join("\n")}` : ""}`,
      {
        actions: [
          buildPageAction("visits-week", "Vedi visite", "/visits?period=week"),
          buildPageAction("reports", "Report", "/reports"),
        ],
      }
    ),
  };
}

async function handleStatistics(): Promise<JoyChatResponse> {
  const statsResult = await getStatistics();

  if (!statsResult.hasData || !statsResult.data) {
    return insufficientDataResponse();
  }

  const summary = statsResult.data;
  const weekVisits = summary.visitsThisWeek;

  const lines = [
    `• Visite oggi: **${summary.visitsToday}**`,
    `• Visite questa settimana: **${weekVisits}**`,
    `• Impegni agenda oggi: **${summary.agendaItemsToday}**`,
    `• Follow-up in ritardo: **${summary.overdueFollowUps}**`,
    `• Opportunità aperte: **${summary.openOpportunities}** (${summary.pipelineValue})`,
    `• Clienti inattivi (90 gg): **${summary.inactiveClients}**`,
    `• Radar opportunità: **${summary.radarHits}**`,
    `• Km stimati giro oggi: **${summary.estimatedTourKm.toFixed(1)} km**`,
  ];

  return {
    message: assistantMessage(
      `Ecco il riepilogo commerciale di oggi, ${summary.userName}:\n\n${lines.join("\n")}`,
      {
        actions: [
          buildPageAction("dashboard", "Mission Control", "/"),
          buildPageAction("joy", "Dashboard Joy", "/joy"),
          buildPageAction("reports", "Report avanzato", "/reports"),
        ],
      }
    ),
  };
}

async function handleProspectByCity(
  city: string | null,
  userId: string | null
): Promise<JoyChatResponse> {
  const result = await searchCompanies({
    city,
    commercialStatus: "prospect",
    userId,
    limit: LIST_LIMIT,
  });

  if (!result.hasData && result.error) {
    return {
      message: assistantMessage(
        "Non riesco a leggere correttamente i dati del CRM"
      ),
    };
  }

  const rows = result.data.rows;
  const total = result.data.total;
  const locationLabel = city ? ` a **${city}**` : "";

  if (total === 0) {
    return {
      message: assistantMessage(`Non ho trovato prospect${locationLabel}.`, {
        actions: [
          buildJoyPromptAction(
            "tour-prospects",
            "Organizza giro prospect",
            "Organizza il mio giro visite per oggi focus prospect"
          ),
        ],
      }),
    };
  }

  const lines = rows.map((row) => {
    const coordsNote =
      row.latitude == null || row.longitude == null
        ? " _(coordinate mancanti)_"
        : "";
    return `• **${row.name}**${row.city ? ` — ${row.city}` : ""}${coordsNote}`;
  });

  const listNote =
    total > rows.length
      ? `\n\n(Mostro i primi ${rows.length} di ${total}.)`
      : "";

  return {
    message: assistantMessage(
      `Hai **${total}** prospect${locationLabel}.${rows.length > 0 ? `\n\n${lines.join("\n")}${listNote}` : ""}`,
      {
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.city ?? "Prospect",
        })),
        actions: dedupeActions([
          buildPageAction(
            "companies-prospect",
            "Vedi prospect",
            city ? `/companies?status=prospect&search=${encodeURIComponent(city)}` : "/companies?status=prospect"
          ),
          ...rows.flatMap((row) =>
            buildCompanyChatActions({ id: row.id, name: row.name }, `prospect-${row.id}`).slice(0, 1)
          ),
        ]).slice(0, 14),
      }
    ),
  };
}

async function handleCompaniesByCity(city: string, userId: string | null): Promise<JoyChatResponse> {
  const result = await searchCompanies({ city, userId, limit: LIST_LIMIT });
  if (!result.hasData && result.error) {
    return insufficientDataResponse();
  }

  const rows = result.data.rows;
  const total = result.data.total;

  if (rows.length === 0) {
    return {
      message: assistantMessage(`Non ho trovato aziende a ${city}.`, {
        actions: [buildPageAction("companies", "Cerca aziende", "/companies")],
      }),
    };
  }

  const lines = rows.map(
    (row) =>
      `• **${row.name}** — ${row.commercial_status ?? "—"}${row.city ? ` (${row.city})` : ""}`
  );

  const listNote = total > rows.length ? `\n\n(Mostro ${rows.length} di ${total}.)` : "";

  return {
    message: assistantMessage(
      `Aziende a **${city}** (${total} totali):\n\n${lines.join("\n")}${listNote}`,
      {
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: [row.city, row.commercial_status].filter(Boolean).join(" · "),
        })),
        actions: dedupeActions([
          buildJoyPromptAction(
            "tour-city",
            `Proponi giro ${city}`,
            `Organizza il mio giro visite per oggi zona ${city}`
          ),
          ...rows.flatMap((row) =>
            buildCompanyChatActions(
              {
                id: row.id,
                name: row.name,
                phone: resolvePhone(row),
                latitude: row.latitude,
                longitude: row.longitude,
              },
              `city-${row.id}`
            ).slice(0, 1)
          ),
        ]).slice(0, 14),
      }
    ),
  };
}

async function handleHighPriority(): Promise<JoyChatResponse> {
  const { data, count, error } = await listCompanies(null, {
    priorityTier: "high",
    pageSize: LIST_LIMIT,
    sortByPriority: true,
  });

  if (error) {
    return { message: assistantMessage(`Errore priorità: ${error}`) };
  }

  const rows = data ?? [];
  const total = count ?? rows.length;

  if (rows.length === 0) {
    return {
      message: assistantMessage("Nessun cliente con priorità alta al momento.", {
        actions: [
          buildJoyPromptAction(
            "tour-priority",
            "Organizza giro priorità",
            "Organizza il mio giro visite per oggi"
          ),
        ],
      }),
    };
  }

  const lines = rows.map(
    (row) =>
      `• **${row.name}**${row.city ? ` — ${row.city}` : ""} · ${formatLastVisitLabel(row.last_visit_at)}`
  );

  return {
    message: assistantMessage(
      `Clienti con priorità alta (${total}):\n\n${lines.join("\n")}`,
      {
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: formatLastVisitLabel(row.last_visit_at),
        })),
        actions: dedupeActions([
          buildPageAction("companies-priority", "Vedi elenco", "/companies?priorityTier=high"),
          ...rows.flatMap((row) =>
            buildCompanyChatActions(
              {
                id: row.id,
                name: row.name,
                phone: row.phone,
              },
              `priority-${row.id}`
            ).slice(0, 2)
          ),
        ]).slice(0, 16),
      }
    ),
  };
}

async function handleMissingEmail(userId: string | null): Promise<JoyChatResponse> {
  const supabase = await createServerClient();
  let query = supabase
    .from("companies")
    .select("id,name,city,province,phone,contact_phone,mobile", { count: "exact" })
    .is("email", null)
    .order("name", { ascending: true })
    .limit(LIST_LIMIT);

  if (userId) {
    query = applyAgentCompanyScope(query, userId);
  }

  const { data, count, error } = await query;
  if (error) {
    return { message: assistantMessage(`Errore ricerca email: ${error.message}`) };
  }

  const rows = (data ?? []) as CompanyRow[];
  const total = count ?? rows.length;

  if (rows.length === 0) {
    return {
      message: assistantMessage("Tutte le aziende nel tuo portafoglio hanno un'email registrata."),
    };
  }

  const lines = rows.map((row) => `• **${row.name}**${row.city ? ` — ${row.city}` : ""}`);

  return {
    message: assistantMessage(
      `Aziende senza email (${total}):\n\n${lines.join("\n")}`,
      {
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.city ?? "Email mancante",
        })),
        actions: dedupeActions(
          rows.map((row) =>
            buildPageAction(`edit-${row.id}`, `Apri ${row.name}`, `/companies/${row.id}`)
          )
        ).slice(0, 12),
      }
    ),
  };
}

async function handleNearbyUser(
  context: JoyChatContext,
  userId: string | null
): Promise<JoyChatResponse> {
  const lat = context.latitude;
  const lng = context.longitude;

  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      message: assistantMessage(
        "Per trovare clienti vicini alla tua posizione, consenti l'accesso al GPS nel browser e riprova.",
        { actions: [buildPageAction("maps", "Apri mappa", "/maps")] }
      ),
    };
  }

  const supabase = await createServerClient();
  let query = supabase
    .from("companies")
    .select(
      "id,name,city,province,phone,contact_phone,mobile,latitude,longitude,last_visit_at"
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(400);

  if (userId) {
    query = applyAgentCompanyScope(query, userId);
  }

  const { data, error } = await query;
  if (error) {
    return { message: assistantMessage(`Errore geolocalizzazione: ${error.message}`) };
  }

  const rows = (data ?? [])
    .map((row) => {
      const company = row as CompanyRow;
      const distanceKm = getDistanceKm(lat, lng, company.latitude!, company.longitude!);
      return { ...company, distanceKm };
    })
    .filter((row) => row.distanceKm <= 25)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, LIST_LIMIT);

  if (rows.length === 0) {
    return {
      message: assistantMessage("Non ho trovato aziende geolocalizzate entro 25 km dalla tua posizione.", {
        actions: [buildPageAction("maps", "Cerca su mappa", "/maps")],
      }),
    };
  }

  const lines = rows.map(
    (row) =>
      `• **${row.name}** — ${formatDistanceKm(row.distanceKm)}${row.city ? ` (${row.city})` : ""}`
  );

  const actions = rows.flatMap((row) =>
    buildCompanyChatActions(
      {
        id: row.id,
        name: row.name,
        phone: resolvePhone(row),
        latitude: row.latitude,
        longitude: row.longitude,
      },
      `near-me-${row.id}`
    ).slice(0, 2)
  );

  return {
    message: assistantMessage(
      `Aziende vicino a te (${rows.length} entro 25 km):\n\n${lines.join("\n")}`,
      {
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: formatDistanceKm(row.distanceKm),
        })),
        actions: dedupeActions([buildPageAction("maps-near", "Apri mappa", "/maps"), ...actions]).slice(
          0,
          16
        ),
      }
    ),
  };
}

async function handleOptimizeTourTomorrow(userId: string | null): Promise<JoyChatResponse> {
  const [scheduled, suggestionsResult] = await Promise.all([
    fetchTomorrowVisitPlan(userId),
    getDailyVisitSuggestions({ limit: 8, agentId: userId }),
  ]);

  const suggestions = suggestionsResult.data ?? [];

  if (scheduled.length === 0 && suggestions.length === 0) {
    return {
      message: assistantMessage(
        "Non ho visite né suggerimenti CRM per un giro domani. Dimmi zona/CAP e vincoli (max visite, orario) e costruisco una proposta."
      ),
      sessionState: "proposing",
    };
  }

  const lines: string[] = [];
  scheduled.forEach((visit, index) => {
    lines.push(
      `${index + 1}. **${visit.companyName}** — ${formatVisitDate(visit.scheduledAt)}${visit.city ? ` (${visit.city})` : ""}`
    );
  });

  if (suggestions.length > 0) {
    lines.push("\n**Candidate da aggiungere:**");
    suggestions.slice(0, 5).forEach((item, index) => {
      lines.push(
        `${scheduled.length + index + 1}. ${item.companyName}${item.city ? ` (${item.city})` : ""} — priorità ${item.tier}`
      );
    });
  }

  return {
    message: assistantMessage(
      withConfirmationAsk(
        `Proposta giro visite per **domani**:\n\n${lines.join("\n")}`
      ),
      {
        actions: [
          buildJoyPromptAction(
            "confirm-tour-tmr",
            "Conferma giro domani",
            "Organizza il mio giro visite per domani"
          ),
        ],
      }
    ),
    sessionState: "proposing",
  };
}

async function handleVisitTours(userId: string | null): Promise<JoyChatResponse> {
  const result = await getVisitTours({ userId, limit: LIST_LIMIT });
  if (!result.hasData && result.error) {
    return insufficientDataResponse();
  }

  const tours = result.data;
  if (tours.length === 0) {
    return {
      message: assistantMessage(
        "Non hai giri visite salvati. Di' «Organizza il mio giro» e preparo una proposta dai dati CRM."
      ),
      sessionState: "proposing",
    };
  }

  const lines = tours.map(
    (tour) =>
      `• **${tour.name}** — ${tour.tourDate} · ${tour.stopCount} tappe${tour.totalDistanceKm != null ? ` · ${tour.totalDistanceKm.toFixed(1)} km` : ""}`
  );

  return {
    message: assistantMessage(
      withConfirmationAsk(
        `Hai ${tours.length} giro/i visite salvati:\n\n${lines.join("\n")}`
      ),
      {
        items: tours.map((tour) => ({
          id: tour.id,
          title: tour.name,
          subtitle: `${tour.tourDate} · ${tour.stopCount} tappe`,
        })),
        actions: [
          buildJoyPromptAction(
            "new-tour",
            "Organizza nuovo giro",
            "Organizza il mio giro visite per oggi"
          ),
          ...tours.slice(0, 4).map((tour) =>
            buildPageAction(`tour-${tour.id}`, tour.name, `/giro-visite?tour=${tour.id}`)
          ),
        ],
      }
    ),
    sessionState: "proposing",
  };
}

async function handleDailyBriefing(
  userId: string | null,
  context: JoyChatContext = {}
): Promise<JoyChatResponse> {
  const result = await getDailyBriefing({
    userId,
    companyId: context.companyId ?? undefined,
  });

  if (!result.hasData || !result.data) {
    return toolErrorResponse(context);
  }

  const briefing = result.data;

  if (briefing.agenda.length === 0 && briefing.visitsToday.length === 0) {
    return proposeEmptyDayOperationalPlan(userId, context);
  }

  const sections: string[] = [
    `Buongiorno **${briefing.userName}**! Ecco la preparazione per **${briefing.dateLabel}**:`,
  ];

  if (briefing.agenda.length > 0) {
    const lines = briefing.agenda
      .slice(0, LIST_LIMIT)
      .map((item) => `• **${item.title}** — ${formatVisitDate(item.scheduledAt)} (${item.kindLabel})`);
    sections.push(`\n**Agenda oggi (${briefing.agenda.length}):**\n${lines.join("\n")}`);
  } else {
    sections.push("\n**Agenda oggi:** libera — sotto propongo come riempirla.");
  }

  if (briefing.visitsToday.length > 0) {
    const lines = briefing.visitsToday.map(
      (visit) =>
        `• **${visit.companyName}** — ${visit.scheduledAt ? formatVisitDate(visit.scheduledAt) : "—"} (${visit.status})`
    );
    sections.push(`\n**Visite oggi (${briefing.visitsToday.length}):**\n${lines.join("\n")}`);
  }

  if (briefing.overdueFollowUps.length > 0) {
    const lines = briefing.overdueFollowUps.map(
      (item) => `• **${item.companyName ?? "Azienda"}** — ${formatVisitDate(item.scheduledAt)}`
    );
    sections.push(`\n**Follow-up scaduti (${briefing.overdueFollowUps.length}):**\n${lines.join("\n")}`);
  }

  if (briefing.suggestions.length > 0 && !context.companyId) {
    const lines = briefing.suggestions.map(
      (item, index) =>
        `${index + 1}. ${item.companyName}${item.city ? ` (${item.city})` : ""} — *${item.reason}*`
    );
    sections.push(`\n**Proposta tappe Joy:**\n${lines.join("\n")}`);
  }

  if (briefing.statistics) {
    sections.push(
      `\n**Numeri chiave:** ${briefing.statistics.visitsToday} visite oggi · ${briefing.statistics.overdueFollowUps} follow-up scaduti · ${briefing.statistics.openOpportunities} opportunità aperte`
    );
  }

  return {
    message: assistantMessage(
      withConfirmationAsk(withCompanyContext(sections.join(""), context)),
      {
        actions: [
          buildJoyPromptAction(
            "tour",
            "Organizza il giro",
            "Organizza il mio giro visite per oggi"
          ),
          buildJoyPromptAction("free-time", "Riempi tempo libero", "Ho due ore libere"),
          buildJoyPromptAction("callbacks", "Chi richiamare", "Chi devo richiamare?"),
        ],
      }
    ),
    sessionState: "proposing",
  };
}

async function handleEndOfDaySummary(
  userId: string | null,
  context: JoyChatContext = {}
): Promise<JoyChatResponse> {
  const result = await getEndOfDaySummary({
    userId,
    companyId: context.companyId ?? undefined,
  });

  if (!result.hasData || !result.data) {
    return toolErrorResponse(context);
  }

  const summary = result.data;
  const sections: string[] = [
    `Riepilogo di fine giornata per **${summary.userName}** (${summary.dateLabel}):`,
  ];

  if (summary.completedVisits.length > 0) {
    const lines = summary.completedVisits.map(
      (visit) => `• **${visit.companyName}** — completata`
    );
    sections.push(`\n**Visite completate (${summary.completedVisits.length}):**\n${lines.join("\n")}`);
  } else {
    sections.push("\n**Visite completate:** nessuna registrata oggi.");
  }

  if (summary.completedFollowUps.length > 0) {
    const lines = summary.completedFollowUps.map(
      (item) => `• **${item.companyName ?? "Azienda"}** — ${item.description ?? "follow-up"}`
    );
    sections.push(`\n**Follow-up chiusi (${summary.completedFollowUps.length}):**\n${lines.join("\n")}`);
  }

  if (summary.activities.length > 0) {
    const lines = summary.activities.map(
      (item) => `• **${item.companyName ?? "Azienda"}** — ${item.type} (${item.occurredLabel})`
    );
    sections.push(`\n**Attività registrate (${summary.activities.length}):**\n${lines.join("\n")}`);
  }

  if (summary.agendaRemaining.length > 0) {
    const lines = summary.agendaRemaining.map(
      (item) => `• **${item.title}** — ${formatVisitDate(item.scheduledAt)}`
    );
    sections.push(`\n**Impegni ancora aperti (${summary.agendaRemaining.length}):**\n${lines.join("\n")}`);
  }

  const hasActivity =
    summary.completedVisits.length > 0 ||
    summary.completedFollowUps.length > 0 ||
    summary.activities.length > 0;

  if (!hasActivity && summary.agendaRemaining.length === 0) {
    return {
      message: assistantMessage(
        withCompanyContext(
          "Giornata tranquilla: nessuna visita o follow-up chiuso oggi e nessun impegno ancora aperto. Usa «Prepara la mia giornata» o «Piano della giornata» per organizzare le prossime tappe.",
          context
        ),
        {
          actions: [
            buildPageAction("joy-ai", "Joy AI", "/joy-ai"),
            buildPageAction("agenda", "Agenda", "/agenda"),
            buildPageAction("activities", "Attività", "/activities"),
          ],
        }
      ),
    };
  }

  return {
    message: assistantMessage(withCompanyContext(sections.join(""), context), {
      actions: [
        buildPageAction("visits", "Visite", "/visits"),
        buildPageAction("activities", "Attività", "/activities"),
        buildPageAction("reports", "Report", "/reports"),
      ],
    }),
  };
}

async function handleWeeklyBriefing(
  userId: string | null,
  context: JoyChatContext = {}
): Promise<JoyChatResponse> {
  const result = await getWeeklyBriefing({
    userId,
    companyId: context.companyId ?? undefined,
  });

  if (!result.hasData || !result.data) {
    return toolErrorResponse(context);
  }

  const briefing = result.data;
  const lines = [
    `**Piano settimana** per **${briefing.userName}** (dati CRM, nessuna inventione):`,
    `• Visite completate: **${briefing.weekVisitsCount}**`,
    `• Opportunità aperte: **${briefing.openOpportunities}** (${briefing.pipelineValue})`,
    `• Preventivi: **${briefing.quoteCount}**`,
    `• Ordini: **${briefing.orderCount}**`,
    `• Follow-up scaduti: **${briefing.overdueFollowUps.length}**`,
    `• Follow-up prossimi 7 giorni: **${briefing.followUpsNext7.length}**`,
  ];

  if (briefing.overdueFollowUps.length > 0) {
    lines.push(
      "\n**Priorità richiami:**",
      ...briefing.overdueFollowUps
        .slice(0, 4)
        .map(
          (item, index) =>
            `${index + 1}. **${item.companyName ?? "Azienda"}** — ${formatVisitDate(item.scheduledAt)}`
        )
    );
  }

  if (briefing.followUpsNext7.length > 0) {
    lines.push(
      "\n**Richiami in settimana:**",
      ...briefing.followUpsNext7
        .slice(0, 4)
        .map(
          (item, index) =>
            `${index + 1}. **${item.companyName ?? "Azienda"}** — ${formatVisitDate(item.scheduledAt)}`
        )
    );
  }

  if (briefing.weekVisits.length > 0) {
    lines.push(
      "\n**Ultime visite della settimana:**",
      ...briefing.weekVisits.map(
        (visit) =>
          `• **${visit.companyName}**${visit.city ? ` (${visit.city})` : ""}`
      )
    );
  }

  lines.push(
    "",
    "Proposta: chiudi prima i richiami scaduti, poi organizza i giri sui giorni più liberi."
  );

  return {
    message: assistantMessage(
      withConfirmationAsk(withCompanyContext(lines.join("\n"), context)),
      {
        actions: [
          buildJoyPromptAction(
            "tour-week",
            "Organizza giro oggi",
            "Organizza il mio giro visite per oggi"
          ),
          buildJoyPromptAction("callbacks", "Chi richiamare", "Chi devo richiamare?"),
          buildJoyPromptAction("risk", "Chi rischio di perdere", "Chi rischio di perdere?"),
        ],
      }
    ),
    sessionState: "proposing",
  };
}

async function handleFollowUps(context: JoyChatContext = {}): Promise<JoyChatResponse> {
  const overdue = await getOverdueFollowUps({
    companyId: context.companyId ?? undefined,
    limit: LIST_LIMIT,
  });
  if (overdue.hasData && overdue.data.rows.length > 0) {
    return handleFollowUpsList(overdue.data.rows, context, "Da richiamare subito (in ritardo)");
  }

  const result = await getFollowUps({
    companyId: context.companyId ?? undefined,
    period: "next7",
    limit: LIST_LIMIT,
  });

  if (!result.hasData && result.error) {
    return toolErrorResponse(context);
  }

  const items = result.data.rows;
  if (items.length === 0) {
    return {
      message: assistantMessage(
        withCompanyContext(
          "Nessun follow-up nei prossimi 7 giorni. Posso proporti clienti inattivi o opportunità ferme se vuoi.",
          context
        )
      ),
      sessionState: "proposing",
    };
  }

  return handleFollowUpsList(items, context, "Da richiamare nei prossimi 7 giorni");
}

async function handleQuotesSummary(context: JoyChatContext = {}): Promise<JoyChatResponse> {
  const result = await getQuotes({ companyId: context.companyId ?? undefined });
  if (!result.hasData || !result.data) {
    return toolErrorResponse(context);
  }

  const { quoteCount, totalValue, recentQuotes } = result.data;
  const lines = recentQuotes.map(
    (item) => `• **${item.companyName ?? item.title}** — ${item.totalAmount} (${item.statusLabel})`
  );

  return {
    message: assistantMessage(
      withCompanyContext(
        withConfirmationAsk(
          `Preventivi: ${quoteCount} registrati per ${totalValue}.\n\n**Ultimi preventivi:**\n${lines.length > 0 ? lines.join("\n") : "Nessun preventivo recente."}`
        ),
        context
      ),
      {
        actions: [
          buildJoyPromptAction(
            "quote-follow",
            "Prepara follow-up preventivi",
            "Radar commerciale"
          ),
        ],
      }
    ),
    sessionState: "proposing",
  };
}

async function handleOpportunitiesSummary(context: JoyChatContext = {}): Promise<JoyChatResponse> {
  const result = await getOpportunities({
    companyId: context.companyId ?? undefined,
    limit: LIST_LIMIT,
  });

  if (!result.hasData && result.error) {
    return toolErrorResponse(context);
  }

  const { rows, total, openValue } = result.data;
  if (rows.length === 0) {
    return {
      message: assistantMessage(
        withCompanyContext("Nessuna opportunità aperta al momento.", context)
      ),
    };
  }

  const lines = rows.map(
    (item, index) =>
      `${index + 1}. **${item.companyName ?? item.title}** — ${item.totalAmount} (${item.stageLabel})`
  );

  return {
    message: assistantMessage(
      withConfirmationAsk(
        withCompanyContext(
          `${total} opportunità aperte per ${openValue}:\n\n${lines.join("\n")}`,
          context
        )
      ),
      {
        actions: [
          buildJoyPromptAction(
            "stale",
            "Chi rischio di perdere",
            "Chi rischio di perdere?"
          ),
          buildJoyPromptAction(
            "prep-top",
            "Prepara richiamo top",
            rows[0]?.companyName
              ? `Prepara chiamata ${rows[0].companyName}`
              : "Coach commerciale"
          ),
        ],
      }
    ),
    sessionState: "proposing",
  };
}

async function handleStaleOpportunities(context: JoyChatContext = {}): Promise<JoyChatResponse> {
  const [staleResult, inactiveThreshold] = await Promise.all([
    getStaleOpportunities({
      companyId: context.companyId ?? undefined,
      limit: LIST_LIMIT,
    }),
    Promise.resolve(thresholdIsoDaysAgo(90)),
  ]);

  if (!staleResult.hasData && staleResult.error) {
    return toolErrorResponse(context);
  }

  const items = staleResult.data.rows;
  const quotes = await getQuotes({ companyId: context.companyId ?? undefined });
  const oldQuotes = (quotes.data?.recentQuotes ?? [])
    .filter((q) => /inviato|sent|aperto|open/i.test(q.statusLabel ?? ""))
    .slice(0, 3);

  if (items.length === 0 && oldQuotes.length === 0) {
    return {
      message: assistantMessage(
        withCompanyContext(
          "Dai dati CRM non emergono opportunità ferme né preventivi critici da recuperare. Vuoi che controlli i clienti inattivi?",
          context
        )
      ),
      sessionState: "proposing",
    };
  }

  const lines: string[] = [];
  if (items.length > 0) {
    lines.push(
      "**Opportunità ferme:**",
      ...items.map(
        (item, index) =>
          `${index + 1}. **${item.companyName ?? item.title}** — ${item.totalAmount} · ferma da ${item.idleDays ?? "?"} giorni`
      )
    );
  }
  if (oldQuotes.length > 0) {
    lines.push(
      "",
      "**Preventivi da riprendere:**",
      ...oldQuotes.map(
        (item, index) =>
          `${index + 1}. **${item.companyName ?? item.title}** — ${item.totalAmount} (${item.statusLabel})`
      )
    );
  }

  void inactiveThreshold;

  const firstCompany = items[0]?.companyName ?? oldQuotes[0]?.companyName;
  return {
    message: assistantMessage(
      withConfirmationAsk(
        withCompanyContext(
          `Ecco chi rischi di perdere, dai dati CRM:\n\n${lines.join("\n")}`,
          context
        )
      ),
      {
        actions: dedupeActions([
          ...(firstCompany
            ? [
                buildJoyPromptAction(
                  "prep-risk",
                  `Prepara richiamo ${String(firstCompany).slice(0, 16)}`,
                  `Prepara chiamata ${firstCompany}`
                ),
              ]
            : []),
          buildJoyPromptAction(
            "inactive",
            "Clienti inattivi 90 gg",
            "Clienti non visitati da 90 giorni"
          ),
          buildJoyPromptAction("coach", "Coach commerciale", "Coach commerciale"),
        ]).slice(0, 12),
      }
    ),
    sessionState: "proposing",
  };
}

async function handleCommercialStatistics(context: JoyChatContext = {}): Promise<JoyChatResponse> {
  const statsResult = await getCommercialStatistics();

  if (!statsResult.hasData || !statsResult.data) {
    return toolErrorResponse(context);
  }

  const summary = statsResult.data;
  const lines = [
    `• Visite oggi: **${summary.visitsToday}**`,
    `• Visite questa settimana: **${summary.visitsThisWeek}**`,
    `• Impegni agenda oggi: **${summary.agendaItemsToday}**`,
    `• Follow-up in ritardo: **${summary.overdueFollowUps}**`,
    `• Opportunità aperte: **${summary.openOpportunities}** (${summary.pipelineValue})`,
    `• Preventivi: **${summary.quoteCount}**`,
    `• Ordini: **${summary.orderCount}**`,
    `• Campioni in prestito: **${summary.samplesOutstanding}**`,
    `• Ticket assistenza aperti: **${summary.openServiceTickets}**`,
    `• Clienti inattivi (90 gg): **${summary.inactiveClients}**`,
  ];

  return {
    message: assistantMessage(
      withCompanyContext(
        `Statistiche commerciali di oggi, ${summary.userName}:\n\n${lines.join("\n")}`,
        context
      ),
      {
        actions: [
          buildPageAction("dashboard", "Mission Control", "/"),
          buildPageAction("reports", "Report avanzato", "/reports"),
        ],
      }
    ),
  };
}

function handleHelp(): JoyChatResponse {
  return {
    message: assistantMessage(
      `Ciao! Sono **Joy**, l'assistente commerciale di Eterya CRM. Lavoriamo quasi solo a voce/chat — io propongo, tu confermi.\n\n` +
        `**Modalità Conversazione:** resto in ascolto finché non dici «fine sessione».\n\n` +
        `**Briefing e piano:**\n` +
        `• «Prepara la mia giornata» · «Piano della giornata» · «Riepiloga la mia giornata»\n` +
        `• «Briefing azienda [nome]» · «Buongiorno» (suggerimenti mattutini)\n\n` +
        `**Giro intelligente:**\n` +
        `• «Organizza giro domani CAP 04010 max 5 visite entro le 17:00 parto da Sezze fino a Terracina»\n` +
        `• Filtri: falegnami, showroom, fabbri, prospect, clienti\n` +
        `• Mid-route: «evita il traffico», «trova falegnami/showroom/fabbri vicini», «sostituisci X con Y»\n\n` +
        `**Radar e obiettivi:**\n` +
        `• «Ho due ore libere» · «Riempi lo slot» · «Radar»\n` +
        `• «Voglio fatturare 50 mila questo mese»\n` +
        `• «Prepara chiamata Rossi» · «Prepara visita Bianchi»\n\n` +
        `**Coach commerciale:**\n` +
        `• «Coach commerciale» · «Chi dovrei visitare?» · «Clienti a rischio churn»\n\n` +
        `**Debriefing:**\n` +
        `• «Joy registra: interessati a VEPA, richiamare venerdì, concorrente Rossi»\n\n` +
        `**Azioni Copilot (solo con conferma):** visita, follow-up, opportunità, preventivo, ordine, nota, ticket. A voce: «conferma» / «annulla».`,
      {
        actions: [
          buildPageAction("joy-ai", "Joy AI", "/joy-ai"),
          buildPageAction("manuale", "Manuale", "/manuale#joy-ai"),
        ],
      }
    ),
  };
}

function formatEuroAmount(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function handleFreeTimeFillIntent(
  freeMinutes: number,
  userId: string | null,
  context: JoyChatContext = {}
): Promise<JoyChatResponse> {
  const { buildFreeTimeFill } = await import("./joy-free-time-radar.service");
  const result = await buildFreeTimeFill({
    userId,
    freeMinutes,
    latitude: context.latitude ?? context.memory?.lastLat ?? null,
    longitude: context.longitude ?? context.memory?.lastLng ?? null,
  });

  const actions = result.items
    .filter((item) => item.companyId)
    .flatMap((item) =>
      buildCompanyChatActions(
        {
          id: item.companyId!,
          name: item.companyName ?? "Azienda",
          phone: null,
          latitude: null,
          longitude: null,
        },
        `free-${item.companyId}`
      ).slice(0, 2)
    );

  return {
    message: assistantMessage(result.summaryText, {
      actions: dedupeActions([
        buildJoyPromptAction(
          "confirm-free",
          "Conferma piano slot",
          "Organizza il mio giro visite per oggi"
        ),
        buildJoyPromptAction("coach", "Coach commerciale", "Coach commerciale"),
        ...actions,
      ]).slice(0, 14),
    }),
    memoryPatch: { conversationGoal: "free_time" },
    sessionState: "proposing",
  };
}

async function handleSalesGoalIntent(
  amount: number,
  period: "week" | "month" | "year",
  userId: string | null,
  _context: JoyChatContext = {}
): Promise<JoyChatResponse> {
  void _context;
  const supabase = await createServerClient();
  const now = new Date();
  const periodStart = new Date(now);
  if (period === "week") {
    periodStart.setDate(now.getDate() - now.getDay() + 1);
  } else if (period === "year") {
    periodStart.setMonth(0, 1);
  } else {
    periodStart.setDate(1);
  }
  periodStart.setHours(0, 0, 0, 0);

  let wonQuery = supabase
    .from("opportunities")
    .select("id,total_amount,stage,accepted_at,updated_at,company_id")
    .eq("stage", "won")
    .gte("accepted_at", periodStart.toISOString())
    .limit(200);

  let openQuery = supabase
    .from("opportunities")
    .select("id,total_amount,stage,title,company_id,companies(name)")
    .neq("stage", "won")
    .neq("stage", "lost")
    .limit(100);

  if (userId) {
    wonQuery = wonQuery.eq("user_id", userId);
    openQuery = openQuery.eq("user_id", userId);
  }

  const [wonRes, openRes] = await Promise.all([wonQuery, openQuery]);

  const wonAmount = (wonRes.data ?? []).reduce(
    (sum, row) => sum + (Number(row.total_amount) || 0),
    0
  );
  const pipelineAmount = (openRes.data ?? []).reduce(
    (sum, row) => sum + (Number(row.total_amount) || 0),
    0
  );
  const gap = Math.max(0, amount - wonAmount);
  const coverage =
    amount > 0 ? Math.min(100, Math.round((wonAmount / amount) * 100)) : 0;
  const periodLabel =
    period === "week" ? "questa settimana" : period === "year" ? "quest'anno" : "questo mese";

  const topOpen = (openRes.data ?? [])
    .map((row) => ({
      title: String(row.title ?? "Opportunità"),
      amount: Number(row.total_amount) || 0,
      companyName: companyNameFromJoinSafe(row.companies),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const lines = [
    `**Obiettivo vendite** — ${formatEuroAmount(amount)} ${periodLabel}`,
    "",
    `Chiuso (won CRM): **${formatEuroAmount(wonAmount)}** (${coverage}% dell'obiettivo)`,
    `Pipeline aperta: **${formatEuroAmount(pipelineAmount)}**`,
    gap > 0
      ? `Gap residuo: **${formatEuroAmount(gap)}**`
      : "Obiettivo già raggiunto sui won registrati.",
    "",
    topOpen.length > 0
      ? `**Top opportunità aperte:**\n${topOpen
          .map(
            (item) =>
              `• ${item.title}${item.companyName ? ` · ${item.companyName}` : ""} — ${formatEuroAmount(item.amount)}`
          )
          .join("\n")}`
      : "Nessuna opportunità aperta in pipeline per confrontare l'obiettivo.",
    "",
    "Memorizzo l'obiettivo in questa sessione. Di' «Coach commerciale» o «Ho due ore libere» per agire. Nessun salvataggio automatico su CRM.",
  ];

  return {
    message: assistantMessage(lines.join("\n"), {
      actions: [
        buildPageAction("pipeline", "Pipeline", "/pipeline"),
        buildPageAction("preventivi", "Preventivi", "/preventivi"),
        buildPageAction("ordini", "Ordini", "/ordini"),
      ],
    }),
    memoryPatch: {
      salesGoalAmount: amount,
      salesGoalPeriod: period,
      conversationGoal: "sales_goal",
      lastProposedAction: `Obiettivo ${formatEuroAmount(amount)} ${periodLabel}`,
    },
    sessionState: "proposing",
  };
}

function companyNameFromJoinSafe(companies: unknown): string | null {
  const company = Array.isArray(companies) ? companies[0] : companies;
  return (company as { name?: string } | null)?.name ?? null;
}

async function handlePrepareActionIntent(
  action: "call" | "visit" | "email",
  query: string | null,
  userId: string | null,
  context: JoyChatContext = {}
): Promise<JoyChatResponse> {
  let companyId =
    context.companyId?.trim() ||
    context.memory?.selectedClientId ||
    context.memory?.lastCompanyId ||
    null;
  let companyName =
    context.memory?.selectedClientName || context.memory?.lastCompanyName || null;

  if (query?.trim()) {
    const search = await searchCompanies({
      query: query.trim(),
      limit: 5,
      userId: userId ?? undefined,
    });
    const rows = search.data?.rows ?? [];
    if (!search.hasData || rows.length === 0) {
      return {
        message: assistantMessage(
          `Non ho trovato l'azienda "${query}" per preparare l'azione.`
        ),
      };
    }
    if (rows.length > 1) {
      return {
        message: assistantMessage(
          `Ho trovato più aziende per "${query}":\n\n${rows
            .map((row) => `• **${row.name}**`)
            .join("\n")}\n\nRiformula con il nome esatto.`
        ),
      };
    }
    companyId = rows[0].id;
    companyName = rows[0].name;
  }

  if (!companyId || !companyName) {
    return {
      message: assistantMessage(
        "Per preparare l'azione dimmi il cliente (es. «Prepara chiamata Rossi») oppure apri prima una scheda azienda."
      ),
    };
  }

  const briefing = await getCompanyBriefing(companyId);
  const briefingText =
    briefing.hasData && briefing.data
      ? briefing.data.summaryText
      : `Scheda **${companyName}** pronta.`;

  const scheduledAt = new Date();
  scheduledAt.setHours(scheduledAt.getHours() + 1, 0, 0, 0);
  const iso = scheduledAt.toISOString();

  if (action === "email") {
    const company = await getCompanyById(companyId);
    const email = company.data?.email?.trim() || null;
    const href = email
      ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Eterya — ${companyName}`)}`
      : `/companies/${companyId}`;
    return {
      message: {
        id: newMessageId(),
        role: "assistant",
        content: [
          `**Preparazione email — ${companyName}**`,
          "",
          briefingText,
          "",
          email
            ? `Email CRM: ${email}. Conferma per aprire il client di posta.`
            : "Nessuna email in anagrafica: confermo l'apertura della scheda per verificare il contatto.",
          "Nessun invio automatico.",
        ].join("\n"),
        pendingAction: {
          id: `prepare-email-${companyId}`,
          title: `Email ${companyName}`,
          description: email ? `Aprire mailto verso ${email}` : `Aprire scheda ${companyName}`,
          operation: { type: "navigate", href, label: companyName },
          status: "pending",
        },
        actions: buildCompanyChatActions(
          { id: companyId, name: companyName, phone: null, latitude: null, longitude: null },
          "prep-email"
        ),
        createdAt: new Date().toISOString(),
      },
      memoryPatch: {
        lastCompanyId: companyId,
        lastCompanyName: companyName,
        selectedClientId: companyId,
        selectedClientName: companyName,
        conversationGoal: "briefing",
      },
      sessionState: "confirming",
    };
  }

  if (action === "call") {
    return {
      message: {
        id: newMessageId(),
        role: "assistant",
        content: [
          `**Preparazione chiamata — ${companyName}**`,
          "",
          briefingText,
          "",
          "Proposta: crea un follow-up chiamata tra ~1 ora. Conferma per salvare (nessuna chiamata automatica).",
        ].join("\n"),
        pendingAction: {
          id: `prepare-call-${companyId}`,
          title: `Follow-up chiamata ${companyName}`,
          description: `Creare follow-up chiamata per ${companyName}`,
          operation: {
            type: "create_follow_up",
            companyId,
            companyName,
            scheduledAt: iso,
            description: `Chiamata preparata con Joy — ${companyName}`,
          },
          status: "pending",
        },
        actions: buildCompanyChatActions(
          { id: companyId, name: companyName, phone: null, latitude: null, longitude: null },
          "prep-call"
        ),
        createdAt: new Date().toISOString(),
      },
      memoryPatch: {
        lastCompanyId: companyId,
        lastCompanyName: companyName,
        selectedClientId: companyId,
        selectedClientName: companyName,
        conversationGoal: "briefing",
      },
      sessionState: "confirming",
    };
  }

  return {
    message: {
      id: newMessageId(),
      role: "assistant",
      content: [
        `**Preparazione visita — ${companyName}**`,
        "",
        briefingText,
        "",
        "Proposta: pianifica visita tra ~1 ora. Conferma per salvare (nessun salvataggio automatico).",
      ].join("\n"),
      pendingAction: {
        id: `prepare-visit-${companyId}`,
        title: `Visita ${companyName}`,
        description: `Creare visita per ${companyName}`,
        operation: {
          type: "create_visit",
          companyId,
          companyName,
          scheduledAt: iso,
          notes: `Visita preparata con Joy — ${companyName}`,
        },
        status: "pending",
      },
      actions: buildCompanyChatActions(
        { id: companyId, name: companyName, phone: null, latitude: null, longitude: null },
        "prep-visit"
      ),
      createdAt: new Date().toISOString(),
    },
    memoryPatch: {
      lastCompanyId: companyId,
      lastCompanyName: companyName,
      selectedClientId: companyId,
      selectedClientName: companyName,
      conversationGoal: "briefing",
    },
    sessionState: "confirming",
  };
}

function handleEndConversation(): JoyChatResponse {
  return {
    message: assistantMessage(
      "Sessione chiusa. Quando vuoi riprendere, apri Joy o attiva di nuovo la **Modalità Conversazione**."
    ),
    sessionState: "completed",
  };
}

async function handleCommercialProposalsIntent(
  userId: string | null,
  context: JoyChatContext = {}
): Promise<JoyChatResponse> {
  const {
    buildUnifiedCommercialProposals,
    formatCommercialProposals,
  } = await import("./joy-commercial-proposals.service");
  const proposals = await buildUnifiedCommercialProposals({
    userId,
    latitude: context.latitude ?? null,
    longitude: context.longitude ?? null,
    limit: 10,
  });
  if (proposals.length === 0) {
    return {
      message: assistantMessage(
        "Al momento non ho proposte urgenti dai dati CRM. Puoi chiedermi «Prepara la mia giornata» o «Organizza il giro visite».",
        {
          actions: [
            buildPageAction("agenda", "Agenda", "/agenda"),
            buildPageAction("giro-visite", "Giro Visite", "/giro-visite"),
          ],
        }
      ),
      memoryPatch: { conversationGoal: "coach" },
      sessionState: "proposing",
    };
  }

  return {
    message: assistantMessage(formatCommercialProposals(proposals), {
      actions: dedupeActions([
        buildPageAction("follow-ups", "Follow-up", "/activities"),
        buildPageAction("preventivi", "Preventivi", "/preventivi"),
        buildPageAction("campioni", "Campioni", "/campioni"),
        buildPageAction("giro-visite", "Giro Visite", "/giro-visite"),
        ...proposals
          .filter((item) => item.companyId)
          .slice(0, 4)
          .flatMap((item) =>
            buildCompanyChatActions(
              {
                id: item.companyId!,
                name: item.companyName ?? "Azienda",
                phone: null,
                latitude: null,
                longitude: null,
              },
              `prop-${item.companyId}`
            ).slice(0, 2)
          ),
      ]).slice(0, 16),
    }),
    memoryPatch: { conversationGoal: "coach" },
    sessionState: "proposing",
  };
}

async function handleCommercialCoachIntent(
  userId: string | null
): Promise<JoyChatResponse> {
  const coaching = await runJoyOsCoach({
    userId,
    includeLearning: true,
    limit: 8,
  });
  return {
    message: assistantMessage(coaching.summaryText, {
      actions: [
        buildJoyPromptAction("callbacks", "Chi richiamare", "Chi devo richiamare?"),
        buildJoyPromptAction("tour", "Organizza giro", "Organizza il mio giro visite per oggi"),
        buildJoyPromptAction("risk", "Chi rischio di perdere", "Chi rischio di perdere?"),
      ],
    }),
    memoryPatch: { conversationGoal: "coach" },
    sessionState: "proposing",
  };
}

async function handleAgentLearningIntent(
  userId: string | null
): Promise<JoyChatResponse> {
  const learning = await runJoyOsLearning(userId);
  return {
    message: assistantMessage(learning.summaryText, {
      actions: [
        buildPageAction("statistiche", "Statistiche", "/statistiche"),
        buildPageAction("pipeline", "Pipeline", "/pipeline"),
        buildPageAction("joy-ai", "Joy AI", "/joy-ai"),
      ],
    }),
    memoryPatch: { conversationGoal: "coach" },
    sessionState: "proposing",
  };
}

async function handleCommercialStrategyIntent(
  intent: Extract<JoyIntent, { type: "commercial_strategy" }>,
  userId: string | null
): Promise<JoyChatResponse> {
  const { text } = await runJoyOsStrategy(
    {
      focus: intent.focus,
      productFamily: intent.productFamily,
      zone: intent.zone,
      amount: intent.amount,
      period: intent.period,
    },
    userId
  );
  return {
    message: assistantMessage(text, {
      actions: [
        buildJoyPromptAction(
          "tour-strategy",
          "Organizza giro",
          intent.productFamily
            ? `Organizza il mio giro visite per oggi focus ${intent.productFamily}`
            : "Organizza il mio giro visite per oggi"
        ),
        buildJoyPromptAction("sell-more", "Piano vendite oggi", "Come vendiamo di più oggi?"),
        buildJoyPromptAction("free-time", "Riempi tempo libero", "Ho due ore libere"),
      ],
    }),
    memoryPatch: {
      conversationGoal: "coach",
      salesGoalAmount: intent.amount ?? undefined,
      salesGoalPeriod: intent.period ?? undefined,
    },
    sessionState: "proposing",
  };
}

async function handleSellMoreTodayIntent(
  userId: string | null,
  context: JoyChatContext
): Promise<JoyChatResponse> {
  const plan = await runJoyOsSellMoreToday({
    userId,
    latitude: context.latitude,
    longitude: context.longitude,
  });
  return {
    message: assistantMessage(plan.narrative, {
      actions: [
        buildJoyPromptAction(
          "tour",
          "Organizza giro",
          "Organizza il mio giro visite per oggi"
        ),
        buildJoyPromptAction("radar", "Radar commerciale", "Radar commerciale"),
        buildJoyPromptAction("callbacks", "Chi richiamare", "Chi devo richiamare?"),
      ],
    }),
    memoryPatch: { conversationGoal: "coach" },
    sessionState: "proposing",
  };
}

async function handleCommercialRadarIntent(
  userId: string | null,
  context: JoyChatContext
): Promise<JoyChatResponse> {
  const radar = await runJoyOsRadar({
    userId,
    latitude: context.latitude,
    longitude: context.longitude,
  });
  const discouraged = radar.proposals.find((d) => d.stance === "discourage");
  const extra =
    discouraged != null
      ? `\n\n${formatContradiction(buildContradictionFromDecision(discouraged)!)}`
      : "";
  return {
    message: assistantMessage(`${radar.summaryText}${extra}`, {
      actions: [
        buildPageAction("agenda", "Agenda", "/agenda"),
        buildPageAction("maps", "Mappa", "/maps"),
        buildPageAction("giro", "Giro Visite", "/giro-visite"),
      ],
    }),
    memoryPatch: { conversationGoal: "coach" },
    sessionState: "proposing",
  };
}

async function handleNextActionIntent(
  userId: string | null,
  context: JoyChatContext
): Promise<JoyChatResponse> {
  const reasoning = await runJoyOsReasoning({
    userId,
    latitude: context.latitude,
    longitude: context.longitude,
    companyId: context.companyId,
    memory: context.memory,
    trigger: "proactive_tick",
  });
  const prompt = buildRecommendedPrompt(reasoning.decisions);
  const top = reasoning.decisions.find((d) => d.stance !== "discourage");
  const lines = [
    "**Prossima azione consigliata**",
    "",
    reasoning.narrative,
    "",
    top
      ? [
          `Azione: «${top.action}»`,
          `Motivo: ${top.reason}`,
          `Dati usati: ${top.dataUsed.join(", ") || "n/d"}`,
          `Urgenza: ${top.urgency} · Confidenza: ${top.confidence}`,
          top.missingData.length > 0
            ? `Dati mancanti: ${top.missingData.join(", ")}`
            : null,
          top.distanceKm != null ? `Distanza: ${top.distanceKm.toFixed(1)} km` : null,
          top.impactEstimate ?? null,
        ]
          .filter(Boolean)
          .join("\n")
      : `Prova: «${prompt}»`,
    "",
    "Nessun salvataggio automatico. Conferma ogni mutazione.",
  ];
  return {
    message: assistantMessage(lines.join("\n"), {
      actions: [
        buildPageAction(
          "next",
          prompt.slice(0, 36),
          "/joy-ai?q=" + encodeURIComponent(prompt)
        ),
        buildPageAction("drive", "Joy Drive", "/joy-ai/drive"),
      ],
    }),
    memoryPatch: { conversationGoal: "coach" },
    sessionState: "proposing",
  };
}

async function handleCommercialSimulationIntent(
  intent: Extract<JoyIntent, { type: "commercial_simulation" }>,
  userId: string | null
): Promise<JoyChatResponse> {
  const { text } = await runJoyOsSimulation(intent.scenario, userId);
  return {
    message: assistantMessage(text, {
      actions: [
        buildPageAction("pipeline", "Pipeline", "/pipeline"),
        buildPageAction("report", "Report", "/report-commerciale"),
        buildPageAction(
          "sell-today",
          "Vendere di più oggi",
          "/joy-ai?q=" + encodeURIComponent("Come vendiamo di più oggi?")
        ),
      ],
    }),
    memoryPatch: { conversationGoal: "coach" },
    sessionState: "proposing",
  };
}

async function handleOsUnknownFallback(
  userId: string | null,
  context: JoyChatContext
): Promise<JoyChatResponse> {
  const fallback = await buildJoyOsFallbackNarrative({
    userId,
    latitude: context.latitude,
    longitude: context.longitude,
    companyId: context.companyId,
    memory: context.memory,
    trigger: "proactive_tick",
  });
  return {
    message: assistantMessage(fallback.narrative, {
      actions: [
        buildPageAction(
          "os-next",
          fallback.recommendedPrompt.slice(0, 40),
          "/joy-ai?q=" + encodeURIComponent(fallback.recommendedPrompt)
        ),
        buildPageAction("coach", "Coach commerciale", "/joy-ai?q=" + encodeURIComponent("Coach commerciale")),
        buildPageAction("agenda", "Agenda", "/agenda"),
      ],
    }),
    memoryPatch: { conversationGoal: "coach" },
    sessionState: "proposing",
  };
}

function isSuccessfulTourProposal(response: JoyChatResponse): boolean {
  const stopCount = response.message.items?.length ?? 0;
  const draftPhase = response.memoryPatch?.tourDraft?.phase;
  return stopCount >= 1 && draftPhase === "proposed";
}

function buildEmptyDayTourRequest(context: JoyChatContext): JoyTourPlanRequest {
  const lat = context.latitude ?? context.memory?.lastLat ?? null;
  const lng = context.longitude ?? context.memory?.lastLng ?? null;
  const hasGps =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const lastComune = context.memory?.lastComune?.trim() || null;
  const lastCap = context.memory?.lastCap?.trim() || null;

  return {
    day: "today",
    city: hasGps ? null : lastComune,
    cap: hasGps ? null : lastCap,
    province: null,
    zoneMode: hasGps ? "gps" : lastCap ? "cap" : lastComune ? "city" : null,
    radiusKm: 40,
    centerLat: hasGps ? lat : null,
    centerLng: hasGps ? lng : null,
    segment: null,
    commercialStatus: null,
    audience: "entrambi",
    maxStops: 5,
    maxArrivalTime: "18:00",
    startMode: hasGps ? "gps" : "sede",
    startCity: null,
    endCity: null,
    forceIncludeCompanyIds: [],
    rawText: "Inizia la giornata",
    provided: {
      day: true,
      zone: true,
      audience: true,
      maxStops: true,
      maxArrivalTime: true,
      startMode: true,
    },
  };
}

/**
 * Empty agenda / start-day: propose 3–5 visits via tour planner (confirm/modify/regenerate),
 * with free-time radar + sell-more fallbacks. Never invent data; never auto-save.
 */
async function proposeEmptyDayOperationalPlan(
  userId: string | null,
  context: JoyChatContext
): Promise<JoyChatResponse> {
  const salutation = resolveMorningSalutation();
  const lat = context.latitude ?? context.memory?.lastLat ?? null;
  const lng = context.longitude ?? context.memory?.lastLng ?? null;
  const tourContext = {
    userId,
    memory: context.memory,
    latitude: lat,
    longitude: lng,
  };

  const primaryTour = await proposeJoyTourPlan(
    buildEmptyDayTourRequest(context),
    tourContext
  );

  if (isSuccessfulTourProposal(primaryTour)) {
    return {
      ...primaryTour,
      message: {
        ...primaryTour.message,
        content: [
          `${salutation} Oggi non hai visite in agenda — propongo un giro operativo dai dati CRM (aziende, follow-up, opportunità, priorità, distanze).`,
          "",
          primaryTour.message.content,
        ].join("\n"),
      },
      memoryPatch: {
        ...primaryTour.memoryPatch,
        conversationGoal: "morning_plan",
      },
      sessionState: "proposing",
    };
  }

  const { buildFreeTimeFill } = await import("./joy-free-time-radar.service");
  const fill = await buildFreeTimeFill({
    userId,
    freeMinutes: 480,
    latitude: lat,
    longitude: lng,
  });

  const forceInclude = [
    ...new Set(
      fill.items
        .map((item) => item.companyId)
        .filter((id): id is string => Boolean(id))
    ),
  ].slice(0, 5);

  if (forceInclude.length > 0) {
    const forcedRequest: JoyTourPlanRequest = {
      ...buildEmptyDayTourRequest(context),
      maxStops: Math.min(5, Math.max(3, forceInclude.length)),
      forceIncludeCompanyIds: forceInclude,
      rawText: "Inizia la giornata — priorità radar",
    };
    const forcedTour = await proposeJoyTourPlan(forcedRequest, tourContext);
    if (isSuccessfulTourProposal(forcedTour)) {
      return {
        ...forcedTour,
        message: {
          ...forcedTour.message,
          content: [
            `${salutation} Agenda libera — ho selezionato ${forceInclude.length} priorità dal radar commerciale e preparato una proposta giro (non salvata).`,
            "",
            forcedTour.message.content,
          ].join("\n"),
        },
        memoryPatch: {
          ...forcedTour.memoryPatch,
          conversationGoal: "morning_plan",
        },
        sessionState: "proposing",
      };
    }

    const visitItems = fill.items.filter((item) => item.companyId).slice(0, 5);
    const lines = visitItems.map(
      (item, index) =>
        `${index + 1}. **${item.companyName ?? "Azienda"}** (~${item.estimatedMinutes} min) — ${item.reason}${
          item.distanceKm != null ? ` · ${item.distanceKm} km` : ""
        }`
    );

    return {
      message: assistantMessage(
        [
          `${salutation} Agenda libera — **${visitItems.length} visite consigliate** dai dati CRM:`,
          "",
          lines.join("\n"),
          "",
          "Conferma per organizzare il giro, oppure modifica/rigenera. Nessun salvataggio automatico.",
        ].join("\n"),
        {
          items: visitItems.map((item) => ({
            id: item.companyId!,
            title: item.companyName ?? "Azienda",
            subtitle: item.reason,
          })),
          actions: [
            buildJoyPromptAction(
              "confirm-tour",
              "Conferma giro",
              "Organizza il mio giro visite per oggi max 5 visite"
            ),
            buildJoyPromptAction("modify-tour", "Modifica", "Modifica il giro: "),
            buildJoyPromptAction("regen-tour", "Rigenera", "Inizia la giornata"),
            buildJoyPromptAction("sell-more", "Piano vendite", "Come vendiamo di più oggi?"),
          ],
        }
      ),
      memoryPatch: { conversationGoal: "morning_plan" },
      sessionState: "proposing",
    };
  }

  const sellMore = await runJoyOsSellMoreToday({
    userId,
    latitude: lat,
    longitude: lng,
  });

  if (sellMore.dataQuality !== "insufficient" && sellMore.topActions.length > 0) {
    const visitActions = sellMore.topActions.slice(0, 5);
    return {
      message: assistantMessage(
        [
          `${salutation} Agenda libera — propongo leve commerciali dai dati CRM:`,
          "",
          ...visitActions.map(
            (decision, index) =>
              `${index + 1}. **${decision.title}** → «${decision.action}»\n   Motivo: ${decision.reason}`
          ),
          "",
          "Conferma organizzando il giro, oppure modifica/rigenera. Nessun salvataggio automatico.",
        ].join("\n"),
        {
          items: visitActions.map((decision) => ({
            id: decision.id,
            title: decision.title,
            subtitle: decision.reason,
          })),
          actions: [
            buildJoyPromptAction(
              "confirm-tour",
              "Conferma giro",
              "Organizza il mio giro visite per oggi max 5 visite"
            ),
            buildJoyPromptAction("modify-tour", "Modifica", "Modifica il giro: "),
            buildJoyPromptAction("regen-tour", "Rigenera", "Inizia la giornata"),
            buildJoyPromptAction("sell-more", "Dettaglio piano", "Come vendiamo di più oggi?"),
          ],
        }
      ),
      memoryPatch: { conversationGoal: "morning_plan" },
      sessionState: "proposing",
    };
  }

  return {
    message: assistantMessage(
      [
        `${salutation} Oggi non hai visite in agenda e non ho abbastanza dati CRM geolocalizzati/prioritari per proporti un giro.`,
        "",
        JOY_INSUFFICIENT_DATA_MESSAGE,
        "",
        "Aggiungi aziende con coordinate, follow-up o opportunità, poi riprova «Inizia la giornata».",
      ].join("\n"),
      {
        actions: [
          buildPageAction("companies", "Aziende", "/companies"),
          buildPageAction("agenda", "Agenda", "/agenda"),
          buildJoyPromptAction("coach", "Coach commerciale", "Coach commerciale"),
        ],
      }
    ),
    sessionState: "completed",
  };
}

async function handleMorningSuggestions(
  userId: string | null,
  context: JoyChatContext
): Promise<JoyChatResponse> {
  const [briefing, proposals, quotesMetrics] = await Promise.all([
    getDailyBriefing({ userId, companyId: context.companyId ?? undefined }),
    buildCommercialProposals(userId, {
      latitude: context.latitude,
      longitude: context.longitude,
    }),
    getQuotesDashboardMetrics(),
  ]);

  const visitsToday =
    briefing.data?.statistics?.visitsToday ??
    briefing.data?.visitsToday.length ??
    0;
  const overdueFollowUps =
    briefing.data?.statistics?.overdueFollowUps ??
    briefing.data?.overdueFollowUps.length ??
    0;
  const quotesToFollow = quotesMetrics.data?.sent ?? 0;
  const nearbyProspects =
    briefing.data?.statistics?.radarHits ??
    briefing.data?.suggestions.length ??
    0;

  // Empty day: auto-propose operational tour (not empty calendar state).
  if (visitsToday === 0) {
    return proposeEmptyDayOperationalPlan(userId, context);
  }

  const salutation = resolveMorningSalutation();
  const lines: string[] = [
    `${salutation} Hai:`,
    `• **${visitsToday}** visite oggi`,
    `• **${overdueFollowUps}** follow-up scaduti`,
    `• **${quotesToFollow}** preventivi da seguire`,
    `• **${nearbyProspects}** prospect vicini.`,
    "",
    "Vuoi ottimizzare il giro o riempire eventuali buchi?",
  ];

  if (briefing.hasData && briefing.data?.suggestions.length) {
    lines.push(
      "",
      "**Priorità suggerite:**",
      ...briefing.data.suggestions.slice(0, 3).map(
        (item) =>
          `• ${item.companyName}${item.city ? ` (${item.city})` : ""} — ${item.reason}`
      )
    );
  }

  if (proposals.length > 0) {
    lines.push("", ...proposals.slice(0, 3).map((item) => `• ${item}`));
  }

  lines.push(
    "",
    "Dimmi ad esempio: «Organizza giro oggi max 5 visite entro le 17:00» oppure «Ho due ore libere»."
  );

  return {
    message: assistantMessage(lines.join("\n"), {
      actions: [
        buildJoyPromptAction(
          "tour",
          "Organizza giro",
          "Organizza il mio giro visite per oggi max 5 visite"
        ),
        buildJoyPromptAction("free-time", "Riempi tempo libero", "Ho due ore libere"),
        buildPageAction("agenda", "Agenda", "/agenda"),
        buildPageAction("activities", "Follow-up", "/activities?section=followups"),
      ],
    }),
    sessionState: "proposing",
  };
}

function resolveMorningSalutation(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Buongiorno.";
  }
  if (hour < 18) {
    return "Buon pomeriggio.";
  }
  return "Buonasera.";
}

async function handlePlanTourIntent(
  raw: string,
  userId: string | null,
  context: JoyChatContext
): Promise<JoyChatResponse> {
  const response = await processJoyTourPlanning(raw, {
    userId,
    memory: context.memory,
    latitude: context.latitude,
    longitude: context.longitude,
  });

  if (response) {
    return response;
  }

  const request = parseJoyTourPlanRequest(raw, {
    lastComune: context.memory?.lastComune,
    lastCap: context.memory?.lastCap,
    lastDestinazione: context.memory?.lastDestinazione,
    tourDraft: context.memory?.tourDraft,
  });

  if (!request) {
    return {
      message: assistantMessage(
        "Organizziamo il giro insieme. Di' «Organizza il mio giro» oppure specifica giorno, CAP/città e vincoli.",
        { actions: [buildPageAction("giro-visite", "Giro Visite", "/giro-visite")] }
      ),
    };
  }

  return proposeJoyTourPlan(request, {
    userId,
    memory: context.memory,
    latitude: context.latitude,
    longitude: context.longitude,
  });
}

function handleUnknown(): JoyChatResponse {
  return {
    message: assistantMessage(
      "Non ho capito bene la richiesta. Prova a riformularla oppure chiedi aiuto con esempi concreti (visite oggi, clienti inattivi, opportunità, VEPA, giro visite, apertura azienda).",
      { actions: [buildPageAction("help-joy", "Esempi", "/joy/chat")] }
    ),
  };
}

async function dispatchIntent(
  intent: JoyIntent,
  userId: string | null,
  context: JoyChatContext = {}
): Promise<JoyChatResponse> {
  switch (intent.type) {
    case "daily_briefing":
      return handleDailyBriefing(userId, context);
    case "daily_plan":
      return handleDailyPlan(userId, context);
    case "end_of_day_summary":
      return handleEndOfDaySummary(userId, context);
    case "weekly_briefing":
      return handleWeeklyBriefing(userId, context);
    case "company_briefing":
      return handleCompanyBriefing(context, intent.query, userId);
    case "company_timeline":
      return handleCompanyTimeline(context, intent.query);
    case "visits_today":
      return handleVisitsToday(userId);
    case "inactive_clients":
      return handleInactiveClients(intent.days, userId);
    case "opportunities_min_amount":
      return handleOpportunitiesMinAmount(intent.amount, userId);
    case "opportunities_summary":
      return handleOpportunitiesSummary(context);
    case "stale_opportunities":
      return handleStaleOpportunities(context);
    case "product_interest":
      return handleProductInterest(intent.family);
    case "optimize_tour":
      return handleOptimizeTour(userId);
    case "optimize_tour_tomorrow":
      return handleOptimizeTourTomorrow(userId);
    case "nearby_city":
      return intent.city ? handleNearbyCity(intent.city, userId) : handleUnknown();
    case "nearby_user":
      return handleNearbyUser(context, userId);
    case "open_company":
      return handleOpenCompany(intent.query, userId);
    case "follow_ups":
      return handleFollowUps(context);
    case "follow_ups_overdue":
      return handleFollowUpsOverdue(context);
    case "agenda_today":
      return handleAgendaToday(userId, context);
    case "agenda_tomorrow":
      return handleAgendaTomorrow(userId);
    case "radar":
      return handleRadar(userId, context);
    case "commercial_radar":
      return handleCommercialRadarIntent(userId, context);
    case "sell_more_today":
      return handleSellMoreTodayIntent(userId, context);
    case "next_action":
      return handleNextActionIntent(userId, context);
    case "commercial_simulation":
      return handleCommercialSimulationIntent(intent, userId);
    case "free_time_fill":
      return handleFreeTimeFillIntent(intent.freeMinutes, userId, context);
    case "sales_goal":
      return handleSalesGoalIntent(intent.amount, intent.period, userId, context);
    case "prepare_action":
      return handlePrepareActionIntent(intent.action, intent.query, userId, context);
    case "calendar_status":
      return handleCalendarStatus();
    case "pipeline_summary":
      return handlePipelineSummary();
    case "orders_summary":
      return handleOrdersSummary(context);
    case "quotes_summary":
      return handleQuotesSummary(context);
    case "product_catalog":
      return handleProductCatalog();
    case "samples_summary":
      return handleSamplesSummary();
    case "samples_to_recover":
      return handleSamplesToRecover(context);
    case "service_summary":
      return handleServiceSummary();
    case "open_service_tickets":
      return handleOpenServiceTickets(context);
    case "documents_summary":
      return handleDocumentsSummary();
    case "contacts_summary":
      return handleContactsSummary(context);
    case "prospect_by_city":
      return handleProspectByCity(intent.city, userId);
    case "companies_by_city":
      return handleCompaniesByCity(intent.city, userId);
    case "high_priority":
      return handleHighPriority();
    case "missing_email":
      return handleMissingEmail(userId);
    case "visits_this_week":
      return handleVisitsThisWeek(userId);
    case "statistics":
      return handleStatistics();
    case "commercial_statistics":
      return handleCommercialStatistics(context);
    case "visit_tours":
      return handleVisitTours(userId);
    case "help":
      return handleHelp();
    case "detail_expand": {
      const full = context.memory?.lastFullAssistantContent?.trim();
      if (full) {
        return {
          message: assistantMessage(full),
          sessionState: "proposing",
        };
      }
      return {
        message: assistantMessage(
          "Non ho una risposta precedente da approfondire. Fai una domanda commerciale e poi di' «dettaglio»."
        ),
        sessionState: "proposing",
      };
    }
    case "end_conversation":
      return handleEndConversation();
    case "commercial_proposals":
      return handleCommercialProposalsIntent(userId, context);
    case "commercial_coach":
      return handleCommercialCoachIntent(userId);
    case "agent_learning":
      return handleAgentLearningIntent(userId);
    case "commercial_strategy":
      return handleCommercialStrategyIntent(intent, userId);
    case "morning_suggestions":
      return handleMorningSuggestions(userId, context);
    case "plan_tour":
      return handlePlanTourIntent(intent.raw, userId, context);
    case "debrief":
      return (
        (await processJoyDebrief(intent.raw, context.memory ?? {}, context.companyId)) ??
        handleUnknown()
      );
    default:
      return handleUnknown();
  }
}

async function handleCompanyContext(context: JoyChatContext): Promise<JoyChatResponse | null> {
  const companyId = context.companyId?.trim();
  if (!companyId) {
    return null;
  }

  const briefing = await getCompanyBriefing(companyId);
  if (briefing.hasData && briefing.data) {
    const data = briefing.data;
    return {
      message: assistantMessage(
        `${data.summaryText}\n\n**Contesto azienda attivo** — chiedimi visite, contatti, preventivi, ordini o azioni su questa azienda.`,
        {
          actions: buildCompanyChatActions(
            {
              id: data.companyId,
              name: data.companyName,
              phone: data.phone,
              latitude: null,
              longitude: null,
            },
            "context"
          ),
        }
      ),
    };
  }

  const result = await getCompanyById(companyId);
  if (!result.hasData || !result.data) {
    return {
      message: assistantMessage(
        "Non riesco a caricare i dati dell'azienda selezionata. Verifica che la scheda sia ancora disponibile.",
        { actions: [buildPageAction("companies", "Vai alle aziende", "/companies")] }
      ),
    };
  }

  const company = result.data;
  const location = [company.city, company.province].filter(Boolean).join(", ");
  const phone = resolvePhone(company);

  return {
    message: assistantMessage(
      `Stai consultando **${company.name}**${location ? ` (${location})` : ""}. Ultima visita: ${formatLastVisitLabel(company.last_visit_at)}.\n\n**Contesto azienda attivo** — chiedimi visite, contatti, preventivi, ordini o azioni su questa azienda.`,
      {
        actions: buildCompanyChatActions(
          {
            id: company.id,
            name: company.name,
            phone,
            latitude: company.latitude,
            longitude: company.longitude,
          },
          "context"
        ),
      }
    ),
  };
}

async function handleCompanyBriefing(
  context: JoyChatContext,
  query?: string | null,
  userId?: string | null
): Promise<JoyChatResponse> {
  let companyId = context.companyId?.trim() || null;

  if (!companyId && query?.trim()) {
    const search = await searchCompanies({
      query: query.trim(),
      limit: 5,
      userId: userId ?? undefined,
    });
    const rows = search.data?.rows ?? [];
    if (!search.hasData || rows.length === 0) {
      return {
        message: assistantMessage(
          `Non ho trovato l'azienda "${query}". Specifica meglio il nome oppure apri Joy dalla scheda azienda.`
        ),
      };
    }
    if (rows.length > 1) {
      const lines = rows.map((item) => `• **${item.name}**`);
      return {
        message: assistantMessage(
          `Ho trovato più aziende per "${query}":\n\n${lines.join("\n")}\n\nRiformula con il nome esatto.`
        ),
      };
    }
    companyId = rows[0].id;
  }

  if (!companyId) {
    return {
      message: assistantMessage(
        "Per il briefing azienda indicami il cliente, oppure apri Joy AI dalla scheda azienda."
      ),
    };
  }

  const briefing = await getCompanyBriefing(companyId);
  if (!briefing.hasData || !briefing.data) {
    return {
      message: assistantMessage(
        briefing.error ?? JOY_INSUFFICIENT_DATA_MESSAGE,
        { actions: [buildPageAction("company", "Apri scheda", `/companies/${companyId}`)] }
      ),
    };
  }

  const data = briefing.data;
  return {
    message: assistantMessage(data.summaryText, {
      actions: buildCompanyChatActions(
        {
          id: data.companyId,
          name: data.companyName,
          phone: data.phone,
          latitude: null,
          longitude: null,
        },
        "briefing"
      ),
    }),
  };
}

export async function processJoyChatMessage(
  userMessage: string,
  context: JoyChatContext = {}
): Promise<JoyChatResponse> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    return { message: assistantMessage("Scrivi una domanda per iniziare.") };
  }

  const memoryHints = extractMemoryHintsFromUserText(trimmed);
  const mergedMemory: JoyConversationMemory = {
    ...(context.memory ?? {}),
    ...memoryHints,
  };
  const enrichedContext: JoyChatContext = {
    ...context,
    memory: mergedMemory,
    companyId:
      context.companyId?.trim() ||
      mergedMemory.selectedClientId ||
      mergedMemory.lastCompanyId ||
      null,
  };

  const debriefResponse = await processJoyDebrief(
    trimmed,
    mergedMemory,
    enrichedContext.companyId
  );
  if (debriefResponse) {
    return {
      ...debriefResponse,
      memoryPatch: {
        ...memoryHints,
        lastCompanyId:
          debriefResponse.message.pendingAction &&
          "companyId" in debriefResponse.message.pendingAction.operation
            ? debriefResponse.message.pendingAction.operation.companyId
            : undefined,
        lastCompanyName:
          debriefResponse.message.pendingAction &&
          "companyName" in debriefResponse.message.pendingAction.operation
            ? debriefResponse.message.pendingAction.operation.companyName
            : undefined,
        selectedClientId:
          debriefResponse.message.pendingAction &&
          "companyId" in debriefResponse.message.pendingAction.operation
            ? debriefResponse.message.pendingAction.operation.companyId
            : undefined,
        selectedClientName:
          debriefResponse.message.pendingAction &&
          "companyName" in debriefResponse.message.pendingAction.operation
            ? debriefResponse.message.pendingAction.operation.companyName
            : undefined,
      },
      sessionState: debriefResponse.message.pendingAction ? "confirming" : "proposing",
    };
  }

  // Giro intelligente (intake Q&A + proposta + comandi runtime) prima del Copilot navigate.
  {
    const tourUser = await getCurrentUser();
    const tourResponse = await processJoyTourPlanning(trimmed, {
      userId: tourUser?.id ?? null,
      memory: mergedMemory,
      latitude: enrichedContext.latitude,
      longitude: enrichedContext.longitude,
    });
    if (tourResponse) {
      return {
        ...tourResponse,
        memoryPatch: { ...memoryHints, ...tourResponse.memoryPatch },
      };
    }
  }

  const copilotResponse = await processJoyCopilotCommand(trimmed, {
    companyId: enrichedContext.companyId,
    memory: mergedMemory,
  });
  if (copilotResponse) {
    return {
      ...copilotResponse,
      memoryPatch: memoryHints,
      sessionState: copilotResponse.message.pendingAction ? "confirming" : "proposing",
    };
  }

  const user = await getCurrentUser();
  const intent = parseJoyIntent(trimmed);

  if (intent.type === "unknown" && context.autoBriefing && context.companyId?.trim()) {
    const briefing = await handleCompanyBriefing(enrichedContext, null);
    return {
      ...briefing,
      memoryPatch: {
        ...memoryHints,
        lastCompanyId: context.companyId,
        selectedClientId: context.companyId,
      },
      sessionState: "proposing",
    };
  }

  if (intent.type === "unknown") {
    const companyContextResponse = await handleCompanyContext(enrichedContext);
    if (companyContextResponse) {
      return {
        ...companyContextResponse,
        memoryPatch: memoryHints,
        sessionState: "proposing",
      };
    }

    // Joy OS: never ask "Cosa vuoi fare?" — propose from CRM observation
    const osFallback = await handleOsUnknownFallback(user?.id ?? null, enrichedContext);
    return {
      ...osFallback,
      memoryPatch: { ...memoryHints, ...(osFallback.memoryPatch ?? {}) },
    };
  }

  const dispatched = await dispatchIntent(intent, user?.id ?? null, enrichedContext);
  const shortMode = enrichedContext.driveMode || enrichedContext.guideMode;
  const maxLen = enrichedContext.driveMode ? 320 : 480;
  const keepLen = enrichedContext.driveMode ? 300 : 460;
  const shortHint = enrichedContext.driveMode
    ? "_(Joy Drive: dettagli sullo schermo. Chiedi «dettaglio» per approfondire.)_"
    : "_(Modalità Guida: chiedi «dettaglio» per approfondire.)_";
  const fullContent = dispatched.message.content;
  const withGuide =
    shortMode && fullContent.length > maxLen
      ? {
          ...dispatched,
          message: {
            ...dispatched.message,
            content: `${fullContent.slice(0, keepLen).trim()}…\n\n${shortHint}`,
          },
        }
      : dispatched;
  return {
    ...withGuide,
    memoryPatch: {
      ...memoryHints,
      ...(withGuide.memoryPatch ?? {}),
      lastFullAssistantContent: fullContent,
    },
    sessionState:
      withGuide.sessionState ??
      (withGuide.message.pendingAction ? "confirming" : undefined),
  };
}
