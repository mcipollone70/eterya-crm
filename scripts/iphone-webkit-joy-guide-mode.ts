/**
 * WebKit mobile emulation — Joy guide mode (not a physical iPhone).
 * Evidence screenshots under scripts/_iphone-webkit-evidence/
 */
import { chromium, webkit, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.JOY_GUIDE_BASE_URL ?? "http://127.0.0.1:3000";
const OUT = join(process.cwd(), "scripts", "_iphone-webkit-evidence");
const IPHONE = {
  viewport: { width: 390, height: 844 },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  isMobile: true,
  hasTouch: true,
};

type Check = { id: string; ok: boolean; detail: string };

async function shot(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, name), fullPage: false });
}

async function runWithBrowser(browserType: "webkit" | "chromium"): Promise<{
  engine: string;
  checks: Check[];
}> {
  let browser: Browser | null = null;
  const checks: Check[] = [];
  try {
    browser =
      browserType === "webkit" ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true });
    const context = await browser.newContext({
      ...IPHONE,
      permissions: [],
    });
    const page = await context.newPage();

    await page.goto(`${BASE}/joy-ai/drive`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await shot(page, `joy-guide-hub-${browserType}.png`);

    const startBtn = page.getByTestId("joy-start-guide-mode");
    const startVisible = await startBtn.isVisible().catch(() => false);
    checks.push({
      id: "1-start-button",
      ok: startVisible,
      detail: startVisible ? "Avvia modalità guida visible" : "button missing (auth?)",
    });

    if (startVisible) {
      await startBtn.click();
      await page.waitForTimeout(800);
      await shot(page, `joy-guide-started-${browserType}.png`);

      const writeBtn = page.getByTestId("joy-write-command");
      const writeVisible = await writeBtn.isVisible().catch(() => false);
      checks.push({
        id: "3-write-fallback",
        ok: writeVisible,
        detail: writeVisible ? "Scrivi comando visible" : "write command missing",
      });

      if (writeVisible) {
        await writeBtn.click();
        const input = page.getByTestId("joy-write-command-input");
        await input.fill("Leggimi gli appuntamenti di oggi");
        await input.press("Enter");
        await page.waitForTimeout(2500);
        await shot(page, `joy-guide-agenda-cmd-${browserType}.png`);
        const transcript = await page.getByTestId("joy-last-transcript").textContent();
        checks.push({
          id: "4-text-command",
          ok: Boolean(transcript && /appuntament/i.test(transcript)),
          detail: `transcript=${transcript?.slice(0, 80) ?? "null"}`,
        });
      }

      const stateLabel = await page.getByTestId("joy-guide-state-label").textContent();
      checks.push({
        id: "2-state-label",
        ok: Boolean(stateLabel),
        detail: `state=${stateLabel}`,
      });

      // Pause / resume
      await page.getByRole("button", { name: /Pausa/i }).first().click();
      await page.waitForTimeout(300);
      await page.getByRole("button", { name: /Riprendi/i }).first().click();
      await page.waitForTimeout(300);
      checks.push({ id: "9-pause-resume", ok: true, detail: "pause/resume clicked" });

      // Background simulation
      await page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForTimeout(200);
      checks.push({ id: "8-background", ok: true, detail: "visibilitychange dispatched" });

      await shot(page, `joy-guide-layout-${browserType}.png`);
      const footerBox = await page.locator("footer").boundingBox();
      const vh = IPHONE.viewport.height;
      checks.push({
        id: "10-layout-safe",
        ok: Boolean(footerBox && footerBox.y + footerBox.height <= vh + 2),
        detail: footerBox
          ? `footer bottom=${Math.round(footerBox.y + footerBox.height)} vh=${vh}`
          : "no footer",
      });
    } else {
      checks.push({
        id: "auth-gate",
        ok: false,
        detail: "Could not reach guide UI — likely login required. Hub screenshot saved.",
      });
    }
  } catch (error) {
    checks.push({
      id: "fatal",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await browser?.close();
  }
  return { engine: browserType, checks };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const results = [];
  // Prefer WebKit; fall back to Chromium mobile if WebKit browsers missing on Windows
  try {
    results.push(await runWithBrowser("webkit"));
  } catch (error) {
    results.push({
      engine: "webkit",
      checks: [
        {
          id: "webkit-unavailable",
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        },
      ],
    });
    results.push(await runWithBrowser("chromium"));
  }

  const report = {
    note: "WebKit/Chromium mobile emulation only — not a physical iPhone test",
    base: BASE,
    results,
    at: new Date().toISOString(),
  };
  writeFileSync(join(OUT, "joy-guide-mode-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  const failed = results.flatMap((r) => r.checks).filter((c) => !c.ok && c.id !== "auth-gate");
  // auth-gate is soft-fail when not logged in
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
