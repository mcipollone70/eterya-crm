export const dynamic = "force-dynamic";

import { SharedCalendarPage } from "@/features/calendar";

export const metadata = { title: "Calendario condiviso" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; kind?: string; date?: string }>;
}) {
  const { agent, kind, date } = await searchParams;

  return <SharedCalendarPage agent={agent} kind={kind} date={date} />;
}
