import "server-only";

import { getDistanceKm, formatDistanceKm } from "@/features/maps/utils/geo-distance";
import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { getCompanyConfig } from "@/features/company-config/services/company-config.service";
import { listAgendaItems } from "@/features/agenda/services/agenda.service";
import { fetchVisitTourOptimizeContext } from "@/features/routes/services/visit-tour-optimize.service";
import { buildGoogleMapsTourUrl } from "@/features/routes/utils/google-maps-tour-url";
import { fetchDrivingRouteLegs } from "@/features/routes/utils/osrm-routing";
import { escapeIlikePattern } from "@/features/search/utils/escape-ilike";
import { optimizeVisitTour } from "@/lib/visit-tour/optimize";
import type { VisitTourOptimizePlan, VisitTourOptimizeStop } from "@/lib/visit-tour/optimize";
import { VISIT_TOUR_STOP_MINUTES } from "@/lib/visit-tour/constants";
import { createServerClient } from "@/lib/supabase/server";
import type { CommercialStatus } from "@/lib/supabase/types";
import type { JoyChatResponse, JoyCopilotOperation } from "../types/joy-chat";
import type {
  JoyConversationMemory,
  JoyTourPlanDraft,
} from "../types/joy-session";
import {
  applyTourIntakeAnswer,
  buildIntakeQuestion,
  draftToPartialRequest,
  getMissingTourFields,
  isJoyTourIntakeActive,
  isJoyTourPlanCommand,
  isTourRequestComplete,
  JOY_TOUR_MID_MAX_STOPS,
  parseJoyTourPlanRequest,
  parseJoyTourRuntimeCommand,
  resolveMidTourMaxStops,
  type JoyTourPlanRequest,
  type JoyTourRuntimeCommand,
} from "../utils/parse-joy-tour-plan";
import { buildCompanyChatActions, buildPageAction } from "../utils/joy-chat-action-builders";

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  latina: { lat: 41.4677, lng: 12.9037 },
  aprilia: { lat: 41.5947, lng: 12.6532 },
  terracina: { lat: 41.2917, lng: 13.2486 },
  sezze: { lat: 41.4986, lng: 13.0594 },
  frosinone: { lat: 41.6397, lng: 13.3426 },
  cassino: { lat: 41.4928, lng: 13.8314 },
  roma: { lat: 41.9028, lng: 12.4964 },
  viterbo: { lat: 42.4175, lng: 12.108 },
  rieti: { lat: 42.4042, lng: 12.8621 },
  formia: { lat: 41.2563, lng: 13.6056 },
  gaeta: { lat: 41.2142, lng: 13.5705 },
  cisterna: { lat: 41.5906, lng: 12.8286 },
  "cisterna di latina": { lat: 41.5906, lng: 12.8286 },
  pontinia: { lat: 41.4083, lng: 13.0444 },
  sabaudia: { lat: 41.3003, lng: 12.6489 },
  nettuno: { lat: 41.4578, lng: 12.6639 },
  anzio: { lat: 41.4496, lng: 12.6271 },
};

const DEFAULT_GPS_RADIUS_KM = 30;
const CITY_CENTROID_CACHE = new Map<string, { lat: number; lng: number } | null>();

type CompanyGeoRow = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  commercial_status: CommercialStatus | null;
  category: string | null;
  subcategory: string | null;
  sector: string | null;
  last_visit_at: string | null;
  revenue: number | null;
  phone: string | null;
  contact_phone: string | null;
  mobile: string | null;
};

type OpportunityHint = {
  companyId: string;
  amount: number;
  probability: number;
  title: string;
};

type LockedVisit = {
  companyId: string;
  companyName: string;
  scheduledAt: string;
};

export interface JoyTourPlannerContext {
  userId: string | null;
  memory?: JoyConversationMemory | null;
  latitude?: number | null;
  longitude?: number | null;
}

function newMessageId(): string {
  return `joy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newPendingId(): string {
  return `copilot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeCityKey(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Centro città: hardcode → centroide aziende CRM → Nominatim OSM (gratis). */
async function resolveCityCenter(
  city: string | null | undefined
): Promise<{ lat: number; lng: number } | null> {
  if (!city?.trim()) {
    return null;
  }

  const key = normalizeCityKey(city);
  const hardcoded = CITY_CENTERS[key];
  if (hardcoded) {
    return hardcoded;
  }

  if (CITY_CENTROID_CACHE.has(key)) {
    return CITY_CENTROID_CACHE.get(key) ?? null;
  }

  try {
    const supabase = await createServerClient();
    const pattern = escapeIlikePattern(city);
    const { data } = await supabase
      .from("companies")
      .select("latitude,longitude")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .ilike("city", pattern ?? city)
      .limit(40);

    const points = (data ?? []).filter(
      (row): row is { latitude: number; longitude: number } =>
        row.latitude != null && row.longitude != null
    );

    if (points.length >= 2) {
      const lat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
      const lng = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
      const center = { lat, lng };
      CITY_CENTROID_CACHE.set(key, center);
      return center;
    }

    if (points.length === 1) {
      const center = { lat: points[0]!.latitude, lng: points[0]!.longitude };
      CITY_CENTROID_CACHE.set(key, center);
      return center;
    }
  } catch {
    // continua con Nominatim
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${city}, Italia`);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "EteryaCRM/1.0 (joy-drive-tour-planner)",
      },
      cache: "force-cache",
      next: { revalidate: 86400 },
    });
    if (response.ok) {
      const payload = (await response.json()) as Array<{ lat?: string; lon?: string }>;
      const first = payload[0];
      if (first?.lat && first?.lon) {
        const center = { lat: Number(first.lat), lng: Number(first.lon) };
        if (Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
          CITY_CENTROID_CACHE.set(key, center);
          return center;
        }
      }
    }
  } catch {
    // ignore
  }

  CITY_CENTROID_CACHE.set(key, null);
  return null;
}

/** Geocoding indirizzo (via/civico + comune). Fallisce → null, mai inventare. */
async function geocodeAddress(
  address: string,
  cityHint?: string | null
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const queries = [
    cityHint && !normalizeCityKey(trimmed).includes(normalizeCityKey(cityHint))
      ? `${trimmed}, ${cityHint}, Italia`
      : null,
    `${trimmed}, Italia`,
    cityHint ? `${trimmed}, ${cityHint}` : null,
  ].filter((q): q is string => Boolean(q));

  for (const q of queries) {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", q);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "it");
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "EteryaCRM/1.0 (joy-drive-tour-planner)",
        },
        cache: "force-cache",
        next: { revalidate: 86400 },
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as Array<{ lat?: string; lon?: string }>;
      const first = payload[0];
      if (!first?.lat || !first?.lon) continue;
      const point = { lat: Number(first.lat), lng: Number(first.lon) };
      if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
        return point;
      }
    } catch {
      // prova query successiva
    }
  }

  return null;
}

function isStreetAddress(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return /^(via|viale|corso|piazza|piazzale|strada|vicolo|largo|contrada)\b/i.test(
    value.trim()
  );
}

function boundsAround(
  lat: number,
  lng: number,
  radiusKm: number
): { south: number; north: number; west: number; east: number } {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lng - lngDelta,
    east: lng + lngDelta,
  };
}

function minutesUntilArrival(maxArrivalTime: string | null, day: "today" | "tomorrow"): number {
  const now = new Date();
  const target = new Date();
  if (day === "tomorrow") {
    target.setDate(target.getDate() + 1);
  }

  if (maxArrivalTime) {
    const [h, m] = maxArrivalTime.split(":").map(Number);
    target.setHours(h ?? 17, m ?? 0, 0, 0);
  } else {
    target.setHours(17, 0, 0, 0);
  }

  const departureHour = day === "today" ? Math.max(now.getHours(), 8) : 8;
  const departure = new Date(target);
  departure.setHours(departureHour, day === "today" ? now.getMinutes() : 0, 0, 0);

  const diff = Math.max(60, Math.round((target.getTime() - departure.getTime()) / 60000));
  return Math.min(diff, 10 * 60);
}

function dayBounds(day: "today" | "tomorrow"): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (day === "tomorrow") {
    start.setDate(start.getDate() + 1);
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function matchesSegment(row: CompanyGeoRow, request: JoyTourPlanRequest): boolean {
  const status = row.commercial_status ?? "prospect";

  if (request.commercialStatus && status !== request.commercialStatus) {
    return false;
  }

  if (request.audience === "prospect" && status !== "prospect") {
    return false;
  }
  if (request.audience === "clienti" && status !== "cliente") {
    return false;
  }

  if (request.segment === "falegnami" || request.segment === "showroom" || request.segment === "fabbri") {
    const haystack = [row.category, row.subcategory, row.sector, row.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const needle =
      request.segment === "falegnami"
        ? "falegnam"
        : request.segment === "showroom"
          ? "showroom"
          : "fabbr";
    return haystack.includes(needle) || (request.segment === "fabbri" && haystack.includes("ferrament"));
  }

  return true;
}

function resolveCompanyPhones(
  row: Pick<CompanyGeoRow, "phone" | "contact_phone" | "mobile">
): string | null {
  return row.contact_phone ?? row.mobile ?? row.phone ?? null;
}

async function resolveReferentPhone(
  companyId: string,
  fallback?: Pick<CompanyGeoRow, "phone" | "contact_phone" | "mobile"> | null
): Promise<{ phone: string | null; contactName: string | null }> {
  try {
    const supabase = await createServerClient();
    const { data: contacts } = await supabase
      .from("contacts")
      .select("full_name,phone,mobile,is_primary")
      .eq("company_id", companyId)
      .order("is_primary", { ascending: false })
      .limit(5);

    for (const contact of contacts ?? []) {
      const phone = contact.mobile ?? contact.phone;
      if (phone) {
        return { phone, contactName: contact.full_name ?? null };
      }
    }
  } catch {
    // fallback company fields
  }

  return {
    phone: fallback ? resolveCompanyPhones(fallback) : null,
    contactName: null,
  };
}

async function fetchCandidateCompanies(
  request: JoyTourPlanRequest,
  userId: string | null,
  excludeIds: string[] = [],
  gpsCenter?: { lat: number; lng: number } | null
): Promise<CompanyGeoRow[]> {
  const supabase = await createServerClient();
  const useGpsZone =
    request.zoneMode === "gps" ||
    (Boolean(gpsCenter) && !request.cap && !request.city && !request.province);

  async function runQuery(scoped: boolean): Promise<{
    rows: CompanyGeoRow[];
    error: string | null;
    filterSummary: Record<string, unknown>;
  }> {
    // GPS zone: coords required for distance. City/cap/province: include also without coords.
    let query = supabase
      .from("companies")
      .select(
        "id,name,city,province,postal_code,latitude,longitude,commercial_status,category,subcategory,sector,last_visit_at,revenue,phone,contact_phone,mobile"
      )
      .limit(1000);

    if (useGpsZone) {
      query = query.not("latitude", "is", null).not("longitude", "is", null);
    }

    // Scope agente solo per ricerca GPS / raggio. Per comune/CAP/provincia
    // allineiamo all'elenco Aziende (RLS org), altrimenti 239 prospect → 0.
    if (scoped && userId && useGpsZone) {
      query = applyAgentCompanyScope(query, userId);
    }

    if (useGpsZone && gpsCenter) {
      const radius = request.radiusKm || DEFAULT_GPS_RADIUS_KM;
      const bounds = boundsAround(gpsCenter.lat, gpsCenter.lng, radius);
      query = query
        .gte("latitude", bounds.south)
        .lte("latitude", bounds.north)
        .gte("longitude", bounds.west)
        .lte("longitude", bounds.east);
    } else if (request.cap) {
      query = query.eq("postal_code", request.cap);
    } else if (request.province) {
      const pattern = escapeIlikePattern(request.province);
      if (pattern) {
        query = query.ilike("province", pattern);
      }
    } else if (request.city) {
      const pattern = escapeIlikePattern(request.city);
      if (pattern) {
        query = query.ilike("city", pattern);
      }
    }

    if (request.commercialStatus === "prospect" || request.audience === "prospect") {
      query = query.or("commercial_status.eq.prospect,commercial_status.is.null");
    } else if (request.commercialStatus) {
      query = query.eq("commercial_status", request.commercialStatus);
    } else if (request.audience === "clienti") {
      query = query.eq("commercial_status", "cliente");
    }

    const { data, error } = await query;
    if (error) {
      return {
        rows: [],
        error: error.message || "Errore lettura aziende CRM",
        filterSummary: {
          scoped,
          useGpsZone,
          city: request.city,
          cap: request.cap,
          province: request.province,
          audience: request.audience,
          commercialStatus: request.commercialStatus,
        },
      };
    }

    const exclude = new Set(excludeIds);
    let rows = ((data ?? []) as CompanyGeoRow[]).filter(
      (row) => matchesSegment(row, request) && !exclude.has(row.id)
    );

    if (useGpsZone && gpsCenter) {
      const radius = request.radiusKm || DEFAULT_GPS_RADIUS_KM;
      rows = rows.filter((row) => {
        if (row.latitude == null || row.longitude == null) return false;
        return getDistanceKm(gpsCenter.lat, gpsCenter.lng, row.latitude, row.longitude) <= radius;
      });
    }

    return {
      rows,
      error: null,
      filterSummary: {
        scoped,
        useGpsZone,
        city: request.city,
        cap: request.cap,
        province: request.province,
        audience: request.audience,
        commercialStatus: request.commercialStatus,
        rawCount: data?.length ?? 0,
        afterSegment: rows.length,
      },
    };
  }

  // Prima senza scope agente su città (come elenco CRM); scope solo GPS.
  const primary = await runQuery(false);
  if (primary.error) {
    logTourPipeline({
      step: "fetch_error",
      error: primary.error,
      ...primary.filterSummary,
      userId,
    });
    throw new Error(primary.error);
  }

  logTourPipeline({
    step: "fetch_candidates",
    ...primary.filterSummary,
    userId,
    afterFetch: primary.rows.length,
    afterProspect: primary.rows.filter(
      (row) =>
        row.commercial_status === "prospect" || row.commercial_status == null
    ).length,
    afterCity: primary.rows.length,
    afterCoords: primary.rows.filter(
      (row) => row.latitude != null && row.longitude != null
    ).length,
    afterAvailability: primary.rows.length,
    final: primary.rows.length,
  });

  return primary.rows;
}

async function fetchOpportunityHints(
  companyIds: string[]
): Promise<Map<string, OpportunityHint>> {
  const map = new Map<string, OpportunityHint>();
  if (companyIds.length === 0) {
    return map;
  }

  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("opportunities")
      .select("company_id,title,total_amount,probability,stage")
      .in("company_id", companyIds.slice(0, 80))
      .in("stage", ["new", "contact_started", "site_visit", "quote_sent", "negotiation"])
      .limit(100);

    for (const row of data ?? []) {
      if (!row.company_id) continue;
      const amount = Number(row.total_amount ?? 0);
      const probability = Number(row.probability ?? 0);
      const prev = map.get(row.company_id);
      const weighted = amount * (probability / 100);
      const prevWeighted = prev ? prev.amount * (prev.probability / 100) : 0;
      if (!prev || weighted > prevWeighted) {
        map.set(row.company_id, {
          companyId: row.company_id,
          amount,
          probability,
          title: row.title ?? "Opportunità",
        });
      }
    }
  } catch {
    // graceful: potenziale commerciale opzionale
  }

  return map;
}

async function fetchLockedAppointmentsForDay(
  day: "today" | "tomorrow",
  userId: string | null
): Promise<LockedVisit[]> {
  const lockedMap = new Map<string, LockedVisit>();

  try {
    const { start, end } = dayBounds(day);
    const supabase = await createServerClient();
    let query = supabase
      .from("visits")
      .select("company_id,scheduled_at,companies(name)")
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString())
      .limit(20);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data } = await query;
    for (const row of data ?? []) {
      if (!row.company_id) continue;
      const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
      lockedMap.set(row.company_id, {
        companyId: row.company_id,
        companyName: (company as { name?: string } | null)?.name ?? "Visita fissa",
        scheduledAt: row.scheduled_at,
      });
    }
  } catch {
    // graceful
  }

  try {
    const dateKey = (() => {
      const d = new Date();
      if (day === "tomorrow") {
        d.setDate(d.getDate() + 1);
      }
      return d.toISOString().slice(0, 10);
    })();

    const agenda = await listAgendaItems({
      view: "day",
      date: dateKey,
      agentId: userId,
      kind: "",
      status: "open",
    });

    for (const item of agenda.data ?? []) {
      if (!item.companyId) continue;
      if (item.kind !== "visit" && item.kind !== "follow_up" && item.kind !== "reminder") {
        continue;
      }
      if (lockedMap.has(item.companyId)) continue;
      lockedMap.set(item.companyId, {
        companyId: item.companyId,
        companyName: item.companyName ?? item.title,
        scheduledAt: item.scheduledAt,
      });
    }
  } catch {
    // graceful: agenda opzionale
  }

  return [...lockedMap.values()];
}

async function fetchCompaniesByIds(ids: string[]): Promise<CompanyGeoRow[]> {
  if (ids.length === 0) {
    return [];
  }
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id,name,city,province,postal_code,latitude,longitude,commercial_status,category,subcategory,sector,last_visit_at,revenue,phone,contact_phone,mobile"
    )
    .in("id", ids);
  if (error) {
    throw new Error(error.message || "Errore lettura aziende CRM");
  }
  return (data ?? []) as CompanyGeoRow[];
}

async function refinePlanWithRoadRouting(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  plan: VisitTourOptimizePlan
): Promise<{ plan: VisitTourOptimizePlan; usedRoadRouting: boolean }> {
  if (plan.stops.length === 0) {
    return { plan, usedRoadRouting: false };
  }

  const points = [
    origin,
    ...plan.stops.map((stop) => ({
      lat: stop.company.latitude,
      lng: stop.company.longitude,
    })),
    destination,
  ];

  try {
    const routed = await fetchDrivingRouteLegs(points);
    if (routed.legs.length < plan.stops.length) {
      return { plan, usedRoadRouting: false };
    }

    const stops = plan.stops.map((stop, index) => {
      const leg = routed.legs[index];
      if (!leg) {
        return stop;
      }
      return {
        ...stop,
        legDistanceKm: Math.round(leg.distanceKm * 10) / 10,
      };
    });

    const visitMinutes = stops.length * VISIT_TOUR_STOP_MINUTES;
    return {
      plan: {
        ...plan,
        stops,
        totalDistanceKm: Math.round(routed.totalDistanceKm * 10) / 10,
        estimatedMinutes: Math.round(routed.totalDurationMinutes + visitMinutes),
      },
      usedRoadRouting: true,
    };
  } catch {
    return { plan, usedRoadRouting: false };
  }
}

async function resolveSedeOrigin(): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const { data } = await getCompanyConfig();
    const address = data.address?.trim() ?? "";
    const name = data.companyName?.trim() || "Sede Eterya";
    if (address) {
      for (const [city, point] of Object.entries(CITY_CENTERS)) {
        if (normalizeCityKey(address).includes(city)) {
          return { ...point, label: name };
        }
      }
      const fromAddress = await resolveCityCenter(address.split(",")[0]?.trim() ?? address);
      if (fromAddress) {
        return { ...fromAddress, label: name };
      }
    }
    // Fallback solo se configurazione azienda presente con nome (sede nota Latina).
    if (data.companyName?.trim()) {
      const latina = CITY_CENTERS.latina;
      return { ...latina, label: name };
    }
  } catch {
    // ignore
  }
  return null;
}

async function resolveOrigin(
  request: JoyTourPlanRequest,
  context: JoyTourPlannerContext,
  companies: CompanyGeoRow[]
): Promise<{
  lat: number;
  lng: number;
  label: string;
  usedCityCenterFallback?: boolean;
} | null> {
  const memory = context.memory;

  if (request.startMode === "gps" || request.zoneMode === "gps") {
    if (context.latitude != null && context.longitude != null) {
      return { lat: context.latitude, lng: context.longitude, label: "GPS" };
    }
    if (request.centerLat != null && request.centerLng != null) {
      return {
        lat: request.centerLat,
        lng: request.centerLng,
        label: "Coordinate",
      };
    }
    if (memory?.tourDraft?.lastLat != null && memory?.tourDraft?.lastLng != null) {
      return {
        lat: memory.tourDraft.lastLat,
        lng: memory.tourDraft.lastLng,
        label: "Posizione nota",
      };
    }
    if (memory?.lastLat != null && memory?.lastLng != null) {
      return { lat: memory.lastLat, lng: memory.lastLng, label: "Ultima GPS" };
    }
  }

  if (request.startMode === "last_position") {
    if (memory?.tourDraft?.lastLat != null && memory?.tourDraft?.lastLng != null) {
      return {
        lat: memory.tourDraft.lastLat,
        lng: memory.tourDraft.lastLng,
        label: "Ultima posizione",
      };
    }
    if (memory?.lastLat != null && memory?.lastLng != null) {
      return { lat: memory.lastLat, lng: memory.lastLng, label: "Ultima posizione" };
    }
  }

  if (request.startMode === "city" || request.startCity) {
    const startRaw = request.startCity?.trim() ?? "";
    if (startRaw && isStreetAddress(startRaw)) {
      const geocoded = await geocodeAddress(startRaw, request.city);
      if (geocoded) {
        // Se geocode lontano dal comune target (>45 km), usa centro comune.
        const cityCenter = await resolveCityCenter(request.city);
        if (
          cityCenter &&
          getDistanceKm(geocoded.lat, geocoded.lng, cityCenter.lat, cityCenter.lng) > 45
        ) {
          return {
            ...cityCenter,
            label: `${request.city ?? "zona"} (centro — indirizzo fuori zona)`,
            usedCityCenterFallback: true,
          };
        }
        return { ...geocoded, label: startRaw };
      }
      const fallback =
        (await resolveCityCenter(request.city)) ??
        (await resolveCityCenter(extractCityHintFromAddress(startRaw)));
      if (fallback) {
        return {
          ...fallback,
          label: `${request.city ?? extractCityHintFromAddress(startRaw) ?? "zona"} (centro — geocoding indirizzo non disponibile)`,
          usedCityCenterFallback: true,
        };
      }
    } else if (startRaw) {
      const center = await resolveCityCenter(startRaw);
      if (center) {
        return { ...center, label: startRaw };
      }
    }
  }

  const cityCenter =
    (await resolveCityCenter(request.city)) ??
    (await resolveCityCenter(request.startCity)) ??
    null;
  if (cityCenter) {
    return {
      ...cityCenter,
      label: request.city ?? request.startCity ?? "Zona",
    };
  }

  if (companies[0]?.latitude != null && companies[0]?.longitude != null) {
    return {
      lat: companies[0].latitude,
      lng: companies[0].longitude,
      label: companies[0].city ?? companies[0].name,
    };
  }

  return null;
}

function extractCityHintFromAddress(address: string): string | null {
  const match = address.match(
    /,\s*([A-Za-zÀ-ù][A-Za-zÀ-ù'-]{1,30}(?:\s+[A-Za-zÀ-ù][A-Za-zÀ-ù'-]{1,20}){0,2})\s*$/i
  );
  return match?.[1]?.trim() ?? null;
}

function buildTourHref(
  request: JoyTourPlanRequest,
  stopCompanyIds: string[],
  origin: { lat: number; lng: number; label: string },
  destination: { lat: number; lng: number }
): string {
  const params = new URLSearchParams();
  params.set("joy", "1");
  params.set("day", request.day);
  if (request.city) params.set("city", request.city);
  if (request.cap) params.set("cap", request.cap);
  if (request.maxStops) params.set("max", String(request.maxStops));
  if (request.startCity) params.set("from", request.startCity);
  if (request.endCity) params.set("to", request.endCity);
  if (request.audience) params.set("audience", request.audience);
  if (stopCompanyIds.length > 0) {
    params.set("stops", stopCompanyIds.join(","));
  }
  params.set("olat", String(origin.lat));
  params.set("olng", String(origin.lng));
  params.set("olabel", origin.label);
  params.set("dlat", String(destination.lat));
  params.set("dlng", String(destination.lng));
  return `/giro-visite?${params.toString()}`;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildProspectListFallback(
  companies: CompanyGeoRow[],
  request: JoyTourPlanRequest,
  note: string
): JoyChatResponse {
  const limit = Math.min(Math.max(request.maxStops || 5, 1), 8);
  const ranked = [...companies].sort((a, b) => {
    const aScore =
      (a.commercial_status === "prospect" || a.commercial_status == null ? 2 : 0) +
      (a.latitude != null && a.longitude != null ? 1 : 0) +
      (a.last_visit_at ? 0 : 1);
    const bScore =
      (b.commercial_status === "prospect" || b.commercial_status == null ? 2 : 0) +
      (b.latitude != null && b.longitude != null ? 1 : 0) +
      (b.last_visit_at ? 0 : 1);
    return bScore - aScore || a.name.localeCompare(b.name, "it");
  });
  const picks = ranked.slice(0, limit);
  const zone = request.city ?? request.cap ?? request.province ?? "zona";
  const lines = picks.map((row, index) => {
    const loc = [row.city, row.province].filter(Boolean).join(", ");
    const coordsNote =
      row.latitude == null || row.longitude == null
        ? " · coordinate mancanti"
        : "";
    return `${index + 1}. **${row.name}**${loc ? ` (${loc})` : ""}${coordsNote}`;
  });

  return {
    message: {
      id: newMessageId(),
      role: "assistant",
      content: [
        `Ho trovato **${picks.length}** prospect${request.city ? ` a ${request.city}` : ""}${
          companies.length > picks.length ? ` (su ${companies.length} in zona)` : ""
        }.`,
        note ||
          "Non riesco ancora a ottimizzare con precisione il percorso, ma ti propongo queste aziende:",
        "",
        lines.join("\n"),
        "",
        request.maxArrivalTime
          ? `Vincolo orario: entro le **${request.maxArrivalTime}**. Se il tempo non basta per tutte, dimmi e riduco le tappe.`
          : "Dimmi un punto di partenza se vuoi che ottimizzi il percorso.",
      ].join("\n"),
      createdAt: new Date().toISOString(),
      items: picks.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: row.city ?? zone,
      })),
      actions: [
        buildPageAction("giro-visite", "Apri Giro Visite", "/giro-visite"),
        ...picks
          .flatMap((row) =>
            buildCompanyChatActions({ id: row.id, name: row.name }, `fb-${row.id}`).slice(
              0,
              1
            )
          )
          .slice(0, 5),
      ],
    },
    memoryPatch: {
      lastComune: request.city ?? undefined,
      tourDraft: {
        phase: "proposed",
        day: request.day,
        city: request.city,
        cap: request.cap,
        province: request.province,
        zoneMode: request.zoneMode,
        radiusKm: request.radiusKm,
        audience: request.audience,
        maxStops: request.maxStops,
        maxArrivalTime: request.maxArrivalTime,
        startMode: request.startMode,
        startCity: request.startCity,
        endCity: request.endCity,
        stopCompanyIds: picks.map((p) => p.id),
        awaitingField: null,
      },
    },
    sessionState: "proposing",
  };
}

function logTourPipeline(payload: Record<string, unknown>): void {
  console.info("[joy-tour-planner]", JSON.stringify(payload));
}

function intakeResponse(
  question: string,
  draft: JoyTourPlanDraft
): JoyChatResponse {
  return {
    message: {
      id: newMessageId(),
      role: "assistant",
      content: question,
      createdAt: new Date().toISOString(),
    },
    memoryPatch: { tourDraft: draft },
    sessionState: "proposing",
  };
}

async function askNextIntakeQuestion(
  draft: JoyTourPlanDraft,
  context: JoyTourPlannerContext
): Promise<JoyChatResponse> {
  const request = draftToPartialRequest(draft, draft.awaitingField ?? "intake");
  const missing = getMissingTourFields(request);
  if (missing.length === 0) {
    return proposeJoyTourPlan(request, context);
  }

  const field = missing[0]!;
  const sede = await resolveSedeOrigin();
  const hasGps =
    (context.latitude != null && context.longitude != null) ||
    (context.memory?.lastLat != null && context.memory?.lastLng != null);
  const hasLastPosition =
    (draft.lastLat != null && draft.lastLng != null) ||
    (context.memory?.lastLat != null && context.memory?.lastLng != null);

  const nextDraft: JoyTourPlanDraft = {
    ...draft,
    phase: "intake",
    awaitingField: field,
  };

  return intakeResponse(
    buildIntakeQuestion(field, {
      hasGps,
      hasLastPosition,
      hasSede: Boolean(sede),
    }),
    nextDraft
  );
}

export async function proposeJoyTourPlan(
  request: JoyTourPlanRequest,
  contextOrUserId: JoyTourPlannerContext | string | null
): Promise<JoyChatResponse> {
  const context: JoyTourPlannerContext =
    typeof contextOrUserId === "object" && contextOrUserId !== null
      ? contextOrUserId
      : { userId: contextOrUserId };

  const userId = context.userId;
  const skipped = context.memory?.tourDraft?.skippedCompanyIds ?? [];
  const forceIncludeIds = [
    ...new Set([
      ...(request.forceIncludeCompanyIds ?? []),
      ...(context.memory?.tourDraft?.forceIncludeCompanyIds ?? []),
    ]),
  ].filter((id) => !skipped.includes(id));

  const gpsCenter =
    request.centerLat != null && request.centerLng != null
      ? { lat: request.centerLat, lng: request.centerLng }
      : context.latitude != null && context.longitude != null
        ? { lat: context.latitude, lng: context.longitude }
        : context.memory?.tourDraft?.lastLat != null &&
            context.memory?.tourDraft?.lastLng != null
          ? {
              lat: context.memory.tourDraft.lastLat,
              lng: context.memory.tourDraft.lastLng,
            }
          : context.memory?.lastLat != null && context.memory?.lastLng != null
            ? { lat: context.memory.lastLat, lng: context.memory.lastLng }
            : null;

  if (
    (request.zoneMode === "gps" || request.startMode === "gps") &&
    !gpsCenter &&
    !request.cap &&
    !request.city &&
    !request.province
  ) {
    return {
      message: {
        id: newMessageId(),
        role: "assistant",
        content:
          "Per cercare nel **raggio GPS** mi serve la tua posizione. Attiva la geolocalizzazione sul telefono, oppure indica un CAP/città/provincia o coordinate.",
        createdAt: new Date().toISOString(),
      },
      memoryPatch: {
        tourDraft: {
          phase: "intake",
          day: request.day,
          zoneMode: "gps",
          radiusKm: request.radiusKm,
          audience: request.audience,
          maxStops: request.maxStops,
          maxArrivalTime: request.maxArrivalTime,
          startMode: "gps",
          awaitingField: "zone",
          skippedCompanyIds: skipped,
          forceIncludeCompanyIds: forceIncludeIds,
        },
      },
      sessionState: "proposing",
    };
  }

  let companies: CompanyGeoRow[];
  try {
    companies = await fetchCandidateCompanies(request, userId, skipped, gpsCenter);
  } catch (error) {
    logTourPipeline({
      step: "fetch_error",
      city: request.city,
      startCity: request.startCity,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      message: {
        id: newMessageId(),
        role: "assistant",
        content: "Non riesco a leggere correttamente i dati del CRM",
        createdAt: new Date().toISOString(),
      },
      sessionState: "proposing",
    };
  }

  const afterFetch = companies.length;
  const afterProspect = companies.filter(
    (row) =>
      request.audience !== "prospect" ||
      row.commercial_status === "prospect" ||
      row.commercial_status == null
  ).length;
  const afterCity = companies.length;
  const afterCoords = companies.filter(
    (row) => row.latitude != null && row.longitude != null
  ).length;

  logTourPipeline({
    step: "candidates",
    intent: "plan_tour",
    city: request.city,
    startAddress: request.startCity,
    arrivalTime: request.maxArrivalTime,
    requestedCount: request.maxStops,
    commercialFilter: request.commercialStatus ?? request.audience,
    zoneMode: request.zoneMode,
    counts: {
      afterFetch,
      afterProspect,
      afterCity,
      afterCoords,
    },
  });

  // Garantisce che le aziende force-include siano nel pool
  const missingForce = forceIncludeIds.filter((id) => !companies.some((c) => c.id === id));
  if (missingForce.length > 0) {
    const forcedRows = await fetchCompaniesByIds(missingForce);
    companies.push(...forcedRows);
  }

  if (companies.length === 0) {
    const filters = [
      request.zoneMode === "gps"
        ? `raggio GPS ${request.radiusKm || DEFAULT_GPS_RADIUS_KM} km`
        : null,
      request.city ? `città ${request.city}` : null,
      request.cap ? `CAP ${request.cap}` : null,
      request.province ? `provincia ${request.province}` : null,
      request.audience !== "entrambi" ? request.audience : null,
      request.segment ?? null,
    ]
      .filter(Boolean)
      .join(", ");

    logTourPipeline({ step: "zero_candidates", filters });

    return {
      message: {
        id: newMessageId(),
        role: "assistant",
        content: `Non ho trovato aziende${filters ? ` per ${filters}` : ""} da includere nel giro. Prova a allargare zona o filtri, oppure apri Giro Visite.`,
        createdAt: new Date().toISOString(),
        actions: [
          buildPageAction("giro-visite", "Apri Giro Visite", "/giro-visite"),
          buildPageAction("companies", "Aziende", "/companies"),
        ],
      },
      memoryPatch: {
        tourDraft: {
          phase: "intake",
          day: request.day,
          city: request.city,
          cap: request.cap,
          province: request.province,
          zoneMode: request.zoneMode,
          radiusKm: request.radiusKm,
          audience: request.audience,
          maxStops: request.maxStops,
          maxArrivalTime: request.maxArrivalTime,
          startMode: request.startMode,
          startCity: request.startCity,
          endCity: request.endCity,
          skippedCompanyIds: skipped,
          forceIncludeCompanyIds: forceIncludeIds,
          awaitingField: "zone",
          lastLat: request.centerLat,
          lastLng: request.centerLng,
        },
      },
      sessionState: "proposing",
    };
  }

  const companiesWithCoords = companies.filter(
    (row) => row.latitude != null && row.longitude != null
  );
  const companiesWithoutCoords = companies.filter(
    (row) => row.latitude == null || row.longitude == null
  );

  let origin = await resolveOrigin(request, context, companies);
  let originFallbackNote: string | null = null;
  if (origin?.usedCityCenterFallback) {
    originFallbackNote = `Partenza stimata dal centro di **${request.city ?? "zona"}** (geocoding preciso di «${request.startCity}» non disponibile o fuori zona).`;
  }
  if (request.startMode === "sede") {
    const sede = await resolveSedeOrigin();
    if (sede) {
      origin = sede;
      originFallbackNote = null;
    }
  }

  const destinationCenter =
    (await resolveCityCenter(request.endCity)) ??
    (await resolveCityCenter(request.city)) ??
    (origin ? { lat: origin.lat, lng: origin.lng } : null);

  if (!origin || !destinationCenter) {
    logTourPipeline({
      step: "origin_failed",
      city: request.city,
      startCity: request.startCity,
      candidates: companies.length,
    });
    // Non dire «nessun prospect» se il comune ne ha: mostra comunque i nomi.
    if (companies.length > 0 && (request.audience === "prospect" || request.segment === "prospect")) {
      return buildProspectListFallback(
        companies,
        request,
        "Non riesco ancora a ottimizzare con precisione il percorso, ma ti propongo queste aziende:"
      );
    }
    return {
      message: {
        id: newMessageId(),
        role: "assistant",
        content:
          "Non riesco a calcolare il giro: partenza non determinabile. Scegli GPS, sede Eterya, ultima posizione, oppure dimmi «parto da [città]».",
        createdAt: new Date().toISOString(),
        actions: [buildPageAction("giro-visite", "Apri Giro Visite", "/giro-visite")],
      },
      memoryPatch: {
        tourDraft: {
          phase: "intake",
          day: request.day,
          city: request.city,
          cap: request.cap,
          province: request.province,
          zoneMode: request.zoneMode,
          radiusKm: request.radiusKm,
          audience: request.audience,
          maxStops: request.maxStops,
          maxArrivalTime: request.maxArrivalTime,
          awaitingField: "startMode",
          skippedCompanyIds: skipped,
          forceIncludeCompanyIds: forceIncludeIds,
          lastLat: request.centerLat,
          lastLng: request.centerLng,
        },
      },
      sessionState: "proposing",
    };
  }

  const [optimizeContext, opportunityHints, lockedAppointments] = await Promise.all([
    fetchVisitTourOptimizeContext(),
    fetchOpportunityHints(companies.map((c) => c.id)),
    fetchLockedAppointmentsForDay(request.day, userId),
  ]);

  const maxDurationMinutes = minutesUntilArrival(request.maxArrivalTime, request.day);
  const companyById = new Map(companies.map((c) => [c.id, c]));

  // Arricchisci pool con aziende da appuntamenti fissi (visite + agenda)
  const missingLockedIds = lockedAppointments
    .map((v) => v.companyId)
    .filter((id) => !companyById.has(id));
  if (missingLockedIds.length > 0) {
    for (const row of await fetchCompaniesByIds(missingLockedIds)) {
      companies.push(row);
      companyById.set(row.id, row);
    }
  }

  const existingStops: VisitTourOptimizeStop[] = [];
  const lockedIds = new Set<string>();

  for (const locked of lockedAppointments) {
    const company = companyById.get(locked.companyId);
    if (!company?.latitude || !company.longitude) continue;
    lockedIds.add(company.id);
    existingStops.push({
      id: company.id,
      order: existingStops.length + 1,
      locked: true,
      score: 100,
      reason: `Agenda ${new Date(locked.scheduledAt).toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      deviationKm: 0,
      legDistanceKm: 0,
      detourKm: 0,
      company: {
        id: company.id,
        name: company.name,
        city: company.city,
        province: company.province,
        latitude: company.latitude,
        longitude: company.longitude,
        phone: resolveCompanyPhones(company),
        revenue: company.revenue,
        lastVisitAt: company.last_visit_at,
        commercial_status: company.commercial_status ?? "prospect",
        status: "prospect",
        import_payload: null,
      },
    });
  }

  // Forza inclusione clienti richiesti («aggiungi …»)
  for (const forceId of forceIncludeIds) {
    if (lockedIds.has(forceId)) continue;
    const company = companyById.get(forceId);
    if (!company?.latitude || !company.longitude) continue;
    existingStops.push({
      id: company.id,
      order: existingStops.length + 1,
      locked: true,
      score: 95,
      reason: "Richiesto esplicitamente",
      deviationKm: 0,
      legDistanceKm: 0,
      detourKm: 0,
      company: {
        id: company.id,
        name: company.name,
        city: company.city,
        province: company.province,
        latitude: company.latitude,
        longitude: company.longitude,
        phone: resolveCompanyPhones(company),
        revenue: company.revenue,
        lastVisitAt: company.last_visit_at,
        commercial_status: company.commercial_status ?? "prospect",
        status: "prospect",
        import_payload: null,
      },
    });
  }

  const baseDeviationKm =
    request.zoneMode === "gps"
      ? Math.max(25, request.radiusKm || DEFAULT_GPS_RADIUS_KM)
      : Math.max(35, request.radiusKm || 40);

  let rawPlan = optimizeVisitTour({
    origin: { lat: origin.lat, lng: origin.lng },
    destination: destinationCenter,
    companies: companiesWithCoords.map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      province: row.province,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      phone: resolveCompanyPhones(row),
      revenue: row.revenue,
      lastVisitAt: row.last_visit_at,
      commercial_status: row.commercial_status ?? "prospect",
      status: "prospect" as const,
      import_payload: null,
    })),
    context: optimizeContext,
    constraints: {
      maxDurationMinutes,
      maxStops: Math.max(request.maxStops, existingStops.length),
      maxDeviationKm: baseDeviationKm,
    },
    existingStops: existingStops.length > 0 ? existingStops : undefined,
  });

  // Espandi raggio progressivamente se troppo poche tappe rispetto alla richiesta.
  for (const expanded of [baseDeviationKm + 20, baseDeviationKm + 40, 80]) {
    if (rawPlan.stops.length >= request.maxStops) break;
    if (companiesWithCoords.length === 0) break;
    rawPlan = optimizeVisitTour({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: destinationCenter,
      companies: companiesWithCoords.map((row) => ({
        id: row.id,
        name: row.name,
        city: row.city,
        province: row.province,
        latitude: row.latitude as number,
        longitude: row.longitude as number,
        phone: resolveCompanyPhones(row),
        revenue: row.revenue,
        lastVisitAt: row.last_visit_at,
        commercial_status: row.commercial_status ?? "prospect",
        status: "prospect" as const,
        import_payload: null,
      })),
      context: optimizeContext,
      constraints: {
        maxDurationMinutes,
        maxStops: Math.max(request.maxStops, existingStops.length),
        maxDeviationKm: expanded,
      },
      existingStops: existingStops.length > 0 ? existingStops : undefined,
    });
  }

  // Senza coordinate: proponi comunque con nota (non escludere dall'esistenza CRM).
  if (rawPlan.stops.length < request.maxStops && companiesWithoutCoords.length > 0) {
    const used = new Set(rawPlan.stops.map((s) => s.id));
    for (const row of companiesWithoutCoords) {
      if (rawPlan.stops.length >= request.maxStops) break;
      if (used.has(row.id)) continue;
      rawPlan.stops.push({
        id: row.id,
        order: rawPlan.stops.length + 1,
        locked: false,
        score: 40,
        reason: "In zona CRM (coordinate mancanti — verifica indirizzo)",
        deviationKm: 0,
        legDistanceKm: 0,
        detourKm: 0,
        company: {
          id: row.id,
          name: row.name,
          city: row.city,
          province: row.province,
          latitude: 0,
          longitude: 0,
          phone: resolveCompanyPhones(row),
          revenue: row.revenue,
          lastVisitAt: row.last_visit_at,
          commercial_status: row.commercial_status ?? "prospect",
          status: "prospect",
          import_payload: null,
        },
      });
    }
  }

  // Se il tempo residuo limita le tappe ottimizzate, completa comunque fino a maxStops
  // con prospect reali (il limite orario non deve azzerare i nomi).
  let timeCapNote: string | null = null;
  if (rawPlan.stops.length < request.maxStops && companies.length > rawPlan.stops.length) {
    const optimizedCount = rawPlan.stops.length;
    const used = new Set(rawPlan.stops.map((s) => s.id));
    const rankedPad = [...companies]
      .filter((row) => !used.has(row.id))
      .sort((a, b) => {
        const aScore =
          (a.latitude != null && a.longitude != null ? 2 : 0) +
          (a.last_visit_at ? 0 : 1);
        const bScore =
          (b.latitude != null && b.longitude != null ? 2 : 0) +
          (b.last_visit_at ? 0 : 1);
        return bScore - aScore || a.name.localeCompare(b.name, "it");
      });
    for (const row of rankedPad) {
      if (rawPlan.stops.length >= request.maxStops) break;
      rawPlan.stops.push({
        id: row.id,
        order: rawPlan.stops.length + 1,
        locked: false,
        score: 35,
        reason: "Prospect in zona (oltre il tempo residuo ottimizzato)",
        deviationKm: 0,
        legDistanceKm: 0,
        detourKm: 0,
        company: {
          id: row.id,
          name: row.name,
          city: row.city,
          province: row.province,
          latitude: row.latitude ?? 0,
          longitude: row.longitude ?? 0,
          phone: resolveCompanyPhones(row),
          revenue: row.revenue,
          lastVisitAt: row.last_visit_at,
          commercial_status: row.commercial_status ?? "prospect",
          status: "prospect",
          import_payload: null,
        },
      });
    }
    if (optimizedCount > 0 && optimizedCount < request.maxStops && request.maxArrivalTime) {
      timeCapNote = `Con il tempo residuo fino alle ${request.maxArrivalTime} il percorso ottimizzato ne copre circa ${optimizedCount}: ti propongo comunque ${rawPlan.stops.length} prospect reali (le ultime oltre il vincolo orario stretto).`;
    }
  }

  const { plan, usedRoadRouting } = await refinePlanWithRoadRouting(
    { lat: origin.lat, lng: origin.lng },
    destinationCenter,
    rawPlan
  );

  if (plan.stops.length === 0) {
    logTourPipeline({
      step: "zero_stops_after_optimize",
      candidates: companies.length,
      withCoords: companiesWithCoords.length,
      withoutCoords: companiesWithoutCoords.length,
      city: request.city,
      startCity: request.startCity,
    });
    if (companies.length > 0) {
      return buildProspectListFallback(
        companies,
        request,
        "Non riesco ancora a ottimizzare con precisione il percorso, ma ti propongo queste aziende:"
      );
    }
    return {
      message: {
        id: newMessageId(),
        role: "assistant",
        content:
          "Non riesco a calcolare il giro con i vincoli di tempo/distanza attuali. Allarga l'orario o riduci i filtri.",
        createdAt: new Date().toISOString(),
        actions: [buildPageAction("giro-visite", "Apri Giro Visite", "/giro-visite")],
      },
      sessionState: "proposing",
    };
  }

  logTourPipeline({
    step: "final",
    stops: plan.stops.length,
    city: request.city,
    startCity: request.startCity,
    origin: origin.label,
    names: plan.stops.map((s) => s.company.name).slice(0, 8),
  });

  const dayLabel = request.day === "today" ? "oggi" : "domani";
  const constraintBits = [
    request.zoneMode === "gps"
      ? `raggio GPS ${request.radiusKm || DEFAULT_GPS_RADIUS_KM} km`
      : null,
    request.city ? `zona ${request.city}` : null,
    request.cap ? `CAP ${request.cap}` : null,
    request.province ? `provincia ${request.province}` : null,
    request.audience !== "entrambi" ? request.audience : null,
    request.segment && request.segment !== "prospect" && request.segment !== "clienti"
      ? `filtro ${request.segment}`
      : null,
    `max ${request.maxStops} visite`,
    request.maxArrivalTime ? `entro le ${request.maxArrivalTime}` : null,
    `partenza: ${origin.label}`,
  ]
    .filter(Boolean)
    .join(" · ");

  let commercialPotential = 0;
  let cumulativeMinutes = 0;
  const startHour = 9;
  const startMinute = 0;
  const lines = plan.stops.map((stop, index) => {
    const location = [stop.company.city, stop.company.province].filter(Boolean).join(", ");
    const leg = stop.legDistanceKm > 0 ? ` · ${formatDistanceKm(stop.legDistanceKm)}` : "";
    const driveMin =
      stop.legDistanceKm > 0
        ? Math.max(5, Math.round((stop.legDistanceKm / 35) * 60))
        : 0;
    cumulativeMinutes += driveMin;
    const etaTotal = startHour * 60 + startMinute + cumulativeMinutes;
    const etaH = Math.floor(etaTotal / 60) % 24;
    const etaM = etaTotal % 60;
    const etaLabel = `ETA ~${String(etaH).padStart(2, "0")}:${String(etaM).padStart(2, "0")}`;
    cumulativeMinutes += 25; // visita media stimata
    const opp = opportunityHints.get(stop.company.id);
    let potentialBit = "";
    if (opp && opp.amount > 0) {
      const weighted = opp.amount * (opp.probability / 100);
      commercialPotential += weighted;
      potentialBit = ` · pot. ${formatEuro(weighted)} (${opp.probability}%)`;
    } else if (stop.company.revenue && stop.company.revenue > 0) {
      commercialPotential += stop.company.revenue * 0.05;
      potentialBit = ` · valore cliente`;
    }
    return `${index + 1}. **${stop.company.name}**${location ? ` (${location})` : ""}${leg} · ${etaLabel}${stop.reason ? ` — ${stop.reason}` : ""}${potentialBit}`;
  });

  const totalKm = formatDistanceKm(plan.totalDistanceKm);
  const hours = Math.floor(plan.estimatedMinutes / 60);
  const mins = plan.estimatedMinutes % 60;
  const durationLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
  const routingLabel = usedRoadRouting ? "tempi strada (OSRM)" : "stima approssimata";

  const stopCompanyIds = plan.stops.map((s) => s.company.id);
  const tourHref = buildTourHref(request, stopCompanyIds, origin, destinationCenter);
  const stopNames = plan.stops.map((s) => s.company.name).join(", ");
  const mapsUrl = buildGoogleMapsTourUrl(
    { lat: origin.lat, lng: origin.lng },
    destinationCenter,
    plan.stops.map((s) => ({ lat: s.company.latitude, lng: s.company.longitude }))
  );

  const firstStop = plan.stops[0];
  const firstReferent = firstStop
    ? await resolveReferentPhone(firstStop.company.id, {
        phone: firstStop.company.phone ?? null,
        contact_phone: null,
        mobile: null,
      })
    : { phone: null, contactName: null };

  const operation: JoyCopilotOperation = {
    type: "navigate",
    href: tourHref,
    label: "Apri proposta in Giro Visite",
  };

  const content = [
    `**Proposta giro visite per ${dayLabel}** (non salvata)`,
    constraintBits ? `Vincoli: ${constraintBits}` : null,
    originFallbackNote,
    timeCapNote,
    "",
    lines.join("\n"),
    "",
    `Totale: **${totalKm}** · **${durationLabel}** · ${plan.stops.length} tappe · ${routingLabel}`,
    commercialPotential > 0
      ? `Potenziale commerciale stimato: **${formatEuro(commercialPotential)}**`
      : null,
    "",
    "Conferma per aprire la proposta in **Giro Visite**. Nessun salvataggio automatico.",
    "Usa **Conferma** / **Rigenera** / **Modifica** / **Annulla**.",
    "In voce: «salta cliente», «aggiungi…», «prospect vicino», «entro le 17», «prossima tappa», «chiama referente», «apri Google Maps».",
  ]
    .filter(Boolean)
    .join("\n");

  const lastStop = plan.stops[plan.stops.length - 1];

  const actions = [
    buildPageAction("giro-visite", "Giro Visite", tourHref),
    {
      id: "tour-maps",
      kind: "navigate" as const,
      label: "Google Maps",
      href: mapsUrl,
      external: true,
    },
    buildPageAction("agenda", "Agenda", "/agenda"),
  ];

  if (firstStop) {
    actions.push(
      ...buildCompanyChatActions(
        {
          id: firstStop.company.id,
          name: firstStop.company.name,
          phone: firstReferent.phone,
          latitude: firstStop.company.latitude,
          longitude: firstStop.company.longitude,
        },
        "tour-first"
      ).slice(0, 2)
    );
  }

  return {
    message: {
      id: newMessageId(),
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
      items: plan.stops.map((stop) => ({
        id: stop.id,
        title: stop.company.name,
        subtitle: [stop.company.city, stop.reason].filter(Boolean).join(" · ") || undefined,
      })),
      pendingAction: {
        id: newPendingId(),
        title: `Apri giro ${dayLabel}`,
        description: `${plan.stops.length} tappe · ${totalKm} · ${durationLabel}${
          commercialPotential > 0 ? ` · pot. ${formatEuro(commercialPotential)}` : ""
        }: ${stopNames}`,
        operation,
        status: "pending",
      },
      actions: actions.slice(0, 8),
    },
    memoryPatch: {
      tourDraft: {
        phase: "proposed",
        day: request.day,
        city: request.city,
        cap: request.cap,
        province: request.province,
        zoneMode: request.zoneMode,
        radiusKm: request.radiusKm,
        audience: request.audience,
        maxStops: request.maxStops,
        maxArrivalTime: request.maxArrivalTime,
        startMode: request.startMode,
        startCity: request.startCity,
        endCity: request.endCity,
        stopCompanyIds,
        forceIncludeCompanyIds: forceIncludeIds,
        skippedCompanyIds: skipped,
        currentStopIndex: 0,
        awaitingField: null,
        lastLat: lastStop?.company.latitude ?? origin.lat,
        lastLng: lastStop?.company.longitude ?? origin.lng,
      },
      lastComune: request.city ?? request.startCity ?? undefined,
      lastCap: request.cap ?? undefined,
      lastDestinazione: request.endCity ?? undefined,
      lastLat: context.latitude ?? request.centerLat ?? context.memory?.lastLat ?? undefined,
      lastLng: context.longitude ?? request.centerLng ?? context.memory?.lastLng ?? undefined,
    },
    sessionState: "confirming",
  };
}

async function handleRuntimeCommand(
  command: JoyTourRuntimeCommand,
  context: JoyTourPlannerContext
): Promise<JoyChatResponse> {
  const draft = context.memory?.tourDraft;
  if (!draft || (draft.phase !== "proposed" && draft.phase !== "active")) {
    return {
      message: {
        id: newMessageId(),
        role: "assistant",
        content:
          "Non ho un giro attivo. Di' «Organizza il mio giro» per iniziare la pianificazione.",
        createdAt: new Date().toISOString(),
      },
      sessionState: "proposing",
    };
  }

  const baseRequest = draftToPartialRequest(draft, command.type);

  switch (command.type) {
    case "regenerate":
      return proposeJoyTourPlan(baseRequest, context);

    case "cancel_tour":
      return {
        message: {
          id: newMessageId(),
          role: "assistant",
          content: "Ok, ho annullato la proposta di giro. Nessun dato è stato salvato.",
          createdAt: new Date().toISOString(),
        },
        memoryPatch: { tourDraft: null },
        sessionState: "completed",
      };

    case "modify":
      return {
        message: {
          id: newMessageId(),
          role: "assistant",
          content:
            "Dimmi cosa cambiare: giorno, zona, numero visite, orario, partenza, oppure «rigenera il giro».",
          createdAt: new Date().toISOString(),
        },
        memoryPatch: {
          tourDraft: {
            ...draft,
            phase: "intake",
            awaitingField: null,
          },
        },
        sessionState: "proposing",
      };

    case "arrive_by": {
      const nextRequest: JoyTourPlanRequest = {
        ...baseRequest,
        maxArrivalTime: command.time,
        provided: { ...baseRequest.provided, maxArrivalTime: true },
      };
      return proposeJoyTourPlan(nextRequest, {
        ...context,
        memory: {
          ...context.memory,
          tourDraft: { ...draft, maxArrivalTime: command.time },
        },
      });
    }

    case "skip": {
      const stopIds = draft.stopCompanyIds ?? [];
      let skipId: string | null = null;
      if (command.companyQuery) {
        const pattern = escapeIlikePattern(command.companyQuery);
        if (pattern) {
          const supabase = await createServerClient();
          const { data } = await supabase
            .from("companies")
            .select("id,name")
            .in("id", stopIds.length > 0 ? stopIds : ["00000000-0000-0000-0000-000000000000"])
            .ilike("name", pattern)
            .limit(1);
          skipId = data?.[0]?.id ?? null;
        }
      }
      if (!skipId && stopIds.length > 0) {
        skipId = stopIds[0]!;
      }
      if (!skipId) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: "Non ho una tappa da saltare. Specifica il nome del cliente.",
            createdAt: new Date().toISOString(),
          },
          sessionState: "proposing",
        };
      }
      const skipped = [...(draft.skippedCompanyIds ?? []), skipId];
      return proposeJoyTourPlan(baseRequest, {
        ...context,
        memory: {
          ...context.memory,
          tourDraft: { ...draft, skippedCompanyIds: skipped },
        },
      });
    }

    case "add": {
      if (command.companyQuery) {
        const pattern = escapeIlikePattern(command.companyQuery);
        const supabase = await createServerClient();
        let query = supabase
          .from("companies")
          .select("id,name")
          .ilike("name", pattern ?? `%${command.companyQuery}%`)
          .limit(1);
        if (context.userId) {
          query = applyAgentCompanyScope(query, context.userId);
        }
        const { data } = await query;
        const found = data?.[0];
        if (found) {
          const forceInclude = [
            ...new Set([...(draft.forceIncludeCompanyIds ?? []), found.id]),
          ];
          const skipped = (draft.skippedCompanyIds ?? []).filter((id) => id !== found.id);
          const needed = Math.max(
            (draft.stopCompanyIds?.length ?? draft.maxStops ?? JOY_TOUR_MID_MAX_STOPS) +
              (draft.stopCompanyIds?.includes(found.id) ? 0 : 1),
            forceInclude.length
          );
          const capped = resolveMidTourMaxStops(draft.maxStops, needed);
          if (!capped.ok) {
            return {
              message: {
                id: newMessageId(),
                role: "assistant",
                content: `Il giro è già al massimo di ${capped.cap} visite. Di' «sostituisci X con Y» oppure alza il limite in modifica.`,
                createdAt: new Date().toISOString(),
              },
              sessionState: "proposing",
            };
          }
          const nextRequest: JoyTourPlanRequest = {
            ...baseRequest,
            maxStops: capped.maxStops,
            forceIncludeCompanyIds: forceInclude,
            provided: { ...baseRequest.provided, maxStops: true },
          };
          return proposeJoyTourPlan(nextRequest, {
            ...context,
            memory: {
              ...context.memory,
              tourDraft: {
                ...draft,
                maxStops: nextRequest.maxStops,
                skippedCompanyIds: skipped,
                forceIncludeCompanyIds: forceInclude,
              },
            },
          });
        }
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: `Non ho trovato «${command.companyQuery}» nel CRM da aggiungere al giro.`,
            createdAt: new Date().toISOString(),
          },
          sessionState: "proposing",
        };
      }
      const needed = (draft.maxStops ?? JOY_TOUR_MID_MAX_STOPS) + 1;
      const capped = resolveMidTourMaxStops(draft.maxStops, needed);
      if (!capped.ok) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: `Sei già a ${capped.cap} visite (max mid-tour). Usa «sostituisci» o modifica il limite.`,
            createdAt: new Date().toISOString(),
          },
          sessionState: "proposing",
        };
      }
      const nextRequest: JoyTourPlanRequest = {
        ...baseRequest,
        maxStops: capped.maxStops,
        provided: { ...baseRequest.provided, maxStops: true },
      };
      return proposeJoyTourPlan(nextRequest, {
        ...context,
        memory: {
          ...context.memory,
          tourDraft: { ...draft, maxStops: nextRequest.maxStops },
        },
      });
    }

    case "replace": {
      const stopIds = draft.stopCompanyIds ?? [];
      let removeId: string | null = null;
      if (command.removeQuery) {
        const pattern = escapeIlikePattern(command.removeQuery);
        if (pattern && stopIds.length > 0) {
          const supabase = await createServerClient();
          const { data } = await supabase
            .from("companies")
            .select("id,name")
            .in("id", stopIds)
            .ilike("name", pattern)
            .limit(1);
          removeId = data?.[0]?.id ?? null;
        }
      }
      if (!removeId && stopIds.length > 0) {
        removeId = stopIds[0]!;
      }
      if (!command.addQuery) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: "Di' «sostituisci [cliente] con [altro]» indicando entrambi i nomi.",
            createdAt: new Date().toISOString(),
          },
          sessionState: "proposing",
        };
      }
      const addPattern = escapeIlikePattern(command.addQuery);
      const supabase = await createServerClient();
      let addQuery = supabase
        .from("companies")
        .select("id,name")
        .ilike("name", addPattern ?? `%${command.addQuery}%`)
        .limit(1);
      if (context.userId) {
        addQuery = applyAgentCompanyScope(addQuery, context.userId);
      }
      const { data: addRows } = await addQuery;
      const addCompany = addRows?.[0];
      if (!addCompany) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: `Non ho trovato «${command.addQuery}» nel CRM da inserire al posto della tappa.`,
            createdAt: new Date().toISOString(),
          },
          sessionState: "proposing",
        };
      }
      const skipped = [
        ...new Set([
          ...(draft.skippedCompanyIds ?? []).filter((id) => id !== addCompany.id),
          ...(removeId ? [removeId] : []),
        ]),
      ];
      const forceInclude = [
        ...new Set(
          [...(draft.forceIncludeCompanyIds ?? []), addCompany.id].filter(
            (id) => id !== removeId
          )
        ),
      ];
      return proposeJoyTourPlan(
        {
          ...baseRequest,
          forceIncludeCompanyIds: forceInclude,
        },
        {
          ...context,
          memory: {
            ...context.memory,
            tourDraft: {
              ...draft,
              skippedCompanyIds: skipped,
              forceIncludeCompanyIds: forceInclude,
            },
          },
        }
      );
    }

    case "nearby_prospect": {
      const center =
        context.latitude != null && context.longitude != null
          ? { lat: context.latitude, lng: context.longitude }
          : draft.lastLat != null && draft.lastLng != null
            ? { lat: draft.lastLat, lng: draft.lastLng }
            : context.memory?.lastLat != null && context.memory?.lastLng != null
              ? { lat: context.memory.lastLat, lng: context.memory.lastLng }
              : null;
      if (!center) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content:
              "Per un prospect vicino mi serve la posizione GPS. Attiva la geolocalizzazione e riprova.",
            createdAt: new Date().toISOString(),
          },
          sessionState: "proposing",
        };
      }
      const radius = Math.min(draft.radiusKm ?? 15, 30);
      const nearbyRequest: JoyTourPlanRequest = {
        ...baseRequest,
        audience: "prospect",
        commercialStatus: "prospect",
        zoneMode: "gps",
        radiusKm: radius,
        centerLat: center.lat,
        centerLng: center.lng,
        city: null,
        cap: null,
        province: null,
        provided: { ...baseRequest.provided, audience: true, zone: true },
      };
      const candidates = await fetchCandidateCompanies(
        nearbyRequest,
        context.userId,
        [...(draft.skippedCompanyIds ?? []), ...(draft.stopCompanyIds ?? [])],
        center
      );
      const nearest = candidates
        .filter((row) => row.latitude != null && row.longitude != null)
        .map((row) => ({
          row,
          km: getDistanceKm(center.lat, center.lng, row.latitude!, row.longitude!),
        }))
        .sort((a, b) => a.km - b.km)[0];
      if (!nearest) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: `Nessun prospect geolocalizzato entro ${radius} km dalla tua posizione.`,
            createdAt: new Date().toISOString(),
          },
          sessionState: "proposing",
        };
      }
      const forceInclude = [
        ...new Set([...(draft.forceIncludeCompanyIds ?? []), nearest.row.id]),
      ];
      const needed = Math.max(
        (draft.stopCompanyIds?.length ?? draft.maxStops ?? JOY_TOUR_MID_MAX_STOPS) + 1,
        forceInclude.length
      );
      const capped = resolveMidTourMaxStops(draft.maxStops, needed);
      if (!capped.ok) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: `Trovato **${nearest.row.name}** (${formatDistanceKm(nearest.km)}), ma sei già a ${capped.cap} visite. Usa «sostituisci … con ${nearest.row.name}».`,
            createdAt: new Date().toISOString(),
          },
          sessionState: "proposing",
        };
      }
      return proposeJoyTourPlan(
        {
          ...baseRequest,
          audience: "prospect",
          commercialStatus: "prospect",
          maxStops: capped.maxStops,
          forceIncludeCompanyIds: forceInclude,
          provided: { ...baseRequest.provided, audience: true, maxStops: true },
        },
        {
          ...context,
          latitude: center.lat,
          longitude: center.lng,
          memory: {
            ...context.memory,
            tourDraft: {
              ...draft,
              audience: "prospect",
              maxStops: capped.maxStops,
              forceIncludeCompanyIds: forceInclude,
              lastLat: center.lat,
              lastLng: center.lng,
            },
          },
        }
      );
    }

    case "nearby_segment": {
      const center =
        context.latitude != null && context.longitude != null
          ? { lat: context.latitude, lng: context.longitude }
          : draft.lastLat != null && draft.lastLng != null
            ? { lat: draft.lastLat, lng: draft.lastLng }
            : context.memory?.lastLat != null && context.memory?.lastLng != null
              ? { lat: context.memory.lastLat, lng: context.memory.lastLng }
              : null;
      if (!center) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content:
              "Per cercare falegnami/showroom/fabbri vicini mi serve il GPS. Attiva la geolocalizzazione e riprova.",
            createdAt: new Date().toISOString(),
          },
          sessionState: "proposing",
        };
      }
      const radius = Math.min(draft.radiusKm ?? 20, 35);
      const segmentRequest: JoyTourPlanRequest = {
        ...baseRequest,
        segment: command.segment,
        audience: "entrambi",
        commercialStatus: null,
        zoneMode: "gps",
        radiusKm: radius,
        centerLat: center.lat,
        centerLng: center.lng,
        city: null,
        cap: null,
        province: null,
        provided: { ...baseRequest.provided, segment: true, zone: true },
      };
      const candidates = await fetchCandidateCompanies(
        segmentRequest,
        context.userId,
        [...(draft.skippedCompanyIds ?? []), ...(draft.stopCompanyIds ?? [])],
        center
      );
      const nearest = candidates
        .filter((row) => row.latitude != null && row.longitude != null)
        .map((row) => ({
          row,
          km: getDistanceKm(center.lat, center.lng, row.latitude!, row.longitude!),
        }))
        .sort((a, b) => a.km - b.km)[0];
      if (!nearest) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: `Nessun **${command.segment}** geolocalizzato entro ${radius} km.`,
            createdAt: new Date().toISOString(),
          },
          sessionState: "proposing",
        };
      }
      const forceInclude = [
        ...new Set([...(draft.forceIncludeCompanyIds ?? []), nearest.row.id]),
      ];
      const needed = Math.max(
        (draft.stopCompanyIds?.length ?? draft.maxStops ?? JOY_TOUR_MID_MAX_STOPS) + 1,
        forceInclude.length
      );
      const capped = resolveMidTourMaxStops(draft.maxStops, needed);
      if (!capped.ok) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: `Trovato **${nearest.row.name}** (${formatDistanceKm(nearest.km)}), ma sei al max ${capped.cap} visite. Usa «sostituisci … con ${nearest.row.name}».`,
            createdAt: new Date().toISOString(),
          },
          sessionState: "proposing",
        };
      }
      return proposeJoyTourPlan(
        {
          ...baseRequest,
          segment: command.segment,
          maxStops: capped.maxStops,
          forceIncludeCompanyIds: forceInclude,
          provided: { ...baseRequest.provided, segment: true, maxStops: true },
        },
        {
          ...context,
          latitude: center.lat,
          longitude: center.lng,
          memory: {
            ...context.memory,
            tourDraft: {
              ...draft,
              maxStops: capped.maxStops,
              forceIncludeCompanyIds: forceInclude,
              lastLat: center.lat,
              lastLng: center.lng,
            },
          },
        }
      );
    }

    case "avoid_traffic": {
      // Nessuna API traffico a pagamento: ri-ottimizza l'ordine tappe con OSRM
      // partendo dalla posizione attuale per ridurre i tempi di guida stimati.
      const response = await proposeJoyTourPlan(baseRequest, {
        ...context,
        memory: {
          ...context.memory,
          tourDraft: {
            ...draft,
            startMode:
              context.latitude != null && context.longitude != null
                ? "gps"
                : draft.startMode ?? "gps",
            lastLat: context.latitude ?? draft.lastLat,
            lastLng: context.longitude ?? draft.lastLng,
          },
        },
      });
      if (response.message?.content) {
        response.message = {
          ...response.message,
          content: [
            "Ho **riordinato il giro** per ridurre i tempi di guida stimati (OSRM).",
            "Non uso traffico live a pagamento: è una ri-ottimizzazione del percorso rimanente.",
            "",
            response.message.content,
          ].join("\n"),
        };
      }
      return response;
    }

    case "next_stop": {
      const stopIds = draft.stopCompanyIds ?? [];
      if (stopIds.length === 0) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: "Non ho tappe nella proposta corrente.",
            createdAt: new Date().toISOString(),
          },
        };
      }

      const currentIndex = Math.min(
        Math.max(0, draft.currentStopIndex ?? 0),
        stopIds.length - 1
      );
      const nextIndex =
        draft.phase === "active" && draft.currentStopIndex != null
          ? Math.min(currentIndex + 1, stopIds.length - 1)
          : currentIndex;
      const companyId = stopIds[nextIndex]!;

      const supabase = await createServerClient();
      const { data } = await supabase
        .from("companies")
        .select("id,name,city,phone,contact_phone,mobile,latitude,longitude")
        .eq("id", companyId)
        .maybeSingle();

      if (!data) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: "Non riesco a recuperare la prossima tappa dai dati CRM.",
            createdAt: new Date().toISOString(),
          },
        };
      }

      const referent = await resolveReferentPhone(data.id, data as CompanyGeoRow);
      const maps =
        data.latitude != null && data.longitude != null
          ? buildGoogleMapsTourUrl(
              { lat: data.latitude, lng: data.longitude },
              { lat: data.latitude, lng: data.longitude },
              []
            )
          : null;

      const isLast = nextIndex >= stopIds.length - 1;

      let briefingSnippet: string | null = null;
      try {
        const { getCompanyBriefing } = await import("@/features/joy/tools/get-company-briefing");
        const briefing = await getCompanyBriefing(data.id);
        if (briefing.hasData && briefing.data?.summaryText) {
          const compact = briefing.data.summaryText
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .slice(0, 4)
            .join("\n");
          briefingSnippet = compact.slice(0, 420);
        }
      } catch {
        briefingSnippet = null;
      }

      return {
        message: {
          id: newMessageId(),
          role: "assistant",
          content: [
            `**Tappa ${nextIndex + 1}/${stopIds.length}:** ${data.name}${data.city ? ` (${data.city})` : ""}`,
            referent.contactName ? `Referente: ${referent.contactName}` : null,
            referent.phone ? `Telefono: ${referent.phone}` : null,
            briefingSnippet ? `\n**Briefing rapido:**\n${briefingSnippet}` : null,
            isLast
              ? "Questa è l'ultima tappa della proposta."
              : "Di' di nuovo «prossima tappa» per avanzare.",
            "Conferma ancora aperta sulla proposta completa — nessun salvataggio automatico.",
          ]
            .filter(Boolean)
            .join("\n"),
          createdAt: new Date().toISOString(),
          actions: [
            ...buildCompanyChatActions(
              {
                id: data.id,
                name: data.name,
                phone: referent.phone,
                latitude: data.latitude,
                longitude: data.longitude,
              },
              "next-stop"
            ).slice(0, 3),
            ...(maps
              ? [
                  {
                    id: "next-maps",
                    kind: "navigate" as const,
                    label: "Google Maps",
                    href: maps,
                    external: true,
                  },
                ]
              : []),
          ],
        },
        memoryPatch: {
          lastCompanyId: data.id,
          lastCompanyName: data.name,
          selectedClientId: data.id,
          selectedClientName: data.name,
          tourDraft: {
            ...draft,
            phase: "active",
            currentStopIndex: nextIndex,
            lastLat: data.latitude ?? draft.lastLat,
            lastLng: data.longitude ?? draft.lastLng,
          },
        },
        sessionState: "proposing",
      };
    }

    case "call_referent": {
      const stopIds = draft.stopCompanyIds ?? [];
      const supabase = await createServerClient();
      const currentIndex = Math.min(
        Math.max(0, draft.currentStopIndex ?? 0),
        Math.max(0, stopIds.length - 1)
      );
      let companyId = stopIds[currentIndex] ?? stopIds[0] ?? null;
      if (command.companyQuery) {
        const pattern = escapeIlikePattern(command.companyQuery);
        const { data } = await supabase
          .from("companies")
          .select("id")
          .in("id", stopIds.length > 0 ? stopIds : ["00000000-0000-0000-0000-000000000000"])
          .ilike("name", pattern ?? `%${command.companyQuery}%`)
          .limit(1);
        companyId = data?.[0]?.id ?? companyId;
      }
      if (!companyId) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: "Non ho un referente da chiamare nella proposta corrente.",
            createdAt: new Date().toISOString(),
          },
        };
      }
      const { data } = await supabase
        .from("companies")
        .select("id,name,phone,contact_phone,mobile")
        .eq("id", companyId)
        .maybeSingle();
      const referent = data
        ? await resolveReferentPhone(data.id, data as CompanyGeoRow)
        : { phone: null, contactName: null };
      if (!referent.phone) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: `Non ho un telefono referente salvato per **${data?.name ?? "questa azienda"}** nel CRM.`,
            createdAt: new Date().toISOString(),
            actions: data
              ? buildCompanyChatActions({ id: data.id, name: data.name }, "call-miss").slice(0, 1)
              : [],
          },
        };
      }
      const who = referent.contactName
        ? `${referent.contactName} · ${data!.name}`
        : data!.name;
      return {
        message: {
          id: newMessageId(),
          role: "assistant",
          content: `Chiama **${who}**: ${referent.phone}`,
          createdAt: new Date().toISOString(),
          actions: [
            {
              id: "call-ref",
              kind: "call",
              label: `Chiama ${referent.contactName ?? data!.name}`,
              href: `tel:${referent.phone.replace(/\s+/g, "")}`,
            },
          ],
        },
        memoryPatch: {
          lastCompanyId: data!.id,
          lastCompanyName: data!.name,
          lastContactName: referent.contactName,
          selectedClientId: data!.id,
          selectedClientName: data!.name,
        },
        sessionState: "proposing",
      };
    }

    case "open_maps": {
      const stopIds = draft.stopCompanyIds ?? [];
      if (stopIds.length === 0) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: "Non ho coordinate per aprire Google Maps sulla proposta.",
            createdAt: new Date().toISOString(),
          },
        };
      }
      const supabase = await createServerClient();
      const { data } = await supabase
        .from("companies")
        .select("id,name,latitude,longitude")
        .in("id", stopIds)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      const points = (data ?? []).filter((r) => r.latitude != null && r.longitude != null);
      if (points.length === 0) {
        return {
          message: {
            id: newMessageId(),
            role: "assistant",
            content: "Nessuna tappa geolocalizzata disponibile per Maps.",
            createdAt: new Date().toISOString(),
          },
        };
      }
      // Mantieni ordine della proposta
      const ordered = stopIds
        .map((id) => points.find((p) => p.id === id))
        .filter(Boolean) as Array<{ latitude: number; longitude: number }>;
      const originPt = {
        lat: context.latitude ?? draft.lastLat ?? ordered[0]!.latitude,
        lng: context.longitude ?? draft.lastLng ?? ordered[0]!.longitude,
      };
      const dest = ordered[ordered.length - 1]!;
      const waypoints = ordered.slice(0, -1).map((p) => ({ lat: p.latitude, lng: p.longitude }));
      const url = buildGoogleMapsTourUrl(originPt, { lat: dest.latitude, lng: dest.longitude }, waypoints);
      return {
        message: {
          id: newMessageId(),
          role: "assistant",
          content: `Apro **Google Maps** con ${ordered.length} tappe della proposta (non salvata).`,
          createdAt: new Date().toISOString(),
          actions: [
            {
              id: "open-tour-maps",
              kind: "navigate",
              label: "Apri Google Maps",
              href: url,
              external: true,
            },
          ],
          pendingAction: {
            id: newPendingId(),
            title: "Apri Google Maps",
            description: `${ordered.length} tappe`,
            operation: { type: "navigate", href: url, label: "Google Maps" },
            status: "pending",
          },
        },
        sessionState: "confirming",
      };
    }
  }
}

/**
 * Entry point: intake multi-turn, proposta, comandi runtime.
 * Restituisce null se il messaggio non riguarda il giro.
 */
export async function processJoyTourPlanning(
  message: string,
  context: JoyTourPlannerContext
): Promise<JoyChatResponse | null> {
  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  const memory = context.memory ?? {};
  const runtime = parseJoyTourRuntimeCommand(trimmed);
  const isNewTourCommand = isJoyTourPlanCommand(trimmed);
  const isFreshProspectSearch =
    isNewTourCommand &&
    /\bprospect\b/i.test(trimmed) &&
    /trovami|trova|dammi|elenca|lista|mostrami|proponi/i.test(trimmed);

  // Runtime su proposta/attivo: non dirottare «Trovami N prospect a … fino alle …»
  // (matcherebbe arrive_by e rieseguirebbe la bozza vecchia senza la città nuova).
  if (
    runtime &&
    (memory.tourDraft?.phase === "proposed" || memory.tourDraft?.phase === "active") &&
    !isFreshProspectSearch
  ) {
    return handleRuntimeCommand(runtime, context);
  }

  // Rigenera anche da intake se c'è bozza completa
  if (runtime?.type === "regenerate" && memory.tourDraft) {
    const request = draftToPartialRequest(memory.tourDraft, trimmed);
    if (isTourRequestComplete(request) || (memory.tourDraft.stopCompanyIds?.length ?? 0) > 0) {
      return proposeJoyTourPlan(request, context);
    }
  }

  if (runtime?.type === "cancel_tour" && memory.tourDraft) {
    return handleRuntimeCommand(runtime, context);
  }

  // Intake in corso: interpreta la risposta — non se è un comando giro completo nuovo
  if (isJoyTourIntakeActive(memory) && !isFreshProspectSearch) {
    const updated = applyTourIntakeAnswer(memory.tourDraft!, trimmed);
    if (updated.awaitingField === memory.tourDraft!.awaitingField) {
      return intakeResponse(
        `Non ho capito. ${buildIntakeQuestion(memory.tourDraft!.awaitingField!)}`,
        memory.tourDraft!
      );
    }
    return askNextIntakeQuestion(updated, {
      ...context,
      memory: { ...memory, tourDraft: updated },
    });
  }

  // Modifica su bozza esistente (dopo "Modifica il giro: …")
  if (
    memory.tourDraft &&
    (memory.tourDraft.phase === "proposed" || memory.tourDraft.phase === "intake") &&
    /modifica\s+(?:il\s+)?giro/i.test(trimmed)
  ) {
    const withoutPrefix = trimmed.replace(/modifica\s+(?:il\s+)?giro\s*:?\s*/i, "").trim();
    if (!withoutPrefix) {
      return handleRuntimeCommand({ type: "modify", raw: trimmed }, context);
    }
    const updated = applyTourIntakeAnswer(
      { ...memory.tourDraft, phase: "intake", awaitingField: null },
      withoutPrefix
    );
    // Applica anche parse ricco
    const parsed = parseJoyTourPlanRequest(`Organizza giro ${withoutPrefix}`, {
      lastComune: memory.lastComune,
      lastCap: memory.lastCap,
      lastDestinazione: memory.lastDestinazione,
      tourDraft: updated,
    });
    if (parsed && isTourRequestComplete(parsed)) {
      return proposeJoyTourPlan(parsed, context);
    }
    return askNextIntakeQuestion(updated, {
      ...context,
      memory: { ...memory, tourDraft: updated },
    });
  }

  if (!isNewTourCommand) {
    return null;
  }

  // Nuovo comando / ripresa pianificazione
  const parsed = parseJoyTourPlanRequest(trimmed, {
    lastComune: memory.lastComune,
    lastCap: memory.lastCap,
    lastDestinazione: memory.lastDestinazione,
    // Nuova ricerca prospect: non ereditare città/orario sbagliati dalla bozza precedente
    tourDraft:
      /\bprospect\b/i.test(trimmed) && /trovami|trova|dammi|elenca|lista|mostrami/i.test(trimmed)
        ? null
        : memory.tourDraft,
  });

  if (!parsed) {
    return {
      message: {
        id: newMessageId(),
        role: "assistant",
        content:
          "Organizziamo il giro insieme. Per quale giorno? Oggi o domani?",
        createdAt: new Date().toISOString(),
      },
      memoryPatch: {
        tourDraft: {
          phase: "intake",
          awaitingField: "day",
          skippedCompanyIds: [],
        },
      },
      sessionState: "proposing",
    };
  }

  logTourPipeline({
    step: "parsed_request",
    rawText: trimmed,
    intent: "plan_tour",
    city: parsed.city,
    startCity: parsed.startCity,
    endCity: parsed.endCity,
    maxStops: parsed.maxStops,
    maxArrivalTime: parsed.maxArrivalTime,
    audience: parsed.audience,
    commercialStatus: parsed.commercialStatus,
    zoneMode: parsed.zoneMode,
    startMode: parsed.startMode,
    userId: context.userId,
  });

  // Se il messaggio è ricco e completo → proposta diretta
  if (isTourRequestComplete(parsed)) {
    return proposeJoyTourPlan(parsed, context);
  }

  // Altrimenti avvia / continua intake con i campi già noti
  const draft: JoyTourPlanDraft = {
    phase: "intake",
    day: parsed.provided.day ? parsed.day : memory.tourDraft?.day ?? null,
    city: parsed.city,
    cap: parsed.cap,
    province: parsed.province,
    zoneMode: parsed.zoneMode ?? memory.tourDraft?.zoneMode ?? null,
    radiusKm: parsed.radiusKm ?? memory.tourDraft?.radiusKm ?? null,
    audience: parsed.provided.audience ? parsed.audience : memory.tourDraft?.audience ?? null,
    maxStops: parsed.provided.maxStops ? parsed.maxStops : memory.tourDraft?.maxStops ?? null,
    maxArrivalTime: parsed.provided.maxArrivalTime
      ? parsed.maxArrivalTime
      : memory.tourDraft?.maxArrivalTime ?? null,
    startMode: parsed.provided.startMode ? parsed.startMode : memory.tourDraft?.startMode ?? null,
    startCity: parsed.startCity,
    endCity: parsed.endCity,
    skippedCompanyIds: memory.tourDraft?.skippedCompanyIds ?? [],
    forceIncludeCompanyIds: memory.tourDraft?.forceIncludeCompanyIds ?? [],
    awaitingField: null,
    lastLat: parsed.centerLat ?? memory.tourDraft?.lastLat ?? memory.lastLat ?? null,
    lastLng: parsed.centerLng ?? memory.tourDraft?.lastLng ?? memory.lastLng ?? null,
  };

  // Se "Organizza il mio giro" senza nulla, day non è provided
  if (!parsed.provided.day) {
    draft.day = null;
  }

  return askNextIntakeQuestion(draft, {
    ...context,
    memory: { ...memory, tourDraft: draft },
  });
}

/** Suggerimenti commerciali proattivi (reasoning, non solo esecuzione). */
export async function buildCommercialProposals(
  userId: string | null,
  options?: { latitude?: number | null; longitude?: number | null }
): Promise<string[]> {
  const {
    buildUnifiedCommercialProposals,
  } = await import("./joy-commercial-proposals.service");
  const proposals = await buildUnifiedCommercialProposals({
    userId,
    latitude: options?.latitude ?? null,
    longitude: options?.longitude ?? null,
    limit: 8,
  });
  return proposals.map((item) => item.text);
}

export function estimateTravelHint(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): string {
  const km = getDistanceKm(from.lat, from.lng, to.lat, to.lng);
  const minutes = Math.round((km / 45) * 60);
  return `${formatDistanceKm(km)} · ~${minutes} min`;
}
