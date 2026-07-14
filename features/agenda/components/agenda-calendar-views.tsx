"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { AgendaItem } from "@/lib/constants/agenda";
import { groupAgendaItemsByDay, parseReferenceDate, toDateKey } from "@/lib/agenda/calendar";
import { AgendaItemRow } from "./agenda-item-row";

interface AgendaDayViewProps {
  items: AgendaItem[];
  referenceDate: string;
}

export function AgendaDayView({ items, referenceDate }: AgendaDayViewProps) {
  const dayItems = items.filter((item) => item.scheduledAt.slice(0, 10) === referenceDate);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda del giorno ({dayItems.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {dayItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Nessun appuntamento per questo giorno.
          </p>
        ) : (
          dayItems.map((item) => <AgendaItemRow key={item.id} item={item} />)
        )}
      </CardContent>
    </Card>
  );
}

interface AgendaWeekViewProps {
  items: AgendaItem[];
  referenceDate: string;
}

export function AgendaWeekView({ items, referenceDate }: AgendaWeekViewProps) {
  const grouped = groupAgendaItemsByDay(items);
  const reference = parseReferenceDate(referenceDate);
  const dayOfWeek = (reference.getDay() + 6) % 7;
  const weekStart = new Date(reference);
  weekStart.setDate(reference.getDate() - dayOfWeek);

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });

  return (
    <div className="grid gap-4 lg:grid-cols-7">
      {weekDays.map((day) => {
        const key = toDateKey(day);
        const dayItems = grouped.get(key) ?? [];
        const label = day.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });

        return (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                <Link href={`/agenda?view=day&date=${key}`} className="hover:text-indigo-600">
                  {label}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {dayItems.length === 0 ? (
                <p className="text-xs text-slate-400">—</p>
              ) : (
                dayItems.map((item) => <AgendaItemRow key={item.id} item={item} compact />)
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface AgendaMonthViewProps {
  items: AgendaItem[];
  referenceDate: string;
}

export function AgendaMonthView({ items, referenceDate }: AgendaMonthViewProps) {
  const grouped = groupAgendaItemsByDay(items);
  const reference = parseReferenceDate(referenceDate);
  const month = reference.getMonth();
  const days = (() => {
    const year = reference.getFullYear();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  })();

  const monthLabel = reference.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendario · {monthLabel}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day) => {
            const key = toDateKey(day);
            const dayItems = grouped.get(key) ?? [];
            const inMonth = day.getMonth() === month;

            return (
              <Link
                key={key}
                href={`/agenda?view=day&date=${key}`}
                className={`min-h-24 rounded-lg border p-2 transition-colors hover:border-indigo-200 ${
                  inMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 text-slate-400"
                }`}
              >
                <p className="text-xs font-semibold">{day.getDate()}</p>
                <div className="mt-1 space-y-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <p key={item.id} className="truncate text-[10px] leading-tight">
                      {item.title}
                      {item.companyName ? ` · ${item.companyName}` : ""}
                    </p>
                  ))}
                  {dayItems.length > 3 && (
                    <p className="text-[10px] text-slate-500">+{dayItems.length - 3}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
