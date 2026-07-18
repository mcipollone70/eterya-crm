/**
 * Playwright WebKit + iPhone viewport evidence.
 * NOT a physical iPhone — WebKit emulation only.
 *
 *   npx tsx scripts/iphone-webkit-map-audit.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { webkit, devices } from "playwright";
import {
  buildGoogleMapsTourUrl,
  buildGoogleMapsDestinationUrl,
} from "../features/routes/utils/google-maps-tour-url";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT_DIR = join(process.cwd(), "scripts", "_iphone-webkit-evidence");
const IPHONE = devices["iPhone 14 Pro"];

mkdirSync(OUT_DIR, { recursive: true });

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

  const report: Record<string, unknown> = {
    mode: "WebKit iPhone 14 Pro simulation (NOT physical iPhone)",
    baseUrl: BASE_URL,
    viewport: IPHONE.viewport,
    startedAt: new Date().toISOString(),
  };

  // Synthetic layout: same height formula as companies-map shell
  await page.setContent(`<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html,body{margin:0;height:100%;}
  .shell{
    position:relative;
    width:100%;
    height:calc(100dvh - 11.5rem - env(safe-area-inset-bottom, 0px));
    min-height:280px;
    background:#cbd5e1;
  }
  .leaflet-container{position:absolute;inset:0;width:100%;height:100%;background:#94a3b8;}
  .cta{
    position:fixed;left:12px;right:12px;bottom:calc(72px + env(safe-area-inset-bottom,0px));
    height:44px;background:#4f46e5;color:#fff;display:flex;align-items:center;justify-content:center;
    text-decoration:none;border-radius:8px;font-family:system-ui;
  }
  .nav{position:fixed;left:0;right:0;bottom:0;height:56px;background:#fff;border-top:1px solid #e2e8f0;}
</style></head>
<body>
  <div class="shell" data-testid="companies-map-shell"><div class="leaflet-container"></div></div>
  <a class="cta" data-testid="google-maps-tour-link" href="${buildGoogleMapsTourUrl(
    { lat: 41.4677, lng: 12.9037 },
    { lat: 41.4677, lng: 12.9037 },
    [
      { lat: 41.4612, lng: 12.9125 },
      { lat: 41.4821, lng: 12.8912 },
      { lat: 41.5755, lng: 12.8288 },
      { lat: 41.5901, lng: 12.6502 },
    ]
  )}" target="_blank" rel="noopener noreferrer">Apri in Google Maps</a>
  <a data-testid="google-maps-next-stop-link" href="${buildGoogleMapsDestinationUrl({
    lat: 41.4612,
    lng: 12.9125,
  })}" target="_blank" rel="noopener noreferrer" style="display:none">next</a>
  <div class="nav"></div>
</body></html>`);

  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT_DIR, "01-synthetic-map-height.png") });

  const layout = await page.evaluate(() => {
    const shell = document.querySelector("[data-testid='companies-map-shell']") as HTMLElement;
    const leaflet = document.querySelector(".leaflet-container") as HTMLElement;
    const cta = document.querySelector("[data-testid='google-maps-tour-link']") as HTMLAnchorElement;
    const nav = document.querySelector(".nav") as HTMLElement;
    const shellRect = shell.getBoundingClientRect();
    const ctaRect = cta.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
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
      cta: {
        href: cta.href,
        y: ctaRect.y,
        bottom: ctaRect.bottom,
        aboveNav: ctaRect.bottom <= navRect.top + 1,
      },
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });
  report.syntheticLayout = layout;

  const mapsHref = await page.getByTestId("google-maps-tour-link").getAttribute("href");
  report.googleMapsTourHref = mapsHref;
  report.googleMapsTourHrefHttps = mapsHref?.startsWith("https://www.google.com/maps/") ?? false;
  report.nextStopHref = await page.getByTestId("google-maps-next-stop-link").getAttribute("href");

  // Click should navigate (popup/new tab). Capture target URL.
  const [popup] = await Promise.all([
    context.waitForEvent("page", { timeout: 5000 }).catch(() => null),
    page.getByTestId("google-maps-tour-link").click(),
  ]);
  if (popup) {
    report.webkitClickResult = { opened: true, url: popup.url() };
    await popup.close();
  } else {
    report.webkitClickResult = {
      opened: false,
      note: "No popup (possible same-tab navigation or blocked); href still valid HTTPS",
      currentUrl: page.url(),
    };
  }

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

  report.consoleErrors = consoleErrors.slice(-30);
  report.tileFailures = tileFailures.slice(-20);
  report.passed =
    (layout.shell.height as number) > 0 &&
    (layout.leaflet.clientHeight as number) > 0 &&
    Boolean(report.googleMapsTourHrefHttps) &&
    Boolean(layout.cta.aboveNav);

  writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.passed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
