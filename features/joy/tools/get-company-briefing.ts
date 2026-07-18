import "server-only";

import { getCompanyVisitBriefing } from "@/features/assistant/services/company-briefing.service";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { getQuotes } from "./get-quotes";
import { getOrders } from "./get-orders";
import { getSamplesToRecover } from "./get-samples-to-recover";
import { getOpenServiceTickets } from "./get-open-service-tickets";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyCompanyBriefingSnapshot {
  companyId: string;
  companyName: string;
  location: string | null;
  commercialStatus: string | null;
  contactName: string | null;
  phone: string | null;
  lastVisitLabel: string | null;
  lastOrderLabel: string | null;
  openOpportunities: number;
  pipelineValue: number;
  purchasedProducts: string[];
  interestProducts: string[];
  upsellProducts: string[];
  openFollowUps: number;
  quotesCount: number;
  ordersCount: number;
  samplesToRecover: number;
  openTickets: number;
  visitCadenceDays: number | null;
  suggestions: string[];
  summaryText: string;
}

function emptyBriefing(): JoyCompanyBriefingSnapshot {
  return {
    companyId: "",
    companyName: "",
    location: null,
    commercialStatus: null,
    contactName: null,
    phone: null,
    lastVisitLabel: null,
    lastOrderLabel: null,
    openOpportunities: 0,
    pipelineValue: 0,
    purchasedProducts: [],
    interestProducts: [],
    upsellProducts: [],
    openFollowUps: 0,
    quotesCount: 0,
    ordersCount: 0,
    samplesToRecover: 0,
    openTickets: 0,
    visitCadenceDays: null,
    suggestions: [],
    summaryText: "",
  };
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString("it-IT");
  } catch {
    return null;
  }
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
}

export async function getCompanyBriefing(
  companyId: string
): Promise<JoyToolResult<JoyCompanyBriefingSnapshot>> {
  try {
    const [{ data, error }, quotesRes, ordersRes, samplesRes, ticketsRes] =
      await Promise.all([
        getCompanyVisitBriefing(companyId),
        getQuotes({ companyId, limit: 5 }),
        getOrders({ companyId, limit: 5 }),
        getSamplesToRecover({ companyId, limit: 5 }),
        getOpenServiceTickets({ companyId, limit: 5 }),
      ]);

    if (error || !data) {
      return emptyToolResult(emptyBriefing(), error ?? "Briefing non disponibile.");
    }

    const location = [data.city, data.province].filter(Boolean).join(", ") || null;
    const lastVisitLabel = data.lastVisit.at
      ? `${formatDate(data.lastVisit.at)}${data.lastVisit.outcome ? ` · ${data.lastVisit.outcome}` : ""}`
      : null;
    const lastOrderLabel = data.lastOrder.at
      ? `${formatDate(data.lastOrder.at)}${data.lastOrder.label ? ` · ${data.lastOrder.label}` : ""}`
      : null;

    const purchasedProducts = data.products.purchased.map((item) => item.name).slice(0, 8);
    const interestProducts = data.products.interests.map((item) => item.name).slice(0, 8);
    const upsellProducts = data.products.neverPurchased.map((item) => item.name).slice(0, 5);
    const suggestions = data.aiSuggestions.slice(0, 5);
    const visitCadenceDays = daysSince(data.lastVisit.at);
    const quotesCount = quotesRes.data?.quoteCount ?? 0;
    const ordersCount = ordersRes.data?.orderCount ?? 0;
    const samplesToRecover = samplesRes.data?.count ?? 0;
    const openTickets = ticketsRes.data?.count ?? 0;

    const risks: string[] = [];
    if (!lastVisitLabel) {
      risks.push("Nessuna visita registrata");
    } else if (visitCadenceDays != null && visitCadenceDays >= 90) {
      risks.push(`Ultima visita ${visitCadenceDays} giorni fa`);
    }
    if (data.followUps.length > 0) {
      risks.push(`${data.followUps.length} follow-up aperti`);
    }
    if (data.opportunities.openCount === 0 && data.commercialStatus?.toLowerCase().includes("prospect")) {
      risks.push("Prospect senza opportunità in pipeline");
    }
    if (!data.contactName && !data.phone) {
      risks.push("Referente/telefono mancanti");
    }
    if (samplesToRecover > 0) {
      risks.push(`${samplesToRecover} campioni da recuperare`);
    }
    if (openTickets > 0) {
      risks.push(`${openTickets} ticket assistenza aperti`);
    }

    // Probabilità: media opportunità aperte se presente, altrimenti euristica
    const oppProbabilities = data.opportunities.items
      .map((item) => item.probability)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    let winProbability =
      oppProbabilities.length > 0
        ? Math.round(
            oppProbabilities.reduce((sum, value) => sum + value, 0) / oppProbabilities.length
          )
        : 20;
    if (oppProbabilities.length === 0) {
      if (data.opportunities.openCount > 0) winProbability += 25;
      if (data.opportunities.totalValue > 5000) winProbability += 15;
      if (interestProducts.length > 0) winProbability += 15;
      if (purchasedProducts.length > 0) winProbability += 10;
      if (lastVisitLabel) winProbability += 10;
      if (risks.length >= 3) winProbability -= 15;
    }
    winProbability = Math.max(5, Math.min(90, winProbability));

    const nextAction =
      data.followUps.length > 0
        ? "Chiudi o riprogramma i follow-up aperti"
        : openTickets > 0
          ? "Verifica i ticket assistenza aperti prima della visita"
          : samplesToRecover > 0
            ? "Recupera i campioni in ritardo"
            : data.opportunities.openCount > 0
              ? "Aggiorna l'opportunità in pipeline e proponi il passo successivo"
              : quotesCount > 0
                ? "Segui i preventivi aperti"
                : interestProducts.length > 0
                  ? `Approfondisci interessi: ${interestProducts.slice(0, 2).join(", ")}`
                  : "Fissa una visita o una chiamata di qualifica";

    const oppLines =
      data.opportunities.items.length > 0
        ? data.opportunities.items
            .slice(0, 3)
            .map(
              (item) =>
                `  · ${item.title} (${item.stage}${
                  item.probability != null ? ` · ${item.probability}%` : ""
                }${item.amount ? ` · ${formatOpportunityAmount(item.amount)}` : ""})`
            )
            .join("\n")
        : null;

    const lines = [
      `**Briefing ${data.companyName}**${location ? ` (${location})` : ""}`,
      data.commercialStatus ? `Stato commerciale: ${data.commercialStatus}` : null,
      data.contactName || data.phone
        ? `Referente: ${[data.contactName, data.phone].filter(Boolean).join(" · ")}`
        : null,
      lastVisitLabel
        ? `Ultima visita: ${lastVisitLabel}${
            visitCadenceDays != null ? ` (${visitCadenceDays}g fa)` : ""
          }`
        : null,
      lastOrderLabel ? `Ultimo ordine/acquisto: ${lastOrderLabel}` : null,
      data.opportunities.openCount > 0 || data.opportunities.totalValue > 0
        ? `Opportunità aperte: ${data.opportunities.openCount} · Valore: ${formatOpportunityAmount(data.opportunities.totalValue)}`
        : null,
      oppLines,
      quotesCount > 0 || ordersCount > 0 || samplesToRecover > 0 || openTickets > 0
        ? [
            quotesCount > 0 ? `Preventivi: ${quotesCount}` : null,
            ordersCount > 0 ? `Ordini: ${ordersCount}` : null,
            samplesToRecover > 0 ? `Campioni da recuperare: ${samplesToRecover}` : null,
            openTickets > 0 ? `Ticket aperti: ${openTickets}` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : null,
      purchasedProducts.length > 0
        ? `Prodotti acquistati: ${purchasedProducts.join(", ")}`
        : null,
      interestProducts.length > 0
        ? `Interessi: ${interestProducts.join(", ")}`
        : null,
      upsellProducts.length > 0
        ? `Upsell possibili: ${upsellProducts.join(", ")}`
        : null,
      data.followUps.length > 0 ? `Follow-up aperti: ${data.followUps.length}` : null,
      risks.length > 0 ? `Rischi: ${risks.join(" · ")}` : null,
      `Probabilità di chiusura (stimata sui dati CRM): **${winProbability}%**`,
      `Prossima azione consigliata: ${nextAction}`,
      suggestions.length > 0
        ? `Suggerimenti:\n${suggestions.map((text) => `• ${text}`).join("\n")}`
        : null,
    ].filter(Boolean);

    const snapshot: JoyCompanyBriefingSnapshot = {
      companyId: data.companyId,
      companyName: data.companyName,
      location,
      commercialStatus: data.commercialStatus,
      contactName: data.contactName,
      phone: data.phone,
      lastVisitLabel,
      lastOrderLabel,
      openOpportunities: data.opportunities.openCount,
      pipelineValue: data.opportunities.totalValue,
      purchasedProducts,
      interestProducts,
      upsellProducts,
      openFollowUps: data.followUps.length,
      quotesCount,
      ordersCount,
      samplesToRecover,
      openTickets,
      visitCadenceDays,
      suggestions,
      summaryText: lines.join("\n"),
    };

    return successToolResult(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore briefing azienda.";
    return emptyToolResult(emptyBriefing(), message);
  }
}
