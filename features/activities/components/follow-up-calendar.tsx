"use client";

import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { CONTACT_HISTORY_TYPE_LABELS } from "@/lib/constants/contact-history";
import { isContactHistoryType } from "@/lib/constants/contact-history";
import { groupFollowUpsByDay } from "@/lib/follow-up/calendar";
import type { FollowUpListItem } from "../services/follow-ups.service";

interface FollowUpCalendarProps {
  items: FollowUpListItem[];
}

function buildMonthDays(reference = new Date()): Date[] {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const days: Date[] = [];

  for (let index = 0; index < 42; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    days.push(day);
  }

  return days;
}

export function FollowUpCalendar({ items }: FollowUpCalendarProps) {
  const today = new Date();
  const days = buildMonthDays(today);
  const grouped = groupFollowUpsByDay(items);
  const monthLabel = today.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendario follow-up · {monthLabel}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day) => {
            const key = day.toISOString().slice(0, 10);
            const dayItems = grouped.get(key) ?? [];
            const inMonth = day.getMonth() === today.getMonth();

            return (
              <div
                key={key}
                className={`min-h-24 rounded-lg border p-2 ${
                  inMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 text-slate-400"
                }`}
              >
                <p className="text-xs font-semibold">{day.getDate()}</p>
                <div className="mt-1 space-y-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <Link
                      key={item.id}
                      href={`/companies/${item.company_id}`}
                      className="block rounded bg-indigo-50 px-1.5 py-1 text-[10px] leading-tight text-indigo-800 hover:bg-indigo-100"
                    >
                      <span className="font-medium">
                        {isContactHistoryType(item.activity_type)
                          ? CONTACT_HISTORY_TYPE_LABELS[item.activity_type]
                          : item.activity_type}
                      </span>
                      {item.company_name ? ` · ${item.company_name}` : ""}
                    </Link>
                  ))}
                  {dayItems.length > 3 && (
                    <p className="text-[10px] text-slate-500">+{dayItems.length - 3} altri</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
