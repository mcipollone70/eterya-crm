import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { listFollowUps } from "@/features/activities/services/follow-ups.service";
import { listAgendaItems } from "@/features/agenda/services/agenda.service";
import { getDailyVisitSuggestions } from "@/features/assistant/services/assistant-suggestions.service";
import { getGoogleCalendarConnectionView } from "@/features/calendar-sync/services/connection.service";
import { listContacts } from "@/features/contacts/services/contacts.service";
import { listOpportunities } from "@/features/opportunities/services/opportunities.service";
import { resolveCompanyIdsForProductFilters } from "@/features/products/services/company-product-interests.service";
import { analyzeOpportunityRadar } from "@/features/radar/services/opportunity-radar.service";
import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { escapeIlikePattern } from "@/features/search/utils/escape-ilike";
import { listVisits } from "@/features/visits/services/visits.service";
import { formatDistanceKm, getDistanceKm } from "@/features/maps/utils/geo-distance";
import { AGENDA_KIND_LABELS, parseAgendaFilters } from "@/lib/constants/agenda";
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
  buildPageAction,
} from "../utils/joy-chat-action-builders";
import { parseJoyIntent, type JoyIntent } from "../utils/parse-joy-intent";
import { processJoyCopilotCommand } from "./joy-copilot.service";

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

async function searchCompaniesByName(query: string, limit = 5): Promise<CompanyRow[]> {
  const pattern = escapeIlikePattern(query);
  if (!pattern) {
    return [];
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("companies")
    .select(
      "id,name,city,province,phone,contact_phone,mobile,latitude,longitude,last_visit_at"
    )
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(limit);

  return (data ?? []) as CompanyRow[];
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
  const { data: visits, error } = await listVisits({ period: "today", limit: 50 });
  if (error) {
    return { message: assistantMessage(`Non riesco a leggere le visite: ${error}`), error };
  }

  const openVisits = (visits ?? []).filter(
    (visit) => visit.status === "scheduled" || visit.status === "in_progress"
  );
  const completedToday = (visits ?? []).filter((visit) => visit.status === "completed");

  if (openVisits.length === 0 && completedToday.length === 0) {
    const suggestions = await getDailyVisitSuggestions({ limit: 5, agentId: userId });
    const items: JoyChatListItem[] = (suggestions.data ?? []).map((item) => ({
      id: item.companyId,
      title: item.companyName,
      subtitle: [item.city, item.province].filter(Boolean).join(" · ") || "Suggerimento Joy",
    }));

    return {
      message: assistantMessage(
        "Non hai visite pianificate per oggi. Ecco i clienti che Joy ti consiglia di visitare:",
        {
          items,
          actions: [
            buildPageAction("visits-today", "Vedi tutte le visite", "/visits"),
            buildPageAction("assistant", "Suggerimenti assistente", "/assistant"),
          ],
        }
      ),
    };
  }

  const companyIds = [...new Set(openVisits.map((visit) => visit.company_id))];
  const companies = await fetchCompaniesByIds(companyIds);
  const companyMap = new Map(companies.map((row) => [row.id, row]));

  const lines: string[] = [];
  const items: JoyChatListItem[] = [];
  const actions: JoyChatMessage["actions"] = [
    buildPageAction("visits-list", "Apri elenco visite", "/visits"),
    buildPageAction("auto-mode", "Modalità Auto", "/auto"),
  ];

  for (const visit of openVisits.slice(0, LIST_LIMIT)) {
    const company = companyMap.get(visit.company_id);
    const time = formatVisitDate(visit.scheduled_at);
    const location = [visit.company_city, visit.company_province].filter(Boolean).join(", ");
    lines.push(`• **${visit.company_name ?? "Azienda"}** — ${time}${location ? ` (${location})` : ""}`);
    items.push({
      id: visit.id,
      title: visit.company_name ?? "Azienda",
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
          `visit-${visit.id}`
        ).slice(0, 3)
      );
    }
  }

  if (completedToday.length > 0) {
    lines.push(`\nHai già completato ${completedToday.length} visita/e oggi.`);
  }

  return {
    message: assistantMessage(
      `Ecco le visite per oggi (${openVisits.length} da fare):\n\n${lines.join("\n")}`,
      { items, actions: dedupeActions(actions).slice(0, 18) }
    ),
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

async function handleInactiveClients(days: number): Promise<JoyChatResponse> {
  const threshold = thresholdIsoDaysAgo(days);
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id,name,city,province,phone,contact_phone,mobile,latitude,longitude,last_visit_at"
    )
    .or(`last_visit_at.is.null,last_visit_at.lt.${threshold}`)
    .order("last_visit_at", { ascending: true, nullsFirst: true })
    .limit(LIST_LIMIT);

  if (error) {
    return { message: assistantMessage(`Errore nella ricerca clienti inattivi: ${error.message}`) };
  }

  const rows = (data ?? []) as CompanyRow[];
  if (rows.length === 0) {
    return {
      message: assistantMessage(
        `Ottimo! Non ho trovato clienti senza visita da più di ${days} giorni.`,
        { actions: [buildPageAction("companies", "Vedi aziende", "/companies")] }
      ),
    };
  }

  const lines = rows.map(
    (row) =>
      `• **${row.name}** — ${formatLastVisitLabel(row.last_visit_at)}${row.city ? ` (${row.city})` : ""}`
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
      `Ho trovato ${rows.length} clienti senza visita da almeno ${days} giorni:\n\n${lines.join("\n")}`,
      {
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: formatLastVisitLabel(row.last_visit_at),
        })),
        actions: dedupeActions([
          buildPageAction("companies-inactive", "Filtra in elenco", "/companies?lastVisit=over_90"),
          ...actions,
        ]).slice(0, 16),
      }
    ),
  };
}

async function handleOpportunitiesMinAmount(amount: number): Promise<JoyChatResponse> {
  const { data, error } = await listOpportunities({ limit: 500 });
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
        `Non ci sono opportunità aperte sopra ${formatOpportunityAmount(amount)}.`,
        { actions: [buildPageAction("opportunities", "Vedi pipeline", "/opportunities")] }
      ),
    };
  }

  const total = matches.reduce((sum, item) => sum + item.total_amount, 0);
  const lines = matches.map(
    (item) =>
      `• **${item.company_name ?? item.title}** — ${formatOpportunityAmount(item.total_amount)} (${OPPORTUNITY_STAGE_LABELS[item.stage]})`
  );

  const actions = matches.flatMap((item) => {
    if (!item.company_id) {
      return [buildPageAction(`opp-${item.id}`, item.title, `/opportunities`)];
    }
    return buildCompanyChatActions(
      { id: item.company_id, name: item.company_name ?? item.title },
      `opp-${item.id}`
    ).slice(0, 2);
  });

  return {
    message: assistantMessage(
      `Hai ${matches.length} opportunità aperte sopra ${formatOpportunityAmount(amount)} per un totale di ${formatOpportunityAmount(total)}:\n\n${lines.join("\n")}`,
      {
        items: matches.map((item) => ({
          id: item.id,
          title: item.company_name ?? item.title,
          subtitle: formatOpportunityAmount(item.total_amount),
        })),
        actions: dedupeActions([
          buildPageAction("pipeline", "Apri opportunità", "/opportunities"),
          ...actions,
        ]).slice(0, 16),
      }
    ),
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
      message: assistantMessage(`Nessun cliente con interesse registrato per ${label}.`, {
        actions: [buildPageAction("products", "Vedi prodotti", "/products")],
      }),
    };
  }

  const rows = await fetchCompaniesByIds(companyIds);
  const lines = rows.map(
    (row) => `• **${row.name}**${row.city ? ` — ${row.city}` : ""}`
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
      `product-${row.id}`
    ).slice(0, 2)
  );

  return {
    message: assistantMessage(
      `Ho trovato ${companyIds.length} clienti con interesse per ${label}. Ecco i primi ${rows.length}:\n\n${lines.join("\n")}`,
      {
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.city ?? label,
        })),
        actions: dedupeActions([
          buildPageAction("companies-product", `Filtra ${label}`, `/companies?productFamily=${family}`),
          ...actions,
        ]).slice(0, 16),
      }
    ),
  };
}

async function handleOptimizeTour(userId: string | null): Promise<JoyChatResponse> {
  const [visitsResult, suggestionsResult] = await Promise.all([
    listVisits({ period: "today", limit: 30 }),
    getDailyVisitSuggestions({ limit: 8, agentId: userId }),
  ]);

  const scheduled = (visitsResult.data ?? []).filter(
    (visit) => visit.status === "scheduled" || visit.status === "in_progress"
  );
  const suggestions = suggestionsResult.data ?? [];

  if (scheduled.length === 0 && suggestions.length === 0) {
    return {
      message: assistantMessage(
        "Non ho visite o suggerimenti per organizzare un giro oggi. Pianifica qualche visita dall'agenda.",
        { actions: [buildPageAction("routes", "Giro visite", "/routes")] }
      ),
    };
  }

  const ordered = [...scheduled].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const lines: string[] = [];

  ordered.forEach((visit, index) => {
    lines.push(
      `${index + 1}. **${visit.company_name ?? "Azienda"}** — ${formatVisitDate(visit.scheduled_at)}`
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
    ...ordered.map((visit) => visit.company_id),
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
      `Ecco un giro ottimizzato per oggi:\n\n${lines.join("\n")}\n\nApri **Giro Visite** per calcolare il percorso su mappa.`,
      {
        actions: dedupeActions([
          buildPageAction("routes", "Apri Giro Visite", "/routes"),
          buildPageAction("maps", "Vedi su mappa", "/maps"),
          buildPageAction("auto", "Modalità Auto", "/auto"),
          ...actions,
        ]).slice(0, 14),
      }
    ),
  };
}

async function handleNearbyCity(city: string): Promise<JoyChatResponse> {
  const key = normalizeCityKey(city);
  const center = CITY_CENTERS[key];
  const supabase = await createServerClient();
  const pattern = escapeIlikePattern(city);

  let rows: Array<CompanyRow & { distanceKm?: number }> = [];

  if (pattern) {
    const { data: cityMatches } = await supabase
      .from("companies")
      .select(
        "id,name,city,province,phone,contact_phone,mobile,latitude,longitude,last_visit_at"
      )
      .ilike("city", pattern)
      .limit(40);

    rows = (cityMatches ?? []) as CompanyRow[];

    if (center?.province) {
      const { data: provinceMatches } = await supabase
        .from("companies")
        .select(
          "id,name,city,province,phone,contact_phone,mobile,latitude,longitude,last_visit_at"
        )
        .ilike("province", `%${center.province}%`)
        .limit(40);

      const merged = new Map(rows.map((row) => [row.id, row]));
      for (const row of (provinceMatches ?? []) as CompanyRow[]) {
        merged.set(row.id, row);
      }
      rows = [...merged.values()];
    }
  }

  if (center) {
    const { data: geoCompanies } = await supabase
      .from("companies")
      .select(
        "id,name,city,province,phone,contact_phone,mobile,latitude,longitude,last_visit_at"
      )
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(300);

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

async function handleOpenCompany(query: string): Promise<JoyChatResponse> {
  const rows = await searchCompaniesByName(query, 5);
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
    return {
      message: assistantMessage(
        `Ecco **${company.name}**${location ? ` (${location})` : ""}. Ultima visita: ${formatLastVisitLabel(company.last_visit_at)}.`,
        {
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
        }
      ),
    };
  }

  const lines = rows.map((row) => `• **${row.name}**${row.city ? ` — ${row.city}` : ""}`);
  const actions = rows.map((row) =>
    buildPageAction(`open-${row.id}`, `Apri ${row.name}`, `/companies/${row.id}`)
  );

  return {
    message: assistantMessage(
      `Ho trovato ${rows.length} aziende simili a "${query}":\n\n${lines.join("\n")}`,
      {
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.city ?? undefined,
        })),
        actions,
      }
    ),
  };
}

async function handleFollowUpsOverdue(): Promise<JoyChatResponse> {
  const { data, error } = await listFollowUps({ period: "overdue", limit: LIST_LIMIT });
  if (error) {
    return { message: assistantMessage(`Errore follow-up: ${error}`) };
  }

  const items = data ?? [];
  if (items.length === 0) {
    return {
      message: assistantMessage("Nessun follow-up in ritardo. Ottimo lavoro!", {
        actions: [buildPageAction("activities", "Vedi attività", "/activities?section=followups")],
      }),
    };
  }

  const lines = items.map(
    (item) =>
      `• **${item.company_name ?? "Azienda"}** — ${formatVisitDate(item.scheduled_at)} (${item.priority})`
  );

  const actions = items.flatMap((item) => {
    if (!item.company_id) {
      return [];
    }
    return buildCompanyChatActions(
      { id: item.company_id, name: item.company_name ?? "Azienda" },
      `fu-${item.id}`
    ).filter((action) => action.kind === "follow_up" || action.kind === "open_company");
  });

  return {
    message: assistantMessage(
      `Hai ${items.length} follow-up in ritardo:\n\n${lines.join("\n")}`,
      {
        actions: dedupeActions([
          buildPageAction("followups", "Apri follow-up", "/activities?section=followups"),
          ...actions,
        ]).slice(0, 14),
      }
    ),
  };
}

async function handleAgendaToday(userId: string | null): Promise<JoyChatResponse> {
  const now = new Date();
  const { data, error } = await listAgendaItems(
    parseAgendaFilters({
      view: "day",
      date: now.toISOString().slice(0, 10),
      agent: userId ?? undefined,
      status: "open",
    })
  );

  if (error) {
    return { message: assistantMessage(`Errore agenda: ${error}`) };
  }

  const upcoming = (data ?? []).filter(
    (item) => new Date(item.scheduledAt).getTime() >= now.getTime()
  );

  if (upcoming.length === 0) {
    return {
      message: assistantMessage("L'agenda di oggi è libera.", {
        actions: [buildPageAction("agenda", "Apri agenda", "/agenda")],
      }),
    };
  }

  const lines = upcoming.slice(0, LIST_LIMIT).map(
    (item) =>
      `• **${item.title}** — ${formatVisitDate(item.scheduledAt)} (${AGENDA_KIND_LABELS[item.kind]})`
  );

  return {
    message: assistantMessage(
      `Agenda di oggi (${upcoming.length} impegni):\n\n${lines.join("\n")}`,
      {
        items: upcoming.slice(0, LIST_LIMIT).map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: `${formatVisitDate(item.scheduledAt)} · ${AGENDA_KIND_LABELS[item.kind]}`,
        })),
        actions: [
          buildPageAction("agenda", "Apri agenda", "/agenda"),
          buildPageAction("auto", "Modalità Auto", "/auto"),
        ],
      }
    ),
  };
}

async function handleRadar(userId: string | null): Promise<JoyChatResponse> {
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

  const centerLat =
    rows.reduce((sum, row) => sum + Number(row.latitude), 0) / rows.length;
  const centerLng =
    rows.reduce((sum, row) => sum + Number(row.longitude), 0) / rows.length;

  const result = await analyzeOpportunityRadar({
    centerLat,
    centerLng,
    radiusKm: 10,
    companyIds: rows.map((row) => row.id),
  });

  const hits = result.items.slice(0, LIST_LIMIT);
  if (hits.length === 0) {
    return {
      message: assistantMessage("Il radar non ha trovato opportunità nelle vicinanze.", {
        actions: [buildPageAction("maps", "Apri mappa radar", "/maps")],
      }),
    };
  }

  const lines = hits.map(
    (item) =>
      `• **${item.companyName}** — ${formatDistanceKm(item.distanceKm)} · ${item.primaryReason}`
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
      `Radar: ${hits.length} clienti interessanti nelle vicinanze:\n\n${lines.join("\n")}`,
      {
        actions: dedupeActions([
          buildPageAction("maps-radar", "Apri mappa", "/maps"),
          ...actions,
        ]).slice(0, 16),
      }
    ),
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
  const { data, error } = await listOpportunities({ limit: 500 });
  if (error) {
    return { message: assistantMessage(`Errore pipeline: ${error}`) };
  }

  const open = (data ?? []).filter((item) => isOpenOpportunityStage(item.stage));
  const total = open.reduce((sum, item) => sum + item.total_amount, 0);

  const top = [...open].sort((a, b) => b.total_amount - a.total_amount).slice(0, 8);
  const lines = top.map(
    (item) =>
      `• **${item.company_name ?? item.title}** — ${formatOpportunityAmount(item.total_amount)}`
  );

  return {
    message: assistantMessage(
      `Pipeline: ${open.length} opportunità aperte per ${formatOpportunityAmount(total)}.\n\n**Top opportunità:**\n${lines.join("\n")}`,
      {
        actions: [
          buildPageAction("opportunities", "Apri opportunità", "/opportunities"),
          ...top
            .filter((item) => item.company_id)
            .slice(0, 4)
            .map((item) =>
              buildPageAction(
                `pipe-${item.id}`,
                item.company_name ?? item.title,
                `/companies/${item.company_id}`
              )
            ),
        ],
      }
    ),
  };
}

async function handleContactsSummary(): Promise<JoyChatResponse> {
  const { data, count, error } = await listContacts(15);
  if (error) {
    return { message: assistantMessage(`Errore contatti: ${error}`) };
  }

  const rows = data ?? [];
  const lines = rows.map(
    (row) =>
      `• **${row.full_name}** — ${row.company?.name ?? "Azienda"}${row.phone ? ` · ${row.phone}` : ""}`
  );

  return {
    message: assistantMessage(
      `Hai ${count ?? rows.length} contatti nel CRM. Ecco i primi ${rows.length}:\n\n${lines.join("\n")}`,
      {
        actions: [
          buildPageAction("contacts", "Apri contatti", "/contacts"),
          ...rows
            .filter((row) => row.phone)
            .slice(0, 4)
            .map((row) => ({
              id: `call-${row.id}`,
              kind: "call" as const,
              label: `Chiama ${row.full_name}`,
              href: `tel:${row.phone!.replace(/\s+/g, "")}`,
            })),
        ],
      }
    ),
  };
}

function handleHelp(): JoyChatResponse {
  return {
    message: assistantMessage(
      `Ciao! Sono **Joy**, il tuo assistente e copilot sul campo.\n\n` +
        `**Domande operative:**\n` +
        `• "Chi devo visitare oggi?"\n` +
        `• "Quali clienti non vedo da un anno?"\n` +
        `• "Quante opportunità sopra 10.000 € ho?"\n\n` +
        `**Azioni Copilot (con conferma):**\n` +
        `• "Pianifica una visita da Rossi domani alle 15"\n` +
        `• "Sposta la visita di Bianchi a venerdì"\n` +
        `• "Crea un follow-up da Rossi tra 20 giorni"\n` +
        `• "Apri l'azienda Rossi"\n` +
        `• "Organizza il mio giro di domani"\n` +
        `• "Fammi vedere le opportunità oltre 15.000 euro"`,
      {
        actions: [
          buildPageAction("joy-dashboard", "Dashboard Joy", "/joy"),
          buildPageAction("assistant", "Assistente", "/assistant"),
        ],
      }
    ),
  };
}

function handleUnknown(): JoyChatResponse {
  return {
    message: assistantMessage(
      "Non ho capito bene la richiesta. Prova a riformularla oppure chiedi aiuto con esempi concreti (visite oggi, clienti inattivi, opportunità, VEPA, giro visite, apertura azienda).",
      { actions: [buildPageAction("help-joy", "Esempi", "/joy/chat")] }
    ),
  };
}

async function dispatchIntent(intent: JoyIntent, userId: string | null): Promise<JoyChatResponse> {
  switch (intent.type) {
    case "visits_today":
      return handleVisitsToday(userId);
    case "inactive_clients":
      return handleInactiveClients(intent.days);
    case "opportunities_min_amount":
      return handleOpportunitiesMinAmount(intent.amount);
    case "product_interest":
      return handleProductInterest(intent.family);
    case "optimize_tour":
      return handleOptimizeTour(userId);
    case "nearby_city":
      return intent.city ? handleNearbyCity(intent.city) : handleUnknown();
    case "open_company":
      return handleOpenCompany(intent.query);
    case "follow_ups_overdue":
      return handleFollowUpsOverdue();
    case "agenda_today":
      return handleAgendaToday(userId);
    case "radar":
      return handleRadar(userId);
    case "calendar_status":
      return handleCalendarStatus();
    case "pipeline_summary":
      return handlePipelineSummary();
    case "contacts_summary":
      return handleContactsSummary();
    case "help":
      return handleHelp();
    default:
      return handleUnknown();
  }
}

export async function processJoyChatMessage(userMessage: string): Promise<JoyChatResponse> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    return { message: assistantMessage("Scrivi una domanda per iniziare.") };
  }

  const copilotResponse = await processJoyCopilotCommand(trimmed);
  if (copilotResponse) {
    return copilotResponse;
  }

  const user = await getCurrentUser();
  const intent = parseJoyIntent(trimmed);
  return dispatchIntent(intent, user?.id ?? null);
}
