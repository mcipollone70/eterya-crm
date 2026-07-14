import type { JoyAutonomousDecision } from "@/features/joy/autonomous/types/joy-autonomous";
import type { CommandCenterDecision } from "../types/command-center";

const TIME_BY_ICON: Record<JoyAutonomousDecision["icon"], number> = {
  visit: 45,
  follow_up: 15,
  reminder: 10,
  route: 30,
  agenda: 10,
  briefing: 20,
  call: 10,
  navigate: 5,
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours} h ${remainder} min` : `${hours} h`;
}

export function buildCommandCenterDecisions(
  decisions: JoyAutonomousDecision[]
): CommandCenterDecision[] {
  return decisions.map((decision) => ({
    ...decision,
    estimatedTimeLabel: formatMinutes(TIME_BY_ICON[decision.icon] ?? 15),
  }));
}
