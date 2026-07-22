// Phase 4 — runtime smoke test. Boots a freshly-built game in headless Chromium,
// feeds it synthetic input, and reports whether it ran clean and drew anything.
// This is the game-builder's key differentiator over the app builder: a compile
// pass proves nothing for a game, so we actually RUN it and catch frame-1 crashes,
// input-handler throws, and blank canvases before publishing.
//
// Returns: { passed, errors:[string], blank:bool, ms:number }
//   passed = no uncaught errors AND the canvas rendered something.
// The Worker feeds `errors` back to Sonnet for a fix pass when passed === false.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" };
const BOOT_MS = 1500;      // let the engine mount + first scene start
const PLAY_MS = 2500;      // exercise the update loop under input
const BLANK_BYTES = 3000;  // a uniform/blank 960×540 canvas PNG is tiny; a scene is much larger

function serveDir(dir) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    // The browser auto-requests /favicon.ico; answer it so it isn't a spurious 404.
    if (p === "/favicon.ico") { res.writeHead(204); res.end(); return; }
    const fp = path.join(dir, p);
    fs.readFile(fp, (e, d) => {
      if (e) { res.writeHead(404); res.end("nf"); return; }
      res.writeHead(200, { "content-type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" });
      res.end(d);
    });
  });
  return server;
}

async function loadChromium() {
  const { chromium } = await import("playwright-core");
  return chromium;
}

export async function smokeTest(distDir) {
  const t0 = Date.now();
  const errors = [];
  const server = serveDir(distDir);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const chromium = await loadChromium();
  // Force the WebGL path: `--disable-features=WebGPU` removes navigator.gpu so a 3D
  // game's `WebGPUEngine.IsSupportedAsync` returns false and it takes its mandated
  // WebGL fallback. This is deliberate — WebGPU under headless swiftshader is
  // unreliable (half-inits to a blank canvas or crashes) and its init pulls the
  // twgsl/glslang compilers off cdn.babylonjs.com, which fails in this offline
  // container. WebGL is what nearly every real browser uses today and is the only
  // path we can test headline-clean, so the smoke test verifies THAT path renders.
  const launchOpts = { args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-features=WebGPU"] };
  if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launchOpts);
  let blank = true;
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    page.on("pageerror", (e) => errors.push("Uncaught: " + (e && e.message || String(e)).split("\n")[0]));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      // "Failed to load resource" is the browser's echo of a network 404 — the
      // requestfailed handler reports those with the real filename instead, so
      // skip the generic console dupe (and never flag the auto favicon fetch).
      if (/Failed to load resource/i.test(t)) return;
      // Babylon lazy-loads WebGPU/texture helpers from cdn.babylonjs.com; those 404
      // in this offline container and Babylon logs an error before degrading (the
      // game falls back to WebGL and runs fine, and they load for real users). Don't
      // count a graceful cross-origin-helper failure as the game being broken.
      if (/babylonjs\.com|twgsl|glslang|ktx2|WebGPU|Unable to load the WebGPU/i.test(t)) return;
      errors.push("console.error: " + t.slice(0, 200));
    });
    // Only flag the GAME'S OWN (same-origin) asset failures — a missing sprite/model
    // the build should have bundled is a real bug. A failed CROSS-ORIGIN fetch is not:
    // Babylon lazy-loads helpers from cdn.babylonjs.com (the WebGPU twgsl/glslang
    // compilers, the KTX2 decoder, noise textures) and those 404 in this offline build
    // container even though the game degrades gracefully (WebGPU→WebGL) and they load
    // fine for real users. Flagging them here made every 3D game fail the smoke test
    // and waste the whole auto-fix budget on an infra hiccup Sonnet can't fix.
    page.on("requestfailed", (r) => { const u = r.url(); if (u.startsWith(`http://localhost:${port}/`) && !/favicon\.ico$/.test(u)) errors.push("asset failed: " + u.split("/").pop()); });

    // Hide navigator.gpu so a 3D game's WebGPU feature-detect (`WebGPUEngine.
    // IsSupportedAsync`) returns false and it deterministically takes its mandated
    // WebGL fallback — belt-and-braces with the --disable-features=WebGPU launch flag,
    // since some Chromium builds still expose navigator.gpu. Headless swiftshader
    // WebGPU is unreliable and its init fetches compilers off cdn.babylonjs.com; the
    // WebGL path is what real browsers use today and the only one we can test clean.
    await page.addInitScript(() => { try { Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true }); } catch {} });

    await page.goto(`http://localhost:${port}/`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(BOOT_MS);

    // Exercise the update/input path — a game that throws on input dies here.
    for (const key of ["ArrowRight", "Space", "ArrowLeft", "ArrowUp", "Space"]) {
      await page.keyboard.down(key); await page.waitForTimeout(120);
      await page.keyboard.up(key); await page.waitForTimeout(80);
    }
    // WASD (3D / first-person movement) + POINTER actions. Clicking matters: a
    // shooter that ray-picks on click (e.g. a 3D FPS) throws only when you fire,
    // so a keys-only test would pass a game that breaks the instant the player
    // shoots. Exercise the click/tap path so the auto-fix loop catches it.
    for (const key of ["KeyW", "KeyD", "KeyA", "KeyS"]) { await page.keyboard.down(key); await page.waitForTimeout(90); await page.keyboard.up(key); }
    try {
      const cv = await page.$("canvas");
      if (cv) await cv.click({ position: { x: 480, y: 270 }, force: true }).catch(() => {});
      for (let i = 0; i < 4; i++) { await page.mouse.move(360 + i * 60, 250 + (i % 2) * 40); await page.mouse.click(360 + i * 60, 250).catch(() => {}); await page.waitForTimeout(90); }
    } catch {}
    await page.waitForTimeout(PLAY_MS - 1000);

    // Still-stuck-on-"Loading…" check. A 3D game that gates its render loop behind a
    // top-level `await` on a model load DEADLOCKS (the GLB's GPU upload needs render
    // frames, which the await blocks) and sits forever on its loading overlay. The
    // non-blank check below can't catch it — the DOM overlay covers the canvas, so the
    // canvas-region screenshot is "non-blank" from the overlay text alone. Detect a
    // still-visible, screen-covering element whose text is a loading indicator and
    // fail with a clear message so the fix loop moves the render loop ahead of the load.
    try {
      const stuck = await page.evaluate(() => {
        // A healthy game hides its loading indicator within the boot+play window; if a
        // short loading string is STILL visible here the startup load never finished.
        // Anchored regex so transient HUD text ("Loading next wave") doesn't match.
        for (const el of document.querySelectorAll("body *")) {
          const txt = (el.textContent || "").trim();
          if (!/^(loading|loading\s*\.{1,3}|loading\s*…|please wait|loading arena\s*\.{0,3})$/i.test(txt)) continue;
          const s = getComputedStyle(el), r = el.getBoundingClientRect();
          if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) continue;
          if (r.width > 0 && r.height > 0) return txt.slice(0, 40);
        }
        return null;
      });
      if (stuck) errors.push('stuck on loading overlay ("' + stuck + '") — the render loop is blocked behind an awaited asset load; start engine.runRenderLoop BEFORE awaiting the model (load it in an async IIFE) and always hide the overlay after the load');
    } catch {}

    // Non-blank check: screenshot the canvas; a rendered scene yields a far larger
    // PNG than a flat fill. (Robust for WebGL, where pixel readback is unreliable.)
    try {
      const el = await page.$("canvas");
      const shot = el ? await el.screenshot({ type: "png" }) : await page.screenshot({ type: "png" });
      blank = shot.length < BLANK_BYTES;
    } catch (e) { errors.push("screenshot failed: " + String(e && e.message || e)); }
  } catch (e) {
    errors.push("boot failed: " + String(e && e.message || e).split("\n")[0]);
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }

  const uniqErrors = [...new Set(errors)].slice(0, 12);
  return { passed: uniqErrors.length === 0 && !blank, errors: uniqErrors, blank, ms: Date.now() - t0 };
}
