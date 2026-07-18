/** Opportunities module — pipeline commerciale. */
export const OPPORTUNITIES_MODULE = "opportunities" as const;

export { OpportunitiesPage } from "./opportunities-page";
export {
  saveOpportunityAction,
  updateOpportunityStageAction,
  updateOpportunityAction,
  deleteOpportunityAction,
  closeOpportunityAction,
} from "./actions/opportunity-actions";
export {
  listOpportunities,
  getCompanyOpportunitySummary,
  getOpportunityDashboardMetrics,
  getOpportunityById,
  listOpportunityStageHistory,
  saveOpportunity,
  updateOpportunity,
  updateOpportunityStage,
  deleteOpportunity,
  listPipelineFilterOptions,
  type OpportunityListItem,
  type OpportunityStageHistoryItem,
  type OpportunityDashboardMetrics,
} from "./services/opportunities.service";
