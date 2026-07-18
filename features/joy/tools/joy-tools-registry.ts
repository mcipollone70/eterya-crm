/**
 * Typed Joy AI tool registry — names used by chat intents and documentation.
 * Tools are real server modules; this list is the canonical catalog.
 */
export const JOY_READ_TOOLS = [
  "getCompanies",
  "getCompanyById",
  "searchCompanies",
  "getCompanyTimeline",
  "getCompanyBriefing",
  "getAgendaToday",
  "getAgendaTomorrow",
  "getContacts",
  "getVisits",
  "getFollowUps",
  "getOverdueFollowUps",
  "getOpportunities",
  "getStaleOpportunities",
  "getQuotes",
  "getOrders",
  "getProductCatalog",
  "getSamples",
  "getSamplesToRecover",
  "getServiceTickets",
  "getOpenServiceTickets",
  "getVisitTours",
  "getStatistics",
  "getCommercialStatistics",
  "getDailyBriefing",
  "getDailyPlan",
  "getWeeklyBriefing",
  "getEndOfDaySummary",
  "getPipeline",
  "getDocuments",
  "getCommercialCoach",
] as const;

export type JoyReadToolName = (typeof JOY_READ_TOOLS)[number];

export const JOY_WRITE_OPERATIONS = [
  "create_visit",
  "update_visit",
  "complete_visit",
  "cancel_visit",
  "create_follow_up",
  "update_follow_up",
  "create_reminder",
  "create_opportunity",
  "create_quote",
  "create_order",
  "create_sample",
  "create_service_ticket",
  "create_note",
  "navigate",
] as const;

export type JoyWriteOperationName = (typeof JOY_WRITE_OPERATIONS)[number];
