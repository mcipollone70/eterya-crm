export { JoyPage } from "./joy-page";
export { JoyAiPage } from "./joy-ai-page";
export { JoyDrivePage } from "./joy-drive-page";
export { JoyChatPage } from "./joy-chat-page";
export { JoyAutonomousPage } from "./joy-autonomous-page";

/** Joy OS — commercial operating system facade (server). */
export {
  JOY_OS_VERSION,
  JOY_OS_PRINCIPLES,
  JOY_OS_MUTATION_POLICY,
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
} from "./os/joy-os";
