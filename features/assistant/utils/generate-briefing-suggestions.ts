import { daysSince } from "@/lib/commercial-priority/is-excluded";
import { PRODUCT_FAMILY_LABELS, type ProductFamily } from "@/lib/constants/product-catalog";
import type { CompanyVisitBriefing } from "@/lib/commercial-assistant/types";

type BriefingSuggestionInput = Omit<CompanyVisitBriefing, "aiSuggestions">;

function hasNeverPurchasedFamily(
  briefing: BriefingSuggestionInput,
  family: ProductFamily
): boolean {
  const label = PRODUCT_FAMILY_LABELS[family];
  const purchasedFamilies = new Set(briefing.products.purchased.map((item) => item.family));
  if (!purchasedFamilies.has(label)) {
    return briefing.products.neverPurchased.some((item) => item.family === label);
  }
  return false;
}

function hasHighInterestInFamily(briefing: BriefingSuggestionInput, family: ProductFamily): boolean {
  const label = PRODUCT_FAMILY_LABELS[family];
  return briefing.products.interests.some(
    (item) => item.family === label && item.level === "high"
  );
}

export function generateBriefingSuggestions(briefing: BriefingSuggestionInput): string[] {
  const suggestions: string[] = [];
  const visitDays = daysSince(briefing.lastVisit.at);
  const isClient = briefing.commercialStatus.toLowerCase().includes("cliente");

  if (hasNeverPurchasedFamily(briefing, "vepa")) {
    suggestions.push("Proponi VEPA.");
  }

  if (isClient && visitDays !== null && visitDays >= 180) {
    suggestions.push(`Cliente inattivo da ${visitDays} giorni.`);
  } else if (isClient && visitDays !== null && visitDays >= 90) {
    suggestions.push(`Cliente inattivo da ${visitDays} giorni — chiedi aggiornamento showroom.`);
  } else if (visitDays !== null && visitDays >= 90) {
    suggestions.push("Chiedi aggiornamento showroom.");
  }

  if (hasNeverPurchasedFamily(briefing, "tapparelle")) {
    suggestions.push("Presenta nuova tapparella.");
  }

  if (
    hasNeverPurchasedFamily(briefing, "zanzariere") ||
    hasHighInterestInFamily(briefing, "zanzariere")
  ) {
    suggestions.push("Verifica interesse zanzariere.");
  }

  if (briefing.followUps.length > 0) {
    suggestions.push(
      `${briefing.followUps.length} follow-up aperti — conferma prossimi passi in visita.`
    );
  }

  if (briefing.opportunities.openCount > 0) {
    const hot = briefing.opportunities.items.find(
      (item) => item.probability != null && item.probability >= 70
    );
    if (hot) {
      suggestions.push(`Opportunità calda: ${hot.title}.`);
    } else {
      suggestions.push(
        `${briefing.opportunities.openCount} opportunità aperte — porta avanti la trattativa.`
      );
    }
  }

  if (briefing.products.interests.length > 0) {
    const topInterest = briefing.products.interests.find((item) => item.level === "high");
    if (topInterest) {
      suggestions.push(`Interesse elevato per ${topInterest.name} (${topInterest.family}).`);
    }
  }

  if (!briefing.lastVisit.at) {
    suggestions.push("Prima visita registrata — presenta l'offerta completa.");
  }

  if (briefing.commercialStatus.toLowerCase().includes("da ricontattare")) {
    suggestions.push("Cliente da ricontattare — riapri la conversazione con un obiettivo chiaro.");
  }

  if (suggestions.length === 0) {
    suggestions.push("Conferma esigenze attuali e proponi il prossimo passo commerciale.");
  }

  return [...new Set(suggestions)].slice(0, 6);
}
