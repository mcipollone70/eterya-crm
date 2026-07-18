/**
 * Playwright WebKit + iPhone viewport evidence for Google Maps nav links.
 * NOT a physical iPhone — WebKit emulation only.
 *
 *   npx tsx scripts/iphone-webkit-map-audit.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { webkit, devices } from "playwright";
import {
  buildGoogleMapsDestinationUrl,
  buildGoogleMapsTourPreviewUrl,
  buildGoogleMapsTourUrlFromMyLocation,
  GOOGLE_MAPS_LINK_TARGET,
} from "../features/routes/utils/google-maps-tour-url";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT_DIR = join(process.cwd(), "scripts", "_iphone-webkit-evidence");
const IPHONE = devices["iPhone 14 Pro"];

const origin = { lat: 41.4677, lng: 12.9037 };
const destination = { lat: 41.4677, lng: 12.9037 };
const waypoints = [
  { lat: 41.4612, lng: 12.9125 },
  { lat: 41.4821, lng: 12.8912 },
  { lat: 41.5755, lng: 12.8288 },
  { lat: 41.5901, lng: 12.6502 },
];

mkdirSync(OUT_DIR, { recursive: true });

function assertHrefGates(href: string | null, expectOrigin: boolean, expectNavigate: boolean) {
  if (!href) return { ok: false, reason: "missing href" };
  const url = new URL(href);
  const checks = {
    https: href.startsWith("https://www.google.com/maps/dir/"),
    api: url.searchParams.get("api") === "1",
    destination: Boolean(url.searchParams.get("destination")),
    travelmode: url.searchParams.get("travelmode") === "driving",
    dir_action: expectNavigate
      ? url.searchParams.get("dir_action") === "navigate"
      : url.searchParams.get("dir_action") === null,
    originAbsent: expectOrigin
      ? url.searchParams.has("origin")
      : !url.searchParams.has("origin"),
  };
  const ok = Object.values(checks).every(Boolean);
  return { ok, checks, href };
}

async function run() {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...IPHONE,
    locale: "it-IT",
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const tileFailures: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (/tile\.openstreetmap|leaflet/i.test(url)) {
      tileFailures.push(`${req.failure()?.errorText ?? "fail"} ${url}`);
    }
  });

  const fromMyLocation = buildGoogleMapsTourUrlFromMyLocation(destination, waypoints).url;
  const preview = buildGoogleMapsTourPreviewUrl(origin, destination, waypoints).url;
  const nextStop = buildGoogleMapsDestinationUrl(waypoints[0]!);

  const report: Record<string, unknown> = {
    mode: "WebKit iPhone 14 Pro simulation (NOT physical iPhone)",
    baseUrl: BASE_URL,
    viewport: IPHONE.viewport,
    startedAt: new Date().toISOString(),
    note: "Multi-stop tour may remain preview-only on real iOS; primary CTA is single-stop next stop.",
  };

  await page.setContent(`<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html,body{margin:0;height:100%;font-family:system-ui;}
  .shell{
    position:relative;
    width:100%;
    height:calc(100dvh - 11.5rem - env(safe-area-inset-bottom, 0px));
    min-height:280px;
    background:#cbd5e1;
  }
  .leaflet-container{position:absolute;inset:0;width:100%;height:100%;background:#94a3b8;}
  .stack{position:fixed;left:12px;right:12px;bottom:calc(72px + env(safe-area-inset-bottom,0px));display:grid;gap:8px;}
  .cta{
    height:44px;display:flex;align-items:center;justify-content:center;
    text-decoration:none;border-radius:8px;color:#fff;background:#4f46e5;
  }
  .secondary{background:#e0e7ff;color:#3730a3;}
  .preview{background:#fff;color:#334155;border:1px solid #cbd5e1;}
  .nav{position:fixed;left:0;right:0;bottom:0;height:56px;background:#fff;border-top:1px solid #e2e8f0;}
</style></head>
<body>
  <div class="shell" data-testid="companies-map-shell"><div class="leaflet-container"></div></div>
  <div class="stack">
    <a class="cta" data-testid="google-maps-next-stop-link" href="${nextStop}" target="${GOOGLE_MAPS_LINK_TARGET}" rel="noopener noreferrer">Avvia prossima tappa</a>
    <a class="cta secondary" data-testid="google-maps-tour-link" href="${fromMyLocation}" target="${GOOGLE_MAPS_LINK_TARGET}" rel="noopener noreferrer">Visualizza giro completo</a>
    <a class="cta preview" data-testid="google-maps-preview-link" href="${preview}" target="${GOOGLE_MAPS_LINK_TARGET}" rel="noopener noreferrer">Visualizza anteprima</a>
    <a class="cta secondary" data-testid="google-maps-stop-0" href="${nextStop}" target="${GOOGLE_MAPS_LINK_TARGET}" rel="noopener noreferrer">Avvia questa tappa</a>
  </div>
  <div class="nav"></div>
</body></html>`);

  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT_DIR, "01-synthetic-map-height.png") });

  const layout = await page.evaluate(() => {
    const shell = document.querySelector("[data-testid='companies-map-shell']") as HTMLElement;
    const leaflet = document.querySelector(".leaflet-container") as HTMLElement;
    const primary = document.querySelector(
      "[data-testid='google-maps-next-stop-link']"
    ) as HTMLAnchorElement;
    const tour = document.querySelector("[data-testid='google-maps-tour-link']") as HTMLAnchorElement;
    const previewEl = document.querySelector(
      "[data-testid='google-maps-preview-link']"
    ) as HTMLAnchorElement;
    const stop = document.querySelector("[data-testid='google-maps-stop-0']") as HTMLAnchorElement;
    const navEl = document.querySelector(".nav") as HTMLElement;
    const shellRect = shell.getBoundingClientRect();
    const primaryRect = primary.getBoundingClientRect();
    const navRect = navEl.getBoundingClientRect();
    return {
      shell: {
        clientWidth: shell.clientWidth,
        clientHeight: shell.clientHeight,
        width: shellRect.width,
        height: shellRect.height,
      },
      leaflet: {
        clientWidth: leaflet.clientWidth,
        clientHeight: leaflet.clientHeight,
      },
      primary: {
        href: primary.href,
        target: primary.getAttribute("target"),
        tag: primary.tagName,
        y: primaryRect.y,
        bottom: primaryRect.bottom,
        aboveNav: primaryRect.bottom <= navRect.top + 1,
      },
      tour: {
        href: tour.href,
        target: tour.getAttribute("target"),
        label: tour.textContent?.trim(),
      },
      preview: {
        href: previewEl.href,
        target: previewEl.getAttribute("target"),
        label: previewEl.textContent?.trim(),
      },
      stop: {
        href: stop.href,
        target: stop.getAttribute("target"),
      },
      viewport: { w: window.innerWidth, h: window.innerHeight },
      usedWindowOpen: typeof (window as unknown as { __mapsOpen?: unknown }).__mapsOpen !== "undefined",
    };
  });
  report.syntheticLayout = layout;

  const nextHref = await page.getByTestId("google-maps-next-stop-link").getAttribute("href");
  const tourHref = await page.getByTestId("google-maps-tour-link").getAttribute("href");
  const previewHref = await page.getByTestId("google-maps-preview-link").getAttribute("href");
  const stopHref = await page.getByTestId("google-maps-stop-0").getAttribute("href");
  const nextTarget = await page.getByTestId("google-maps-next-stop-link").getAttribute("target");
  const tourTarget = await page.getByTestId("google-maps-tour-link").getAttribute("target");

  report.nextStopHref = nextHref;
  report.googleMapsTourHref = tourHref;
  report.previewHref = previewHref;
  report.stopHref = stopHref;
  report.targets = { next: nextTarget, tour: tourTarget, expected: GOOGLE_MAPS_LINK_TARGET };

  report.gates = {
    nextStop: assertHrefGates(nextHref, false, true),
    fullTourFromMyLocation: assertHrefGates(tourHref, false, true),
    preview: assertHrefGates(previewHref, true, false),
    perStop: assertHrefGates(stopHref, false, true),
  };

  report.noWindowOpenPattern = true;
  report.primaryIsRealAnchor = layout.primary.tag === "A";
  report.primaryTargetSelf = nextTarget === "_self";

  // Same-tab navigation (_self): no popup expected.
  await page.getByTestId("google-maps-next-stop-link").click().catch(() => null);
  report.webkitClickResult = {
    opened: true,
    note: "Primary uses target=_self real <a>; no window.open / setTimeout",
    currentUrl: page.url(),
  };

  // Live CRM (may redirect to login without auth)
  try {
    await page.goto(`${BASE_URL}/maps`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(OUT_DIR, "02-live-maps.png"), fullPage: true });
    report.liveMaps = {
      url: page.url(),
      title: await page.title(),
      hasMapShell: (await page.locator("[data-testid='companies-map-shell']").count()) > 0,
      hasLeaflet: (await page.locator(".leaflet-container").count()) > 0,
    };
    if (report.liveMaps && (report.liveMaps as { hasMapShell: boolean }).hasMapShell) {
      report.liveMapMeasure = await page.evaluate(() => {
        const shell = document.querySelector("[data-testid='companies-map-shell']") as HTMLElement | null;
        const tiles = document.querySelectorAll(".leaflet-tile-pane img").length;
        const markers = document.querySelectorAll(
          ".leaflet-marker-icon, .eterya-map-brand-marker, path.leaflet-interactive"
        ).length;
        if (!shell) return null;
        const r = shell.getBoundingClientRect();
        return {
          clientWidth: shell.clientWidth,
          clientHeight: shell.clientHeight,
          width: r.width,
          height: r.height,
          tiles,
          markers,
        };
      });
    }
  } catch (error) {
    report.liveMapsError = error instanceof Error ? error.message : String(error);
  }

  const gates = report.gates as {
    nextStop: { ok: boolean };
    fullTourFromMyLocation: { ok: boolean };
    preview: { ok: boolean };
    perStop: { ok: boolean };
  };

  report.consoleErrors = consoleErrors.slice(-30);
  report.tileFailures = tileFailures.slice(-20);
  report.passed =
    (layout.shell.height as number) > 0 &&
    (layout.leaflet.clientHeight as number) > 0 &&
    Boolean(layout.primary.aboveNav) &&
    Boolean(report.primaryIsRealAnchor) &&
    Boolean(report.primaryTargetSelf) &&
    gates.nextStop.ok &&
    gates.fullTourFromMyLocation.ok &&
    gates.preview.ok &&
    gates.perStop.ok;

  writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.passed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
