/**
 * WebKit (iPhone viewport) — verifica unlock TTS Joy senza race pause→TTS.
 * Non è un iPhone fisico: dichiara solo esito WebKit.
 *
 *   npx tsx scripts/iphone-webkit-joy-tts-audio.ts
 */
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { webkit, devices } from "playwright";

const OUT_DIR = join(process.cwd(), "scripts", "_iphone-webkit-evidence");
const IPHONE = devices["iPhone 14 Pro"];

mkdirSync(OUT_DIR, { recursive: true });

/** Mini MP3 frame (silence) — decodificabile da WebKit. */
const TINY_MP3 = Buffer.from(
  "//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAAA5TEFNRTMuMTAwAc0AAAAAAAAAABSAJAJAQgAAgAAAAnGYxHpHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAExBTUUzLjEwMA=======",
  "base64"
);

const PAGE_HTML = `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Joy TTS WebKit</title>
</head>
<body>
  <button id="ascolta" type="button">Ascolta</button>
  <button id="ascolta2" type="button">Ascolta di nuovo</button>
  <pre id="log"></pre>
  <script>
    const SILENT_WAV =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    const logEl = document.getElementById("log");
    const report = {
      taps: [],
      ttsRequests: 0,
      userAgent: navigator.userAgent,
      standalone: !!(navigator.standalone || matchMedia("(display-mode: standalone)").matches),
    };
    function log(line, extra) {
      const row = { t: Date.now(), line, ...(extra || {}) };
      report.taps.push(row);
      logEl.textContent = JSON.stringify(report, null, 2);
      console.log("[joy-webkit]", line, extra || {});
    }
    window.__joyReport = report;

    let audio = null;
    let objectUrl = null;
    let unlockSrcPending = false;
    let unlockGeneration = 0;

    function ensureAudio() {
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        audio.setAttribute("playsinline", "true");
        audio.setAttribute("webkit-playsinline", "true");
        audio.playsInline = true;
        audio.style.display = "none";
        document.body.appendChild(audio);
      }
      audio.muted = false;
      audio.volume = 1;
      return audio;
    }

    function unlock() {
      const el = ensureAudio();
      el.muted = false;
      el.volume = 1;
      const unlockId = ++unlockGeneration;
      unlockSrcPending = true;
      el.src = SILENT_WAV;
      return el.play().then(function () {
        if (unlockId !== unlockGeneration || !unlockSrcPending) return;
        el.pause();
        el.currentTime = 0;
        log("unlock ok", { volume: el.volume, muted: el.muted });
      }).catch(function (err) {
        // Su WebKit headless il WAV data-URI può fallire: continuiamo comunque (elemento già creato nel tap).
        log("unlock soft-fail", { error: String(err && err.message || err) });
      });
    }

    async function playTts(label) {
      await unlock();
      const res = await fetch("/api/joy-ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Ciao, sono Joy." }),
        cache: "no-store",
      });
      report.ttsRequests += 1;
      const contentType = res.headers.get("Content-Type");
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      // Claim: niente pause da unlock.then sul src TTS
      unlockSrcPending = false;
      unlockGeneration += 1;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const url = URL.createObjectURL(blob);
      objectUrl = url;
      const el = ensureAudio();
      try { el.pause(); } catch (_) {}
      el.muted = false;
      el.volume = 1;
      el.src = url;
      el.load();
      await new Promise(function (resolve) {
        var done = false;
        function finish() {
          if (done) return;
          done = true;
          el.removeEventListener("canplay", finish);
          resolve();
        }
        el.addEventListener("canplay", finish);
        setTimeout(finish, 1000);
      });
      try {
        el.currentTime = 0;
        await el.play();
        log(label + " play ok", {
          status: res.status,
          contentType: contentType,
          blobSize: blob.size,
          volume: el.volume,
          muted: el.muted,
          readyState: el.readyState,
          playError: null,
        });
      } catch (err) {
        var playError = (err && err.name ? err.name + ": " : "") + String(err && err.message || err);
        log(label + " play fail", {
          status: res.status,
          contentType: contentType,
          blobSize: blob.size,
          volume: el.volume,
          muted: el.muted,
          readyState: el.readyState,
          playError: playError,
        });
      }
      try { el.pause(); } catch (_) {}
    }

    document.getElementById("ascolta").addEventListener("click", function () {
      void playTts("first");
    });
    document.getElementById("ascolta2").addEventListener("click", function () {
      void playTts("second");
    });
  </script>
</body></html>`;

const SW_JS = `
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Mirror production: never respondWith for POST or /api/*
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }
});
`;

async function run() {
  const swSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
  const swChecks = {
    cacheVersionV4: swSource.includes("eterya-crm-static-v4"),
    apiNeverCache: swSource.includes('pathname.startsWith("/api/")'),
    nonGetNeverCache: swSource.includes('request.method !== "GET"'),
    audioAcceptNeverCache: swSource.includes('accept.includes("audio/")'),
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === "/api/joy-ai/tts" && req.method === "POST") {
      res.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Joy-TTS-Provider": "openai",
        "X-Joy-TTS-Model": "gpt-4o-mini-tts",
        "X-Joy-TTS-Voice": "marin",
        "X-Joy-TTS-Bytes": String(TINY_MP3.length),
      });
      res.end(TINY_MP3);
      return;
    }
    if (url.pathname === "/sw.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(SW_JS);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE_HTML);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("server address unavailable");
  }
  const base = `http://127.0.0.1:${addr.port}`;

  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...IPHONE,
    locale: "it-IT",
    serviceWorkers: "allow",
  });
  const page = await context.newPage();

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return;
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  });

  await page.click("#ascolta");
  await page
    .waitForFunction(
      `window.__joyReport && window.__joyReport.taps.some(t => String(t.line).startsWith("first play"))`,
      { timeout: 15000 }
    )
    .catch(() => null);

  await page.click("#ascolta2");
  await page
    .waitForFunction(
      `window.__joyReport && window.__joyReport.taps.some(t => String(t.line).startsWith("second play"))`,
      { timeout: 15000 }
    )
    .catch(() => null);

  const report = (await page.evaluate("window.__joyReport")) as {
    taps: Array<Record<string, unknown>>;
    ttsRequests: number;
    userAgent: string;
    standalone: boolean;
  };

  const first = report.taps.find((t) => String(t.line).startsWith("first play"));
  const second = report.taps.find((t) => String(t.line).startsWith("second play"));

  const firstOkOrCodecOnly =
    String(first?.line || "").includes("play ok") ||
    (String(first?.playError || "").includes("NotSupportedError") &&
      !String(first?.playError || "").includes("NotAllowedError"));
  const secondOkOrCodecOnly =
    String(second?.line || "").includes("play ok") ||
    (String(second?.playError || "").includes("NotSupportedError") &&
      !String(second?.playError || "").includes("NotAllowedError"));

  const evidence = {
    environment: "Playwright WebKit iPhone 14 Pro viewport — NOT a physical iPhone",
    swSourceChecks: swChecks,
    runtime: report,
    gates: {
      ttsStatus200: first?.status === 200,
      contentTypeMpeg:
        typeof first?.contentType === "string" &&
        String(first.contentType).includes("audio/mpeg"),
      blobNonEmpty: typeof first?.blobSize === "number" && (first.blobSize as number) > 0,
      mutedFalse: first?.muted === false,
      volumeOne: first?.volume === 1,
      /** Headless WebKit may NotSupportedError on synthetic MP3; NotAllowedError must not appear. */
      playNoNotAllowedError: !String(first?.playError || "").includes("NotAllowedError"),
      secondPlayNoNotAllowed: !String(second?.playError || "").includes("NotAllowedError"),
      playAttemptCompleted: firstOkOrCodecOnly,
      secondPlayAttemptCompleted: secondOkOrCodecOnly,
      swExcludesApi: swChecks.apiNeverCache && swChecks.nonGetNeverCache && swChecks.cacheVersionV4,
      ttsRequestCount: report.ttsRequests >= 2,
    },
    note: "Deploy + real iPhone PWA still required for audible verification. Headless WebKit may reject synthetic MP3 codec (NotSupportedError) while still validating TTS MIME/blob/unlock path.",
  };

  const outPath = join(OUT_DIR, "joy-tts-audio-report.json");
  writeFileSync(outPath, JSON.stringify(evidence, null, 2), "utf8");

  await browser.close();
  server.close();

  const failed = Object.entries(evidence.gates).filter(([, ok]) => !ok);
  console.log(JSON.stringify(evidence, null, 2));
  if (failed.length) {
    console.error("WebKit Joy TTS gates failed:", failed.map(([k]) => k).join(", "));
    process.exitCode = 1;
  } else {
    console.log("WebKit Joy TTS gates OK (physical iPhone still required after deploy).");
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
