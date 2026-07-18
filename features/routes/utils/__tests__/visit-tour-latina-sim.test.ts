import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { optimizeVisitTour } from "@/lib/visit-tour/optimize";
import type { VisitTourOptimizeContext } from "@/lib/visit-tour/scoring";
import { buildGoogleMapsTourUrlDetailed } from "../google-maps-tour-url";

/** 4 aziende geolocalizzate vicino Latina (simulazione, niente duplicati DB). */
const latinaCompanies = [
  {
    id: "sim-lt-1",
    name: "Ferramenta Latina Nord",
    city: "Latina",
    province: "LT",
    phone: null,
    revenue: 120000,
    lastVisitAt: null,
    commercial_status: "cliente" as const,
    status: "active" as const,
    latitude: 41.4821,
    longitude: 12.8912,
    import_payload: null,
  },
  {
    id: "sim-lt-2",
    name: "Edilizia Pontina",
    city: "Latina",
    province: "LT",
    phone: null,
    revenue: 80000,
    lastVisitAt: null,
    commercial_status: "prospect" as const,
    status: "active" as const,
    latitude: 41.4612,
    longitude: 12.9125,
    import_payload: null,
  },
  {
    id: "sim-lt-3",
    name: "Serramenti Aprilia Sud",
    city: "Aprilia",
    province: "LT",
    phone: null,
    revenue: 95000,
    lastVisitAt: "2025-01-01T10:00:00.000Z",
    commercial_status: "cliente" as const,
    status: "active" as const,
    latitude: 41.5901,
    longitude: 12.6502,
    import_payload: null,
  },
  {
    id: "sim-lt-4",
    name: "Infissi Cisterna",
    city: "Cisterna di Latina",
    province: "LT",
    phone: null,
    revenue: 70000,
    lastVisitAt: null,
    commercial_status: "da_ricontattare" as const,
    status: "active" as const,
    latitude: 41.5755,
    longitude: 12.8288,
    import_payload: null,
  },
];

const emptyContext: VisitTourOptimizeContext = {
  lastVisitByCompany: {},
  lastContactByCompany: {},
  openOpportunityCompanies: [],
  overdueFollowUpCompanyIds: [],
  visitedTodayCompanyIds: [],
};

describe("visit tour Latina 4-stop simulation", () => {
  it("optimizes stops and builds one Google Maps navigate URL", () => {
    const origin = { lat: 41.4677, lng: 12.9037 };
    const destination = { lat: 41.4677, lng: 12.9037 };

    const plan = optimizeVisitTour({
      origin,
      destination,
      companies: latinaCompanies,
      context: emptyContext,
      constraints: {
        maxDurationMinutes: 480,
        maxStops: 4,
        maxDeviationKm: 40,
      },
      existingStops: [],
    });

    assert.ok(plan.stops.length >= 1, `expected stops, got ${plan.stops.length}`);
    assert.ok(plan.totalDistanceKm >= 0);
    assert.ok(plan.estimatedMinutes >= 0);

    const maps = buildGoogleMapsTourUrlDetailed(
      origin,
      destination,
      plan.stops.map((stop) => ({
        lat: stop.company.latitude,
        lng: stop.company.longitude,
      }))
    );

    assert.equal(maps.truncated, false);
    assert.ok(maps.url.includes("dir_action=navigate"));
    assert.ok(maps.url.startsWith("https://www.google.com/maps/dir/"));

    console.log(
      JSON.stringify({
        stopCount: plan.stops.length,
        order: plan.stops.map((s) => s.company.name),
        totalDistanceKm: plan.totalDistanceKm,
        estimatedMinutes: plan.estimatedMinutes,
        googleMapsUrl: maps.url,
      })
    );
  });
});
