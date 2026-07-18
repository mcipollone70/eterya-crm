export type PipelinePriorityFilter = "high" | "medium" | "low";

export interface PipelineFilters {
  agentId?: string;
  companyId?: string;
  priority?: PipelinePriorityFilter;
  dateFrom?: string;
  dateTo?: string;
}

export const PIPELINE_PRIORITY_OPTIONS: Array<{
  value: PipelinePriorityFilter | "";
  label: string;
}> = [
  { value: "", label: "Tutte le priorità" },
  { value: "high", label: "Alta (≥70%)" },
  { value: "medium", label: "Media (40–69%)" },
  { value: "low", label: "Bassa (<40%)" },
];

const PRIORITY_SET = new Set<string>(["high", "medium", "low"]);

export function isPipelinePriorityFilter(
  value: string | undefined
): value is PipelinePriorityFilter {
  return value != null && PRIORITY_SET.has(value);
}

function isIsoDate(value: string | undefined): value is string {
  return value != null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parsePipelineFilters(input: {
  agent?: string;
  company?: string;
  priority?: string;
  from?: string;
  to?: string;
}): PipelineFilters {
  const filters: PipelineFilters = {};

  if (input.agent?.trim()) {
    filters.agentId = input.agent.trim();
  }

  if (input.company?.trim()) {
    filters.companyId = input.company.trim();
  }

  if (isPipelinePriorityFilter(input.priority)) {
    filters.priority = input.priority;
  }

  if (isIsoDate(input.from)) {
    filters.dateFrom = input.from;
  }

  if (isIsoDate(input.to)) {
    filters.dateTo = input.to;
  }

  return filters;
}

export function matchesPipelinePriority(
  probability: number | null,
  priority: PipelinePriorityFilter
): boolean {
  const value = probability ?? 0;
  if (priority === "high") {
    return value >= 70;
  }
  if (priority === "medium") {
    return value >= 40 && value < 70;
  }
  return value < 40;
}
