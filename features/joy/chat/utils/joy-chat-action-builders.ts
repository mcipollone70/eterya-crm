import { buildGoogleMapsDirectionsUrl } from "@/features/maps/utils/map-filters";
import type { JoyChatActionButton } from "../types/joy-chat";

export interface JoyCompanyActionSource {
  id: string;
  name: string;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function buildCompanyChatActions(
  company: JoyCompanyActionSource,
  prefix: string
): JoyChatActionButton[] {
  const actions: JoyChatActionButton[] = [
    {
      id: `${prefix}-open`,
      kind: "open_company",
      label: "Apri azienda",
      href: `/companies/${company.id}`,
    },
    {
      id: `${prefix}-plan`,
      kind: "plan_visit",
      label: "Pianifica visita",
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
      label: "Follow-up",
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
