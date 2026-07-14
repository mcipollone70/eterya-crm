import { getFollowUpEffectiveDate } from "@/lib/constants/follow-up";

export interface FollowUpCalendarItem {
  id: string;
  company_id: string;
  company_name: string | null;
  activity_type: string;
  status: string;
  scheduled_at: string;
  postponed_to: string | null;
}

export function groupFollowUpsByDay(
  items: FollowUpCalendarItem[]
): Map<string, FollowUpCalendarItem[]> {
  const groups = new Map<string, FollowUpCalendarItem[]>();

  for (const item of items) {
    const dayKey = getFollowUpEffectiveDate({
      status: item.status as "todo" | "completed" | "postponed" | "cancelled",
      scheduled_at: item.scheduled_at,
      postponed_to: item.postponed_to,
    }).slice(0, 10);
    const current = groups.get(dayKey) ?? [];
    current.push(item);
    groups.set(dayKey, current);
  }

  return groups;
}
