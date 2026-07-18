import "server-only";

import { getDistanceKm } from "@/features/maps/utils/geo-distance";
import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { createServerClient } from "@/lib/supabase/server";
import { buildUnifiedCommercialProposals } from "./joy-commercial-proposals.service";

export interface JoyFreeTimeSlotItem {
  kind: "call" | "visit" | "nearby" | "follow_up" | "sample";
  estimatedMinutes: number;
  companyId?: string | null;
  companyName?: string | null;
  reason: string;
  distanceKm?: number | null;
}

export interface JoyFreeTimeFillResult {
  freeMinutes: number;
  usedMinutes: number;
  items: JoyFreeTimeSlotItem[];
  summaryText: string;
}

function estimateMinutesForProposalKind(
  kind: string
): { minutes: number; slotKind: JoyFreeTimeSlotItem["kind"] } {
  switch (kind) {
    case "urgent_follow_up":
    case "client_call":
    case "quote_followup":
      return { minutes: 15, slotKind: "call" };
    case "sample_recovery":
      return { minutes: 25, slotKind: "sample" };
    case "nearby_visit":
      return { minutes: 35, slotKind: "nearby" };
    case "prospect":
    case "stale_opportunity":
      return { minutes: 40, slotKind: "visit" };
    default:
      return { minutes: 20, slotKind: "follow_up" };
  }
}

/**
 * Riempie uno slot libero (es. «ho due ore libere») con azioni CRM reali
 * basate su proposte commerciali + aziende vicine al GPS. Nessuna mutazione.
 */
export async function buildFreeTimeFill(options: {
  userId: string | null;
  freeMinutes: number;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<JoyFreeTimeFillResult> {
  const freeMinutes = Math.max(30, Math.min(480, Math.round(options.freeMinutes)));
  const items: JoyFreeTimeSlotItem[] = [];
  let usedMinutes = 0;

  const proposals = await buildUnifiedCommercialProposals({
    userId: options.userId,
    latitude: options.latitude,
    longitude: options.longitude,
    limit: 16,
  });

  for (const proposal of proposals) {
    const { minutes, slotKind } = estimateMinutesForProposalKind(proposal.kind);
    if (usedMinutes + minutes > freeMinutes) {
      continue;
    }
    items.push({
      kind: slotKind,
      estimatedMinutes: minutes,
      companyId: proposal.companyId,
      companyName: proposal.companyName,
      reason: proposal.text.replace(/\*\*/g, ""),
    });
    usedMinutes += minutes;
    if (usedMinutes >= freeMinutes * 0.9) {
      break;
    }
  }

  if (
    usedMinutes < freeMinutes * 0.6 &&
    options.latitude != null &&
    options.longitude != null &&
    Number.isFinite(options.latitude) &&
    Number.isFinite(options.longitude)
  ) {
    const supabase = await createServerClient();
    let query = supabase
      .from("companies")
      .select("id,name,city,commercial_status,latitude,longitude,last_visit_at")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .in("commercial_status", ["prospect", "cliente"])
      .limit(80);

    if (options.userId) {
      query = applyAgentCompanyScope(query, options.userId);
    }

    const { data } = await query;
    const nearby = (data ?? [])
      .map((row) => {
        const distanceKm = getDistanceKm(
          options.latitude!,
          options.longitude!,
          Number(row.latitude),
          Number(row.longitude)
        );
        return { ...row, distanceKm };
      })
      .filter((row) => Number.isFinite(row.distanceKm) && row.distanceKm <= 25)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    for (const row of nearby) {
      if (items.some((item) => item.companyId === row.id)) {
        continue;
      }
      const minutes = row.commercial_status === "prospect" ? 35 : 40;
      if (usedMinutes + minutes > freeMinutes) {
        continue;
      }
      items.push({
        kind: "nearby",
        estimatedMinutes: minutes,
        companyId: row.id,
        companyName: row.name,
        distanceKm: Math.round(row.distanceKm * 10) / 10,
        reason: `${row.commercial_status === "prospect" ? "Prospect" : "Cliente"} vicino${
          row.city ? ` · ${row.city}` : ""
        } a ${row.distanceKm.toFixed(1)} km.`,
      });
      usedMinutes += minutes;
      if (usedMinutes >= freeMinutes * 0.9) {
        break;
      }
    }
  }

  const hoursLabel =
    freeMinutes % 60 === 0
      ? `${freeMinutes / 60} or${freeMinutes / 60 === 1 ? "a" : "e"}`
      : `${freeMinutes} minuti`;

  if (items.length === 0) {
    return {
      freeMinutes,
      usedMinutes: 0,
      items: [],
      summaryText: [
        `**Radar commerciale — ${hoursLabel} libere**`,
        "",
        "Non ho trovato azioni CRM adatte a riempire lo slot con i dati disponibili (follow-up, prospect, visite vicine).",
        "Dimmi una zona (es. Latina) o «Coach commerciale» e riprovo con altri segnali CRM.",
      ].join("\n"),
    };
  }

  const lines = items.map(
    (item, index) =>
      `${index + 1}. **${item.companyName ?? "Azione"}** (~${item.estimatedMinutes} min) — ${item.reason}${
        item.distanceKm != null ? ` · ${item.distanceKm} km` : ""
      }`
  );

  return {
    freeMinutes,
    usedMinutes,
    items,
    summaryText: [
      `**Radar commerciale — ${hoursLabel} libere**`,
      `Piano proposto: **${items.length} azioni** · ~**${usedMinutes} min** su ${freeMinutes} disponibili (dati CRM reali, nessuna azione automatica).`,
      "",
      ...lines,
      "",
      "Di' «organizza il giro» per trasformare le visite in percorso, «prepara chiamata [cliente]» o «briefing [cliente]». Conferma sempre prima di salvare.",
    ].join("\n"),
  };
}
