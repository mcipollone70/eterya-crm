/** Visits module — visite pianificate ed eseguite. */
export const VISITS_MODULE = "visits" as const;

export { VisitsPage } from "./visits-page";
export {
  saveVisitAction,
  scheduleVisitAction,
  completeScheduledVisitAction,
} from "./actions/visit-mutations";
export {
  listVisits,
  listVisitsByCompany,
  listVisitCompanyOptions,
  saveCompletedVisit,
  scheduleVisit,
  completeScheduledVisit,
  getVisitDashboardMetrics,
  type VisitListItem,
  type VisitDashboardMetrics,
  type VisitCompanyOption,
} from "./services/visits.service";
