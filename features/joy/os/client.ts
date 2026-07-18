/**
 * Joy OS — client-safe exports (localStorage memory + pure helpers).
 */

export {
  loadJoyLongTermMemory,
  persistJoyLongTermMemory,
  mergeJoyLongTermMemory,
  recordJoyPromise,
  recordJoySuccess,
  recordJoyError,
  upsertJoyClientNote,
  markJoyDayStart,
  markJoyDayEnd,
  formatLongMemoryBrief,
  EMPTY_JOY_LONG_MEMORY,
} from "./memory/joy-long-memory";

export {
  loadJoyDayOps,
  persistJoyDayOps,
  clearJoyDayOps,
  patchJoyDayOps,
  upsertJoyDayOpsSlot,
  markJoyDayEarlyFinish,
  recordJoyDayCancellation,
  setJoyDayFreeMinutes,
  setJoyDayPosition,
  setJoyDayNextAction,
  recordJoyDayOverride,
  formatJoyDayOpsBrief,
  emptyJoyDayOps,
  todayDayKey,
  type JoyDayOpsState,
  type JoyDayOpsSlot,
} from "./memory/joy-day-ops-memory";

export {
  buildProactiveInterventions,
  proactiveChipsFromInterventions,
} from "./suggestions/joy-proactive-engine";

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
