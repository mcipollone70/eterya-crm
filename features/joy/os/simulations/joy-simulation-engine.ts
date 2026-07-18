import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { listOpportunities } from "@/features/opportunities/services/opportunities.service";
import { listQuotes } from "@/features/quotes/services/quotes.service";
import { isOpenOpportunityStage } from "@/lib/constants/opportunity-pipeline";
import { resolveCompanyIdsForProductFilters } from "@/features/products/services/company-product-interests.service";
import { JOY_INSUFFICIENT_DATA_MESSAGE } from "@/features/joy/tools";
import { joySafeLog } from "../logging/joy-safe-logger";
import {
  parseJoySimulationRequest,
  type JoySimulationScenario,
} from "./parse-joy-simulation";

export type { JoySimulationScenario };
export { parseJoySimulationRequest };

export interface JoySimulationResult {
  scenario: JoySimulationScenario;
  headline: string;
  narrative: string;
  assumptions: string[];
  estimates: Array<{ label: string; value: string; note: string }>;
  dataQuality: "sufficient" | "partial" | "insufficient";
  readOnly: true;
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function runJoySimulation(
  scenario: JoySimulationScenario,
  userId: string | null
): Promise<JoySimulationResult> {
  try {
    const [oppsResult, quotesResult] = await Promise.all([
      listOpportunities({ limit: 400 }),
      listQuotes({ limit: 120 }),
    ]);

    const openOpps = (oppsResult.data ?? []).filter((o) =>
      isOpenOpportunityStage(o.stage)
    );
    const pipeline = openOpps.reduce((s, o) => s + (o.total_amount || 0), 0);
    const quotes = quotesResult.data ?? [];
    const quoteValue = quotes.reduce((s, q) => s + (q.total_amount || 0), 0);

    if (openOpps.length === 0 && quotes.length === 0) {
      return {
        scenario,
        headline: "Simulazione non disponibile",
        narrative: JOY_INSUFFICIENT_DATA_MESSAGE,
        assumptions: [],
        estimates: [],
        dataQuality: "insufficient",
        readOnly: true,
      };
    }

    if (scenario === "extra_visits") {
      const avgOpp =
        openOpps.length > 0 ? pipeline / openOpps.length : quoteValue / Math.max(1, quotes.length);
      const softLift = avgOpp * 0.08;
      return {
        scenario,
        headline: "Simulazione: +1 / +2 visite oggi (sola lettura)",
        narrative:
          "Se aggiungi 1–2 visite mirate su opportunità/prospect già in CRM, il potenziale incrementale è una stima soft sul valore medio aperto — non una previsione di chiusura.",
        assumptions: [
          "Usiamo solo opportunità aperte / preventivi esistenti",
          "Nessun tasso di conversione inventato",
          "Nessuna azione CRM viene eseguita",
        ],
        estimates: [
          {
            label: "Pipeline aperta attuale",
            value: formatEuro(pipeline),
            note: `${openOpps.length} opportunità aperte`,
          },
          {
            label: "Stima soft per visita extra (8% del valore medio)",
            value: formatEuro(softLift),
            note: "Stima trasparente, non promessa",
          },
        ],
        dataQuality: openOpps.length >= 3 ? "sufficient" : "partial",
        readOnly: true,
      };
    }

    if (scenario === "latina_only") {
      const supabase = await createServerClient();
      let query = supabase
        .from("companies")
        .select("id,name,city,province,commercial_status")
        .or("city.ilike.%Latina%,province.ilike.%LT%,province.ilike.%Latina%")
        .limit(120);
      if (userId) query = applyAgentCompanyScope(query, userId);
      const { data } = await query;
      const companies = data ?? [];
      const clients = companies.filter((c) => c.commercial_status === "cliente").length;
      const prospects = companies.filter((c) => c.commercial_status === "prospect").length;

      return {
        scenario,
        headline: "Simulazione: focus solo Latina (sola lettura)",
        narrative: `In zona Latina risultano **${companies.length}** aziende in scope (${clients} clienti, ${prospects} prospect). Concentrare il giro lì riduce km e aumenta densità — senza garantire più chiusure.`,
        assumptions: [
          "Match su city/province contenente Latina/LT",
          "Scope agente applicato se presente",
          "Nessun ordine o visita creato",
        ],
        estimates: [
          {
            label: "Aziende Latina in CRM",
            value: String(companies.length),
            note: "Conteggio reale",
          },
          {
            label: "Prospect Latina",
            value: String(prospects),
            note: "Candidati visita",
          },
        ],
        dataQuality: companies.length >= 5 ? "sufficient" : "partial",
        readOnly: true,
      };
    }

    if (scenario === "more_showroom") {
      const supabase = await createServerClient();
      let query = supabase
        .from("companies")
        .select("id,name,commercial_status,city")
        .or("name.ilike.%showroom%,notes.ilike.%showroom%,city.ilike.%showroom%")
        .limit(80);
      if (userId) query = applyAgentCompanyScope(query, userId);
      const { data } = await query;
      const rows = data ?? [];

      return {
        scenario,
        headline: "Simulazione: più showroom (sola lettura)",
        narrative:
          rows.length > 0
            ? `Trovate **${rows.length}** aziende con segnale showroom nei dati. Spingere visite showroom aumenta esposizione prodotto — stima qualitativa, senza previsione fatturato.`
            : "Pochi o nessun match esplicito «showroom» nei campi azienda. Servono tag/note più ricchi per simulare meglio.",
        assumptions: [
          "Match testuale name/notes/city su «showroom»",
          "Nessun inventario showroom esterno",
        ],
        estimates: [
          {
            label: "Match showroom",
            value: String(rows.length),
            note: rows.length === 0 ? "Dati parziali" : "Conteggio reale",
          },
        ],
        dataQuality: rows.length >= 3 ? "partial" : "insufficient",
        readOnly: true,
      };
    }

    if (scenario === "follow_all_quotes") {
      const soft = quoteValue * 0.15;
      return {
        scenario,
        headline: "Simulazione: seguire tutti i preventivi aperti (sola lettura)",
        narrative: `Hai **${quotes.length}** preventivi in elenco (valore ${formatEuro(quoteValue)}). Se li richiamassi tutti, una stima soft al 15% del valore (non un tasso storico calcolato qui) darebbe un ordine di grandezza — non una garanzia.`,
        assumptions: [
          "15% è una sensibilità illustrativa, non win-rate misurato",
          "Nessuna chiamata viene creata",
        ],
        estimates: [
          {
            label: "Valore preventivi",
            value: formatEuro(quoteValue),
            note: `${quotes.length} documenti`,
          },
          {
            label: "Sensibilità 15% (illustrativa)",
            value: formatEuro(soft),
            note: "Non è una previsione",
          },
        ],
        dataQuality: quotes.length >= 3 ? "partial" : "insufficient",
        readOnly: true,
      };
    }

    // prioritize_vepa
    const { companyIds: vepaIds } = await resolveCompanyIdsForProductFilters({
      productFamily: "vepa",
    });
    const vepaSet = new Set(vepaIds ?? []);
    const vepaOpps = openOpps.filter(
      (o) => o.company_id && vepaSet.has(o.company_id)
    );
    const vepaPipeline = vepaOpps.reduce((s, o) => s + (o.total_amount || 0), 0);

    return {
      scenario,
      headline: "Simulazione: prioritizzare VEPA (sola lettura)",
      narrative:
        vepaSet.size === 0
          ? "Interessi prodotto VEPA insufficienti in CRM per una simulazione solida."
          : `Ci sono **${vepaSet.size}** aziende con interesse VEPA e **${vepaOpps.length}** opportunità aperte collegate (pipeline ${formatEuro(vepaPipeline)}). Prioritizzare VEPA oggi significa ripianificare visite/chiamate su questo sottoinsieme — senza inventare conversioni.`,
      assumptions: [
        "Interessi da company_product_interests / catalogo famiglia vepa",
        "Nessun prodotto inventato",
      ],
      estimates: [
        {
          label: "Aziende interesse VEPA",
          value: String(vepaSet.size),
          note: "Dato reale",
        },
        {
          label: "Pipeline VEPA aperta",
          value: formatEuro(vepaPipeline),
          note: `${vepaOpps.length} opportunità`,
        },
      ],
      dataQuality: vepaSet.size >= 3 ? "sufficient" : "insufficient",
      readOnly: true,
    };
  } catch (error) {
    joySafeLog("error", "simulation", "simulation failed", {
      scenario,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      scenario,
      headline: "Simulazione non disponibile",
      narrative: JOY_INSUFFICIENT_DATA_MESSAGE,
      assumptions: [],
      estimates: [],
      dataQuality: "insufficient",
      readOnly: true,
    };
  }
}

export function formatJoySimulation(result: JoySimulationResult): string {
  if (result.dataQuality === "insufficient" && result.estimates.length === 0) {
    return `**${result.headline}**\n\n${result.narrative}`;
  }
  return [
    `**${result.headline}**`,
    "",
    result.narrative,
    "",
    "Assunzioni:",
    ...result.assumptions.map((a) => `• ${a}`),
    "",
    "Stime (sola lettura, non promesse):",
    ...result.estimates.map((e) => `• **${e.label}**: ${e.value} — ${e.note}`),
    "",
    "Nessuna azione CRM eseguita. Dimmi se vuoi un piano operativo concreto (con conferma).",
  ].join("\n");
}
