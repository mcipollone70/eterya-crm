import { buildGoogleMapsDirectionsUrl } from "@/features/maps/utils/map-filters";
import type { JoyChatActionButton } from "../types/joy-chat";

export interface JoyCompanyActionSource {
  id: string;
  name: string;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Continues the Joy conversation with an operational prompt (no CRM page lecture). */
export function buildJoyPromptAction(
  id: string,
  label: string,
  prompt: string
): JoyChatActionButton {
  return {
    id,
    kind: "open_page",
    label,
    href: `/joy-ai?q=${encodeURIComponent(prompt)}`,
  };
}

export function buildCompanyChatActions(
  company: JoyCompanyActionSource,
  prefix: string
): JoyChatActionButton[] {
  const shortName =
    company.name.length > 22 ? `${company.name.slice(0, 20)}…` : company.name;
  const actions: JoyChatActionButton[] = [
    {
      id: `${prefix}-open`,
      kind: "open_company",
      label: `Scheda ${shortName}`,
      href: `/companies/${company.id}`,
    },
    {
      id: `${prefix}-plan`,
      kind: "plan_visit",
      label: "Prepara visita",
      href: `/visits?company=${company.id}`,
    },
    {
      id: `${prefix}-briefing`,
      kind: "briefing",
      label: "Briefing",
      href: `/visits?company=${company.id}&briefing=${company.id}`,
    },
    {
      id: `${prefix}-followup`,
      kind: "follow_up",
      label: "Prepara richiamo",
      href: `/activities?section=followups&fcompany=${company.id}`,
    },
  ];

  if (company.phone) {
    actions.splice(2, 0, {
      id: `${prefix}-call`,
      kind: "call",
      label: "Chiama",
      href: `tel:${company.phone.replace(/\s+/g, "")}`,
    });
  }

  if (company.latitude != null && company.longitude != null) {
    actions.splice(company.phone ? 3 : 2, 0, {
      id: `${prefix}-nav`,
      kind: "navigate",
      label: "Naviga",
      href: buildGoogleMapsDirectionsUrl(company.latitude, company.longitude),
      external: true,
    });
  }

  return actions;
}

export function buildPageAction(
  id: string,
  label: string,
  href: string
): JoyChatActionButton {
  return {
    id,
    kind: "open_page",
    label,
    href,
  };
}
