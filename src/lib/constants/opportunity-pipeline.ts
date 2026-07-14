export const OPPORTUNITY_STAGES = [
  "new",
  "contact_started",
  "site_visit",
  "quote_sent",
  "negotiation",
  "won",
  "lost",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  new: "Nuova",
  contact_started: "Contatto avviato",
  site_visit: "Sopralluogo",
  quote_sent: "Preventivo inviato",
  negotiation: "Trattativa",
  won: "Vinta",
  lost: "Persa",
};

export const OPPORTUNITY_STAGE_OPTIONS = OPPORTUNITY_STAGES.map((value) => ({
  value,
  label: OPPORTUNITY_STAGE_LABELS[value],
}));

export const OPEN_OPPORTUNITY_STAGES: OpportunityStage[] = [
  "new",
  "contact_started",
  "site_visit",
  "quote_sent",
  "negotiation",
];

export const CLOSED_WON_STAGE: OpportunityStage = "won";
export const CLOSED_LOST_STAGE: OpportunityStage = "lost";

const STAGE_SET = new Set<string>(OPPORTUNITY_STAGES);

export function isOpportunityStage(value: string | undefined): value is OpportunityStage {
  return value != null && STAGE_SET.has(value);
}

export function isOpenOpportunityStage(stage: OpportunityStage): boolean {
  return OPEN_OPPORTUNITY_STAGES.includes(stage);
}

export function formatOpportunityAmount(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
