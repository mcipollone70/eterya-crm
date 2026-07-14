"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, ListEmptyState } from "@/components/ui";
import type { AgendaItem } from "@/lib/constants/agenda";
import { groupAgendaItemsByDay, parseReferenceDate, toDateKey } from "@/lib/agenda/calendar";
import { AgendaItemRow } from "./agenda-item-row";

interface AgendaDayViewProps {
  items: AgendaItem[];
  referenceDate: string;
  calendarSyncStatuses?: Record<string, string>;
}

export function AgendaDayView({
  items,
  referenceDate,
  calendarSyncStatuses = {},
}: AgendaDayViewProps) {
  const dayItems = items.filter((item) => item.scheduledAt.slice(0, 10) === referenceDate);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda del giorno ({dayItems.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {dayItems.length === 0 ? (
          <ListEmptyState
            icon={CalendarDays}
            title="Nessun appuntamento per questo giorno"
            message="Pianifica una visita, un follow-up o un promemoria con il pulsante Nuovo."
          />
        ) : (
          dayItems.map((item) => (
            <AgendaItemRow
              key={item.id}
              item={item}
              calendarSyncStatus={calendarSyncStatuses[item.id]}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface AgendaWeekViewProps {
  items: AgendaItem[];
  referenceDate: string;
  calendarSyncStatuses?: Record<string, string>;
}

export function AgendaWeekView({
  items,
  referenceDate,
  calendarSyncStatuses = {},
}: AgendaWeekViewProps) {
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
    <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory lg:grid lg:grid-cols-7 lg:overflow-visible lg:pb-0">
      {weekDays.map((day) => {
        const key = toDateKey(day);
        const dayItems = grouped.get(key) ?? [];
        const label = day.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });

        return (
          <Card key={key} className="min-w-[260px] shrink-0 snap-start lg:min-w-0">
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
                dayItems.map((item) => (
                  <AgendaItemRow
                    key={item.id}
                    item={item}
                    compact
                    calendarSyncStatus={calendarSyncStatuses[item.id]}
                  />
                ))
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
  calendarSyncStatuses?: Record<string, string>;
}

function AgendaMonthList({
  items,
  referenceDate,
  calendarSyncStatuses = {},
}: AgendaMonthViewProps) {
  const grouped = groupAgendaItemsByDay(items);
  const reference = parseReferenceDate(referenceDate);
  const month = reference.getMonth();
  const year = reference.getFullYear();
  const monthLabel = reference.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  const daysWithItems = Array.from(grouped.entries())
    .filter(([key]) => {
      const d = new Date(`${key}T12:00:00`);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <Card className="sm:hidden">
      <CardHeader>
        <CardTitle>{monthLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {daysWithItems.length === 0 ? (
          <ListEmptyState
            icon={CalendarDays}
            title="Nessun appuntamento questo mese"
            message="Tocca un giorno nel calendario desktop o crea un nuovo appuntamento."
          />
        ) : (
          daysWithItems.map(([key, dayItems]) => (
            <div key={key}>
              <Link
                href={`/agenda?view=day&date=${key}`}
                className="mb-2 block text-sm font-semibold text-indigo-600"
              >
                {new Date(`${key}T12:00:00`).toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </Link>
              <div className="space-y-2">
                {dayItems.map((item) => (
                  <AgendaItemRow
                    key={item.id}
                    item={item}
                    compact
                    calendarSyncStatus={calendarSyncStatuses[item.id]}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function AgendaMonthView({
  items,
  referenceDate,
  calendarSyncStatuses = {},
}: AgendaMonthViewProps) {
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
    <>
      <AgendaMonthList
        items={items}
        referenceDate={referenceDate}
        calendarSyncStatuses={calendarSyncStatuses}
      />

      <Card className="hidden sm:block">
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
                  className={`min-h-20 rounded-lg border p-2 transition-colors hover:border-indigo-200 md:min-h-24 ${
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
    </>
  );
}
