/**
 * Strategic reasoning engine — estimates only, never invents or promises.
 * Answers: increase revenue, sell more VEPA, zone focus, recover lost clients, hit goals.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { listOpportunities } from "@/features/opportunities/services/opportunities.service";
import { listQuotes } from "@/features/quotes/services/quotes.service";
import { listOrders } from "@/features/orders/services/orders.service";
import { getStaleOpportunities } from "@/features/joy/tools/get-opportunities";
import { isOpenOpportunityStage } from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS, type ProductFamily } from "@/lib/constants/product-catalog";
import { resolveCompanyIdsForProductFilters } from "@/features/products/services/company-product-interests.service";
import { JOY_INSUFFICIENT_DATA_MESSAGE } from "@/features/joy/tools";
import type { JoyStrategyInsight, JoyStrategyRequest } from "../types";

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function resolveFamily(raw: string | null | undefined): ProductFamily | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (/\bvepa\b/.test(t)) return "vepa";
  if (/zanzarier/.test(t)) return "zanzariere";
  if (/tapparell/.test(t)) return "tapparelle";
  if (/cristal/.test(t)) return "tende_cristal";
  if (/rullo|tecnic/.test(t)) return "tende_tecniche_rullo";
  return null;
}

async function countCompaniesInZone(
  userId: string | null,
  zone: string
): Promise<{ clients: number; prospects: number; inactive: number }> {
  const supabase = await createServerClient();
  const needle = zone.trim();

  let query = supabase
    .from("companies")
    .select("id,commercial_status,last_visit_at,city,province")
    .limit(250);

  if (userId) {
    query = applyAgentCompanyScope(query, userId);
  }

  const { data } = await query;
  const rows = (data ?? []).filter((row) => {
    const city = (row.city ?? "").toLowerCase();
    const province = (row.province ?? "").toLowerCase();
    const z = needle.toLowerCase();
    return city.includes(z) || province.includes(z);
  });

  const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  let clients = 0;
  let prospects = 0;
  let inactive = 0;

  for (const row of rows) {
    if (row.commercial_status === "cliente") clients += 1;
    if (row.commercial_status === "prospect") prospects += 1;
    const last = row.last_visit_at ? new Date(row.last_visit_at).getTime() : null;
    if (row.commercial_status === "cliente" && (last == null || last < yearAgo)) {
      inactive += 1;
    }
  }

  return { clients, prospects, inactive };
}

async function countLostOrInactive(userId: string | null): Promise<{
  lostStage: number;
  inactiveClients: number;
}> {
  const supabase = await createServerClient();
  let lostQuery = supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("stage", "lost");
  if (userId) lostQuery = lostQuery.eq("user_id", userId);

  let inactiveQuery = supabase
    .from("companies")
    .select("id,last_visit_at")
    .eq("commercial_status", "cliente")
    .limit(100);
  if (userId) {
    inactiveQuery = applyAgentCompanyScope(inactiveQuery, userId);
  }

  const [lostRes, inactiveRes] = await Promise.all([lostQuery, inactiveQuery]);
  const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const inactiveClients = (inactiveRes.data ?? []).filter((row) => {
    if (!row.last_visit_at) return true;
    return new Date(row.last_visit_at).getTime() < yearAgo;
  }).length;

  return {
    lostStage: lostRes.count ?? 0,
    inactiveClients,
  };
}

/**
 * Build a strategy answer from real CRM aggregates only.
 */
export async function buildJoyStrategyInsight(
  request: JoyStrategyRequest,
  userId: string | null
): Promise<JoyStrategyInsight> {
  const [oppsResult, quotesResult, ordersResult, stale, lost] = await Promise.all([
    listOpportunities({ limit: 500 }),
    listQuotes({ limit: 100 }),
    listOrders({ limit: 100 }),
    getStaleOpportunities({ limit: 10 }),
    countLostOrInactive(userId),
  ]);

  const allOpps = oppsResult.data ?? [];
  const openOpps = allOpps.filter((item) => isOpenOpportunityStage(item.stage));
  const pipelineValue = openOpps.reduce((sum, item) => sum + (item.total_amount || 0), 0);
  const openCount = openOpps.length;
  const quotes = quotesResult.data ?? [];
  const quoteValue = quotes.reduce((sum, item) => sum + (item.total_amount || 0), 0);
  const quoteCount = quotes.length;
  const orders = ordersResult.data ?? [];
  const orderValue = orders.reduce((sum, item) => sum + (item.total_amount || 0), 0);
  const staleCount = stale.data?.rows?.length ?? 0;

  const hasCoreData =
    openCount > 0 || quoteCount > 0 || orders.length > 0 || allOpps.length > 0;

  if (!hasCoreData) {
    return {
      focus: request.focus,
      headline: "Dati insufficienti per una strategia",
      narrative: JOY_INSUFFICIENT_DATA_MESSAGE,
      levers: [],
      dataQuality: "insufficient",
      insufficientNote: JOY_INSUFFICIENT_DATA_MESSAGE,
    };
  }

  if (request.focus === "product_family" || request.productFamily) {
    const family = resolveFamily(request.productFamily) ?? "vepa";
    const label = PRODUCT_FAMILY_LABELS[family] ?? family;
    const { companyIds } = await resolveCompanyIdsForProductFilters({
      productFamily: family,
    });
    const interested = companyIds?.length ?? 0;
    const familyOpps = openOpps.filter((row) =>
      (row.title ?? "").toLowerCase().includes(family.replace(/_/g, " "))
    );
    const familyPipeline = familyOpps.reduce(
      (sum, row) => sum + (row.total_amount || 0),
      0
    );

    const dataQuality: JoyStrategyInsight["dataQuality"] =
      interested + familyOpps.length >= 3
        ? "sufficient"
        : interested + familyOpps.length > 0
          ? "partial"
          : "insufficient";

    if (dataQuality === "insufficient") {
      return {
        focus: "product_family",
        headline: `Vendite ${label}: dati insufficienti`,
        narrative: `Non ho abbastanza segnali CRM su interessi/opportunità ${label} per stimare un piano. ${JOY_INSUFFICIENT_DATA_MESSAGE}`,
        levers: [],
        dataQuality,
        insufficientNote: JOY_INSUFFICIENT_DATA_MESSAGE,
      };
    }

    return {
      focus: "product_family",
      headline: `Come spingere ${label} (stime da CRM)`,
      narrative: `Nel CRM risultano **${interested}** aziende con interesse ${label} e **${familyOpps.length}** opportunità aperte correlate (pipeline ~${formatEuro(familyPipeline)}). Sono stime operative, non previsioni di chiusura.`,
      levers: [
        {
          title: `Prioritizza i ${Math.min(8, interested || familyOpps.length)} clienti/prospect con interesse ${label}`,
          evidence: `${interested} aziende con filtro prodotto nel CRM`,
          estimateNote: "Nessuna garanzia di conversione — solo priorità operativa.",
        },
        {
          title: "Chiudi o aggiorna opportunità correlate stagnanti",
          evidence: `${staleCount} opportunità stale totali in CRM`,
          estimateNote: "Recupero potenziale stimato solo se aggiorni gli stage reali.",
        },
        {
          title: "Allinea preventivi aperti al catalogo",
          evidence: `Preventivi: valore aggregato ${formatEuro(quoteValue)}`,
          estimateNote: "Stima di copertura, non di fatturato certo.",
        },
      ],
      dataQuality,
    };
  }

  if (request.focus === "zone" || request.zone) {
    const zone = (request.zone ?? "Latina").trim();
    const counts = await countCompaniesInZone(userId, zone);
    const total = counts.clients + counts.prospects;
    const dataQuality: JoyStrategyInsight["dataQuality"] =
      total >= 5 ? "sufficient" : total > 0 ? "partial" : "insufficient";

    if (dataQuality === "insufficient") {
      return {
        focus: "zone",
        headline: `Zona ${zone}: dati insufficienti`,
        narrative: `Non trovo abbastanza aziende in zona "${zone}" nel tuo perimetro CRM. ${JOY_INSUFFICIENT_DATA_MESSAGE}`,
        levers: [],
        dataQuality,
        insufficientNote: JOY_INSUFFICIENT_DATA_MESSAGE,
      };
    }

    return {
      focus: "zone",
      headline: `Strategia zona ${zone}`,
      narrative: `In zona **${zone}** il CRM mostra **${counts.clients}** clienti, **${counts.prospects}** prospect e **${counts.inactive}** clienti inattivi (>12 mesi senza visita).`,
      levers: [
        {
          title: "Giro densità: cluster visitabile in giornata",
          evidence: `${total} aziende in zona nel perimetro`,
          estimateNote: "Km e tempo dipendono da GPS e agenda reale.",
        },
        {
          title: "Recupero inattivi prima di nuovi prospect",
          evidence: `${counts.inactive} clienti senza visita recente`,
          estimateNote: "Riattivazione stimata — non promessa di ordine.",
        },
        {
          title: "Prospect caldi in zona",
          evidence: `${counts.prospects} prospect in anagrafica zona`,
          estimateNote: "Priorità commerciale, non forecast.",
        },
      ],
      dataQuality,
    };
  }

  if (request.focus === "lost_clients") {
    return {
      focus: "lost_clients",
      headline: "Recupero clienti persi / inattivi",
      narrative: `Nel CRM: **${lost.lostStage}** opportunità lost e **${lost.inactiveClients}** clienti senza visita recente (campione). Piano di recupero solo su dati reali.`,
      levers: [
        {
          title: "Richiamo clienti inattivi con follow-up strutturato",
          evidence: `${lost.inactiveClients} clienti nel campione inattivo`,
          estimateNote: "Stima di riattivazione, non di fatturato.",
        },
        {
          title: "Analisi lost: motivo e ripresa se ancora aperti",
          evidence: `${lost.lostStage} opportunità in stage lost`,
          estimateNote: "Solo se il cliente è ancora in anagrafica attiva.",
        },
        {
          title: "Sblocca opportunità stale prima di nuova acquisizione",
          evidence: `${staleCount} opportunità stale`,
          estimateNote: "Impatto stimato sulla pipeline aperta esistente.",
        },
      ],
      dataQuality:
        lost.inactiveClients + lost.lostStage > 0 ? "sufficient" : "partial",
    };
  }

  if (request.focus === "sales_goal" && request.amount && request.amount > 0) {
    const amount = request.amount;
    const periodLabel =
      request.period === "week"
        ? "settimana"
        : request.period === "year"
          ? "anno"
          : "mese";
    const coverage =
      amount > 0 ? Math.min(100, Math.round((pipelineValue / amount) * 100)) : 0;
    const gap = Math.max(0, amount - orderValue);

    return {
      focus: "sales_goal",
      headline: `Obiettivo ${formatEuro(amount)} / ${periodLabel}`,
      narrative: `Pipeline aperta ~${formatEuro(pipelineValue)} (${coverage}% di copertura grezza sull'obiettivo). Ordini recenti aggregati ~${formatEuro(orderValue)}. Gap operativo stimato ~${formatEuro(gap)}. Nessuna garanzia di chiusura.`,
      levers: [
        {
          title: "Concentrati sulle top opportunità aperte",
          evidence: `${openCount} opportunità aperte · pipeline ${formatEuro(pipelineValue)}`,
          estimateNote: "Copertura pipeline ≠ fatturato chiuso.",
        },
        {
          title: "Insegui preventivi inviati senza esito",
          evidence: `Preventivi valore ${formatEuro(quoteValue)} (${quoteCount} record)`,
          estimateNote: "Tasso di conversione storico non inventato — usa solo CRM.",
        },
        {
          title: "Sblocca stale e follow-up scaduti",
          evidence: `${staleCount} opportunità stale`,
          estimateNote: "Stima di sblocco, non di won automatico.",
        },
      ],
      dataQuality: openCount > 0 || quoteValue > 0 ? "sufficient" : "partial",
    };
  }

  if (request.focus === "showroom") {
    const zoneHint = request.zone ?? "showroom";
    return {
      focus: "showroom",
      headline: "Piano showroom / punto vendita",
      narrative: `Uso i dati CRM (pipeline ${formatEuro(pipelineValue)}, preventivi ${formatEuro(quoteValue)}) per suggerire visite e follow-up utili a portare clienti in showroom. Nessuna previsione di footfall inventata.`,
      levers: [
        {
          title: "Invita clienti con preventivo aperto",
          evidence: `Preventivi aggregati ${formatEuro(quoteValue)}`,
          estimateNote: "Invito operativo — non previsione visite showroom.",
        },
        {
          title: "Priorità opportunità high-value",
          evidence: `${openCount} opportunità aperte`,
          estimateNote: "Selezione per valore pipeline, non certezza di chiusura.",
        },
        {
          title:
            zoneHint !== "showroom"
              ? `Cluster zona ${zoneHint}`
              : "Cluster geografico vicino alla sede",
          evidence: "Usa «Organizza giro» + zona per densità reale",
          estimateNote: "Dipende da anagrafiche geocodificate.",
        },
      ],
      dataQuality: openCount + quoteCount > 0 ? "partial" : "insufficient",
    };
  }

  return {
    focus: request.focus === "revenue" ? "revenue" : "general",
    headline: "Come aumentare il fatturato (stime CRM)",
    narrative: `Segnali CRM: pipeline aperta **${formatEuro(pipelineValue)}** (${openCount} opp.), preventivi **${formatEuro(quoteValue)}**, ordini recenti **${formatEuro(orderValue)}**, stale **${staleCount}**, clienti inattivi campione **${lost.inactiveClients}**.`,
    levers: [
      {
        title: "Accelera pipeline: aggiorna e chiudi stage stagnanti",
        evidence: `${staleCount} opportunità stale · ${openCount} aperte`,
        estimateNote: "Stima di sblocco sul valore già in CRM.",
      },
      {
        title: "Converti preventivi inviati in follow-up commerciali",
        evidence: `Valore preventivi ${formatEuro(quoteValue)}`,
        estimateNote: "Nessun tasso di win inventato.",
      },
      {
        title: "Recupera clienti inattivi e opportunità lost riapribili",
        evidence: `${lost.inactiveClients} inattivi · ${lost.lostStage} lost`,
        estimateNote: "Riattivazione stimata, non promessa.",
      },
      {
        title: "Densifica il giro: più visite ad alto score radar",
        evidence: "Usa Coach + Giro Joy su dati reali",
        estimateNote: "Impatto dipende da zona e agenda.",
      },
    ],
    dataQuality: "sufficient",
  };
}

export function formatStrategyInsight(insight: JoyStrategyInsight): string {
  if (insight.dataQuality === "insufficient") {
    return [
      `**${insight.headline}**`,
      "",
      insight.narrative,
      insight.insufficientNote ? `\n_${insight.insufficientNote}_` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const levers = insight.levers
    .map(
      (lever, index) =>
        `${index + 1}. **${lever.title}**\n   Evidenza: ${lever.evidence}\n   _${lever.estimateNote}_`
    )
    .join("\n\n");

  return [
    `**${insight.headline}**`,
    "",
    insight.narrative,
    "",
    "**Leve operative (stime, non promesse):**",
    "",
    levers,
    "",
    insight.dataQuality === "partial"
      ? "_Dati parziali: integra con Coach o Briefing cliente prima di agire._"
      : "_Conferma sempre ogni mutazione CRM. Joy non salva da solo._",
  ].join("\n");
}
