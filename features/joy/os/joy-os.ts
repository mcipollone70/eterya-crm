/**
 * Joy OS — single facade for the commercial operating system.
 *
 * Agent speaks → Joy observes CRM → reasons → proposes → confirms mutations.
 * Never invents. Never auto-saves. Always advises ("Ti consiglio questo").
 *
 * Consumers MUST prefer this barrel / joy-runtime over deep engine imports.
 */

import "server-only";

export { JOY_OS_VERSION, JOY_OS_PRINCIPLES } from "./joy-os-version";

export {
  runJoyOsReasoning,
  runJoyOsStrategy,
  runJoyOsPlan,
  runJoyOsSellMoreToday,
  runJoyOsRadar,
  runJoyOsCoach,
  runJoyOsLearning,
  runJoyOsSimulation,
  runJoyOsFreeTime,
  getJoyCommandCenterSnapshot,
  buildJoyOsFallbackNarrative,
} from "./joy-runtime";

export {
  parseJoyIntent,
  parseJoyStrategyRequest,
  isAgentLearningIntent,
  type JoyIntent,
} from "./intents/joy-intent-router";

export {
  decisionsFromProposals,
  decisionsFromCoach,
  mergeJoyDecisions,
  topDecisionNarrative,
  buildRecommendedPrompt,
  formatDecisionTransparency,
} from "./decision/joy-decision-engine";

export {
  buildContradictionFromDecision,
  evaluateAgentOverrideRequest,
  formatContradiction,
  applyCautionHeuristics,
} from "./decision/joy-contradiction";

export {
  buildProactiveInterventions,
  proactiveChipsFromInterventions,
} from "./suggestions/joy-proactive-engine";

export {
  buildJoyStrategyInsight,
  formatStrategyInsight,
} from "./strategy/joy-strategy-engine";

export { buildJoyAgentLearning } from "./learning/joy-learning-engine";

export { runJoyPlanner, resolvePlanHorizon } from "./planner/joy-planner";

export {
  buildSellMoreTodayPlan,
  formatSellMoreTodayDetail,
} from "./planner/joy-sell-more-today";

export { runJoyCoaching } from "./coaching/joy-coaching";

export {
  buildCommercialRadar,
  buildRadarFromObserveContext,
  JOY_RADAR_MAX,
} from "./radar/joy-commercial-radar";

export {
  parseJoySimulationRequest,
  runJoySimulation,
  formatJoySimulation,
  type JoySimulationScenario,
  type JoySimulationResult,
} from "./simulations/joy-simulation-engine";

export {
  JOY_READ_TOOLS,
  JOY_WRITE_OPERATIONS,
  JOY_INSUFFICIENT_DATA_MESSAGE,
  JOY_OS_MUTATION_POLICY,
} from "./tools/joy-tools-facade";

export {
  createJoyOsError,
  formatJoyOsError,
  joySafeLog,
  type JoyOsError,
  type JoyErrorCode,
} from "./logging/joy-safe-logger";

export type {
  JoyOsPhase,
  JoyOsTrigger,
  JoyOsDecision,
  JoyProactiveIntervention,
  JoyStrategyRequest,
  JoyStrategyInsight,
  JoyAgentLearningSnapshot,
  JoyLongTermMemory,
  JoyOsObserveContext,
  JoyOsReasoningResult,
  JoyDecisionUrgency,
  JoyDecisionConfidence,
  JoyDecisionStance,
  JoyCommandCenterCard,
  JoyCommandCenterFreeTimeItem,
  JoyCommandCenterStrategyChip,
  JoyCommandCenterSnapshot,
} from "./types";
