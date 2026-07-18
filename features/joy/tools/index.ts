export {
  getCompanies,
  getCompanyById,
  getCompanyById as getCompanyDetails,
  searchCompanies,
  type JoyCompanyRecord,
  type SearchCompaniesOptions,
} from "./get-companies";
export {
  getAgendaToday,
  getAgendaToday as getTodayAgenda,
  getAgendaTomorrow,
  getAgendaTomorrow as getTomorrowAgenda,
  type JoyAgendaItem,
} from "./get-agenda";
export { getContacts, type JoyContactRecord, type GetContactsOptions } from "./get-contacts";
export { getVisits, type JoyVisitRecord, type GetVisitsOptions } from "./get-visits";
export {
  getFollowUps,
  getOverdueFollowUps,
  type JoyFollowUpRecord,
  type GetFollowUpsOptions,
} from "./get-follow-ups";
export {
  getOpportunities,
  getStaleOpportunities,
  STALE_OPPORTUNITY_DAYS,
  type JoyOpportunityRecord,
  type GetOpportunitiesOptions,
} from "./get-opportunities";
export { getQuotes, type JoyQuoteRecord, type JoyQuotesSnapshot, type GetQuotesOptions } from "./get-quotes";
export { getOrders, type JoyOrdersSnapshot, type GetOrdersOptions } from "./get-orders";
export {
  getProductCatalog,
  getProductCatalog as getProducts,
  type JoyProductCatalogSnapshot,
} from "./get-product-catalog";
export { getSamples, type JoySamplesSnapshot } from "./get-samples";
export {
  getSamplesToRecover,
  type JoySamplesToRecoverSnapshot,
  type JoySampleToRecover,
} from "./get-samples-to-recover";
export { getServiceTickets, type JoyServiceTicketsSnapshot } from "./get-service-tickets";
export {
  getOpenServiceTickets,
  type JoyOpenServiceTicketsSnapshot,
  type JoyOpenServiceTicket,
} from "./get-open-service-tickets";
export { getVisitTours, type GetVisitToursOptions } from "./get-visit-tours";
export { getStatistics, type JoyStatisticsSnapshot } from "./get-statistics";
export {
  getCommercialStatistics,
  type JoyCommercialStatisticsSnapshot,
} from "./get-commercial-statistics";
export {
  getDailyBriefing,
  type JoyDailyBriefing,
  type JoyDailySuggestion,
  type GetDailyBriefingOptions,
} from "./get-daily-briefing";
export {
  getDailyPlan,
  type JoyDailyPlanSnapshot,
} from "./get-daily-plan";
export {
  getWeeklyBriefing,
  getEndOfDaySummary,
  type JoyWeeklyBriefing,
  type JoyEndOfDaySummary,
  type GetWeeklyBriefingOptions,
  type GetEndOfDaySummaryOptions,
} from "./get-weekly-briefing";
export { getPipeline, type JoyPipelineSnapshot, type JoyPipelineStageSnapshot } from "./get-pipeline";
export { getDocuments, type JoyDocumentsSnapshot } from "./get-documents";
export {
  getCompanyBriefing,
  type JoyCompanyBriefingSnapshot,
} from "./get-company-briefing";
export {
  getCompanyTimeline,
  type JoyCompanyTimelineSnapshot,
  type JoyTimelineEvent,
} from "./get-company-timeline";
export {
  getCommercialCoach,
  type JoyCommercialCoachSnapshot,
  type JoyCoachRecommendation,
} from "./get-commercial-coach";
export {
  JOY_READ_TOOLS,
  JOY_WRITE_OPERATIONS,
  type JoyReadToolName,
  type JoyWriteOperationName,
} from "./joy-tools-registry";
export {
  emptyToolResult,
  isMissingTableError,
  successToolResult,
  type JoyToolResult,
} from "./types";

export const JOY_INSUFFICIENT_DATA_MESSAGE =
  "Non riesco a leggere correttamente i dati del CRM";
