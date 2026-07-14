import { AgendaPage } from "@/features/agenda";
import {
  isAgendaKindFilter,
  isAgendaStatusFilter,
  isAgendaView,
} from "@/lib/constants/agenda";

export const metadata = { title: "Agenda" };

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    agent?: string;
    kind?: string;
    status?: string;
  }>;
}) {
  const { view, date, agent, kind, status } = await searchParams;

  return (
    <AgendaPage
      view={isAgendaView(view) ? view : undefined}
      date={date}
      agent={agent}
      kind={isAgendaKindFilter(kind) ? kind : undefined}
      status={isAgendaStatusFilter(status) ? status : undefined}
    />
  );
}
