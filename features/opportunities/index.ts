/** Opportunities module — pipeline commerciale. */
export const OPPORTUNITIES_MODULE = "opportunities" as const;

export { OpportunitiesPage } from "./opportunities-page";
export {
  saveOpportunityAction,
  updateOpportunityStageAction,
} from "./actions/opportunity-actions";
export {
  listOpportunities,
  getCompanyOpportunitySummary,
  getOpportunityDashboardMetrics,
  saveOpportunity,
  updateOpportunityStage,
  type OpportunityListItem,
  type OpportunityDashboardMetrics,
} from "./services/opportunities.service";
