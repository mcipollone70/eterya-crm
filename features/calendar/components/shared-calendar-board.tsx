import Link from "next/link";
import { AGENDA_KIND_COLORS, AGENDA_KIND_LABELS, type AgendaItem } from "@/lib/constants/agenda";

interface SharedCalendarBoardProps {
  items: AgendaItem[];
}

const AGENT_DOT_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-lime-500",
];

function agentColor(index: number): string {
  return AGENT_DOT_COLORS[index % AGENT_DOT_COLORS.length];
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatDayHeading(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

function itemHref(item: AgendaItem): string {
  if (item.kind === "visit" && item.companyId) {
    return `/visits?company=${item.companyId}`;
  }
  if (item.companyId) {
    return `/companies/${item.companyId}`;
  }
  return "/agenda";
}

export function SharedCalendarBoard({ items }: SharedCalendarBoardProps) {
  const agentIndex = new Map<string, number>();
  for (const item of items) {
    if (!agentIndex.has(item.userId)) {
      agentIndex.set(item.userId, agentIndex.size);
    }
  }

  const agentLegend = [...agentIndex.entries()]
    .map(([userId, index]) => {
      const name = items.find((item) => item.userId === userId)?.operatorName ?? "Agente";
      return { userId, name, index };
    })
    .filter((entry) => entry.name);

  const grouped = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const key = dayKey(item.scheduledAt);
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }

  const days = [...grouped.keys()].sort();

  return (
    <div className="space-y-5">
      {agentLegend.length > 0 && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          {agentLegend.map((entry) => (
            <span key={entry.userId} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-full ${agentColor(entry.index)}`} />
              {entry.name}
            </span>
          ))}
        </div>
      )}

      {days.map((day) => {
        const dayItems = grouped.get(day) ?? [];
        return (
          <div key={day} className="space-y-2">
            <h3 className="text-sm font-semibold capitalize text-slate-900">
              {formatDayHeading(day)}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {dayItems.length} appuntamenti
              </span>
            </h3>
            <ul className="space-y-2">
              {dayItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={itemHref(item)}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${agentColor(
                        agentIndex.get(item.userId) ?? 0
                      )}`}
                    />
                    <span className="w-12 shrink-0 text-xs font-medium tabular-nums text-slate-500">
                      {formatTime(item.scheduledAt)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {item.companyName ?? "—"}
                        {item.operatorName ? ` · ${item.operatorName}` : ""}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        AGENDA_KIND_COLORS[item.kind]
                      }`}
                    >
                      {AGENDA_KIND_LABELS[item.kind]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
