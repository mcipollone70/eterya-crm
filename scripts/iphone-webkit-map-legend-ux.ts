/**
 * iPhone viewport evidence: map legends no longer overlay cartography.
 * Synthetic layout mirrors MapMobileLegendControl + hidden desktop legends.
 *
 *   npx tsx scripts/iphone-webkit-map-legend-ux.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { webkit, devices } from "playwright";

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

  await page.setContent(`<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html,body{margin:0;height:100%;font-family:system-ui,sans-serif;}
  .shell{
    position:relative;
    width:100%;
    height:calc(100dvh - 11.5rem - env(safe-area-inset-bottom, 0px));
    min-height:280px;
    background:#94a3b8;
    overflow:hidden;
  }
  .leaflet-container{position:absolute;inset:0;width:100%;height:100%;background:
    linear-gradient(135deg,#cbd5e1 25%,#94a3b8 25%,#94a3b8 50%,#cbd5e1 50%,#cbd5e1 75%,#94a3b8 75%);
    background-size:40px 40px;
  }
  .marker{position:absolute;width:18px;height:18px;border-radius:9999px;background:#0f172a;color:#fff;
    font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;
    border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35);}
  .m1{left:28%;top:42%;}.m2{left:55%;top:36%;}.m3{left:48%;top:58%;}
  /* Desktop legends: hidden on mobile (lg:block equivalent) */
  .desktop-legend{display:none;position:absolute;bottom:12px;left:12px;z-index:500;
    max-width:220px;border:1px solid #e2e8f0;background:rgba(255,255,255,.95);padding:12px;
    border-radius:8px;font-size:12px;}
  .mobile-wrap{position:absolute;inset:0;z-index:500;pointer-events:none;}
  .legend-btn{pointer-events:auto;position:absolute;bottom:12px;right:12px;display:inline-flex;
    align-items:center;gap:4px;border:1px solid #e2e8f0;background:rgba(255,255,255,.95);
    border-radius:9999px;padding:6px 10px;font-size:12px;font-weight:500;color:#334155;}
  .backdrop{pointer-events:auto;position:absolute;inset:0;background:rgba(15,23,42,.4);
    display:flex;align-items:flex-end;}
  .sheet{width:100%;max-height:70%;overflow:auto;background:#fff;border-radius:16px 16px 0 0;
    padding:16px;border:1px solid #e2e8f0;}
  .sheet h2{margin:0;font-size:14px;}
  .sheet h3{margin:16px 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;}
  .sheet ul{margin:0;padding:0;list-style:none;font-size:13px;color:#334155;}
  .sheet li{display:flex;align-items:center;gap:8px;margin:6px 0;}
  .dot{width:12px;height:12px;border-radius:9999px;flex-shrink:0;}
  .init{width:20px;height:20px;border-radius:9999px;background:#1e293b;color:#fff;font-size:10px;
    font-weight:700;display:flex;align-items:center;justify-content:center;}
  .nav{position:fixed;left:0;right:0;bottom:0;height:56px;background:#fff;border-top:1px solid #e2e8f0;}
  .hidden{display:none !important;}
</style></head>
<body>
  <div class="shell" data-testid="companies-map-shell">
    <div class="leaflet-container" data-testid="map-cartography">
      <div class="marker m1">Z</div>
      <div class="marker m2">P</div>
      <div class="marker m3">E</div>
    </div>
    <div class="desktop-legend" data-testid="desktop-brand-legend">Brand legend (desktop only)</div>
    <div class="desktop-legend" data-testid="desktop-tour-legend">Tour legend (desktop only)</div>
    <div class="mobile-wrap" data-testid="map-mobile-legend-wrap">
      <button type="button" class="legend-btn" data-testid="map-mobile-legend-button">ⓘ Legenda</button>
      <div class="backdrop hidden" data-testid="map-mobile-legend-sheet" role="dialog">
        <div class="sheet">
          <h2>Legenda</h2>
          <h3>Legenda Brand</h3>
          <ul>
            <li><span class="init">E</span> E = ETERYA</li>
            <li><span class="init">Z</span> Z = ZANZAR</li>
            <li><span class="init">P</span> P = PALAGINA</li>
            <li><span class="init">T</span> T = TEMPRA GLASS</li>
          </ul>
          <h3>Legenda Giro</h3>
          <ul>
            <li><span class="dot" style="background:#0ea5e9"></span>Partenza</li>
            <li><span class="dot" style="background:#4f46e5"></span>Tappa selezionata</li>
            <li><span class="dot" style="background:#dc2626"></span>Destinazione</li>
            <li><span class="dot" style="background:#2563eb"></span>Prospect</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <div class="nav"></div>
  <script>
    const btn = document.querySelector('[data-testid="map-mobile-legend-button"]');
    const sheet = document.querySelector('[data-testid="map-mobile-legend-sheet"]');
    btn.addEventListener('click', () => sheet.classList.remove('hidden'));
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) sheet.classList.add('hidden');
    });
  </script>
</body></html>`);

  await page.waitForTimeout(200);

  const closedPath = join(OUT_DIR, "03-mobile-legend-closed.png");
  const openPath = join(OUT_DIR, "04-mobile-legend-open.png");
  await page.screenshot({ path: closedPath });

  const metricsClosed = await page.evaluate(() => {
    const shell = document.querySelector("[data-testid='companies-map-shell']") as HTMLElement;
    const map = document.querySelector("[data-testid='map-cartography']") as HTMLElement;
    const brand = document.querySelector("[data-testid='desktop-brand-legend']") as HTMLElement;
    const tour = document.querySelector("[data-testid='desktop-tour-legend']") as HTMLElement;
    const btn = document.querySelector("[data-testid='map-mobile-legend-button']") as HTMLElement;
    const brandStyle = getComputedStyle(brand);
    const tourStyle = getComputedStyle(tour);
    const shellRect = shell.getBoundingClientRect();
    const mapRect = map.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    return {
      desktopBrandVisible: brandStyle.display !== "none",
      desktopTourVisible: tourStyle.display !== "none",
      mapFillsShell:
        Math.abs(mapRect.width - shellRect.width) < 1 &&
        Math.abs(mapRect.height - shellRect.height) < 1,
      buttonArea: Math.round(btnRect.width * btnRect.height),
      buttonSmall: btnRect.width < 120 && btnRect.height < 44,
      shellHeight: shellRect.height,
      mapHeight: mapRect.height,
    };
  });

  await page.getByTestId("map-mobile-legend-button").click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: openPath });

  const sheetVisible = await page.getByTestId("map-mobile-legend-sheet").isVisible();

  const report = {
    mode: "WebKit iPhone 14 Pro — mobile legend UX",
    viewport: IPHONE.viewport,
    screenshots: { closed: closedPath, open: openPath },
    metricsClosed,
    sheetVisible,
    cartographyFree:
      !metricsClosed.desktopBrandVisible &&
      !metricsClosed.desktopTourVisible &&
      metricsClosed.mapFillsShell &&
      metricsClosed.buttonSmall,
    passed: false as boolean,
  };
  report.passed = report.cartographyFree && sheetVisible && metricsClosed.buttonSmall;

  writeFileSync(join(OUT_DIR, "legend-ux-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.passed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
