import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGoogleMapsDestinationUrl,
  buildGoogleMapsTourUrl,
  buildGoogleMapsTourUrlDetailed,
  GOOGLE_MAPS_MAX_WAYPOINTS,
  isValidGeoPoint,
  segmentGoogleMapsTourUrls,
  tryBuildGoogleMapsTourUrl,
} from "../google-maps-tour-url";

const origin = { lat: 41.4677, lng: 12.9037 };
const destination = { lat: 41.5, lng: 12.95 };
const stops = [
  { lat: 41.47, lng: 12.91 },
  { lat: 41.48, lng: 12.92 },
  { lat: 41.49, lng: 12.93 },
  { lat: 41.495, lng: 12.94 },
];

describe("google-maps-tour-url", () => {
  it("builds HTTPS tour URL with origin, destination, waypoints, driving, navigate", () => {
    const result = buildGoogleMapsTourUrlDetailed(origin, destination, stops);
    const url = new URL(result.url);

    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "www.google.com");
    assert.ok(url.pathname.startsWith("/maps/dir"));
    assert.equal(url.searchParams.get("api"), "1");
    assert.equal(url.searchParams.get("origin"), "41.4677,12.9037");
    assert.equal(url.searchParams.get("destination"), "41.5,12.95");
    assert.equal(
      url.searchParams.get("waypoints"),
      "41.47,12.91|41.48,12.92|41.49,12.93|41.495,12.94"
    );
    assert.equal(url.searchParams.get("travelmode"), "driving");
    assert.equal(url.searchParams.get("dir_action"), "navigate");
    assert.equal(result.waypointCount, 4);
    assert.equal(result.truncated, false);
  });

  it("builds single-destination navigate URL", () => {
    const url = new URL(buildGoogleMapsDestinationUrl(stops[0]!));
    assert.equal(url.searchParams.get("destination"), "41.47,12.91");
    assert.equal(url.searchParams.get("travelmode"), "driving");
    assert.equal(url.searchParams.get("dir_action"), "navigate");
    assert.equal(url.searchParams.get("origin"), null);
  });

  it("rejects invalid coordinates", () => {
    assert.equal(isValidGeoPoint({ lat: NaN, lng: 12 }), false);
    assert.equal(isValidGeoPoint({ lat: 91, lng: 12 }), false);
    assert.equal(tryBuildGoogleMapsTourUrl({ lat: NaN, lng: 1 }, destination, []), null);
    assert.throws(() => buildGoogleMapsTourUrl({ lat: NaN, lng: 1 }, destination, []));
    assert.throws(() => buildGoogleMapsDestinationUrl({ lat: 200, lng: 12 }));
  });

  it("keeps 4 stops as a single segment URL", () => {
    const urls = segmentGoogleMapsTourUrls(origin, destination, stops);
    assert.equal(urls.length, 1);
    assert.ok(urls[0]!.includes("dir_action=navigate"));
  });

  it("segments when waypoints exceed Google Maps limit", () => {
    const many = Array.from({ length: GOOGLE_MAPS_MAX_WAYPOINTS + 3 }, (_, i) => ({
      lat: 41.4 + i * 0.01,
      lng: 12.9 + i * 0.01,
    }));
    const urls = segmentGoogleMapsTourUrls(origin, destination, many);
    assert.ok(urls.length >= 2);
    for (const href of urls) {
      assert.ok(href.startsWith("https://www.google.com/maps/dir/"));
    }
  });
});
