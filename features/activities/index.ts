/** Activities module — storico contatti e follow-up. */
export const ACTIVITIES_MODULE = "activities" as const;

export { ActivitiesPage } from "./activities-page";
export { saveContactHistoryAction } from "./actions/contact-history-actions";
export {
  saveFollowUpAction,
  completeFollowUpAction,
  postponeFollowUpAction,
  cancelFollowUpAction,
} from "./actions/follow-up-actions";
export {
  listContactHistory,
  listContactHistoryOperators,
  listRecentContactHistory,
  getContactHistoryDashboardMetrics,
  saveContactHistoryActivity,
  type ContactHistoryItem,
  type ContactHistoryDashboardMetrics,
} from "./services/contact-history.service";
export {
  listFollowUps,
  listFollowUpCompanyOptions,
  getFollowUpDashboardMetrics,
  saveFollowUp,
  completeFollowUp,
  postponeFollowUp,
  type FollowUpListItem,
  type FollowUpDashboardMetrics,
} from "./services/follow-ups.service";
