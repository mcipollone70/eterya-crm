"use server";

import { listAgendaItems } from "@/features/agenda/services/agenda.service";
import { getVisitTourCompaniesByIds } from "../services/visit-tour-data.service";
import type { VisitTourAgendaOption } from "../types/visit-tour";

export async function fetchAgendaAppointmentsForTourAction(
  tourDate: string
): Promise<{ data: VisitTourAgendaOption[]; error: string | null }> {
  const result = await listAgendaItems({
    view: "day",
    date: tourDate,
    agentId: null,
    kind: "",
    status: "open",
  });

  if (result.error) {
    return { data: [], error: result.error };
  }

  const companyIds = [
    ...new Set(
      result.data
        .map((item) => item.companyId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const companiesResult = await getVisitTourCompaniesByIds(companyIds);
  const companyById = new Map(companiesResult.data.map((company) => [company.id, company]));

  const options: VisitTourAgendaOption[] = result.data
    .filter((item) => item.companyId)
    .map((item) => {
      const company = item.companyId ? companyById.get(item.companyId) : undefined;
      const scheduledLabel = new Date(item.scheduledAt).toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        id: item.id,
        label: `${item.title} · ${item.companyName ?? "Azienda"} · ${scheduledLabel}`,
        scheduledAt: item.scheduledAt,
        companyId: item.companyId,
        companyName: item.companyName,
        lat: company?.latitude ?? null,
        lng: company?.longitude ?? null,
      };
    });

  return { data: options, error: null };
}

export async function fetchNextActivitiesForCompaniesAction(companyIds: string[]): Promise<{
  data: Record<string, string>;
  error: string | null;
}> {
  const uniqueIds = [...new Set(companyIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { data: {}, error: null };
  }

  const { createServerClient } = await import("@/lib/supabase/server");
  const { describeDbError } = await import("@/lib/supabase/errors");
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("follow_ups")
    .select("company_id,scheduled_at,postponed_to,status")
    .in("company_id", uniqueIds)
    .in("status", ["todo", "postponed"])
    .order("scheduled_at", { ascending: true });

  if (error) {
    return { data: {}, error: describeDbError(error) };
  }

  const nextByCompany: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!row.company_id || nextByCompany[row.company_id]) {
      continue;
    }

    const effectiveAt =
      row.status === "postponed" && row.postponed_to
        ? row.postponed_to
        : row.scheduled_at;

    if (effectiveAt) {
      nextByCompany[row.company_id] = effectiveAt;
    }
  }

  return { data: nextByCompany, error: null };
}
