// Headless render for the vision critique — BUILD-CONTAINER only (Node + Playwright). Kept separate from
// vision-critique.mjs so that the critique functions (prompt/parse/request/loop) stay import-safe for the
// Cloudflare Worker, which has no node:module / Playwright. The container imports THIS to screenshot a build.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);

// Locate the pre-installed Chromium (build image sets PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers).
export function chromiumExecutable() {
  const cands = [
    process.env.CHROMIUM_PATH,
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
  ].filter(Boolean);
  return cands.find((p) => existsSync(p)) || undefined; // undefined → let Playwright resolve
}

// renderRoutes(target, routes, opts) — screenshot each route. `target` is one of:
//   { html }  a raw HTML string (fixtures / a single self-contained page)
//   { url }   a served build (HashRouter: each route is loaded as <url>/#<route>)
// Returns [{ route, pngBase64, width, height }]. Lazy-loads Playwright so the module import stays cheap.
export async function renderRoutes(target, routes = ["/"], opts = {}) {
  const { chromium } = require("playwright-core");
  const width = opts.width || 1280, height = opts.height || 900;
  const browser = await chromium.launch({ executablePath: chromiumExecutable(), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const shots = [];
    for (const route of routes) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      try {
        if (target.html != null) await page.setContent(String(target.html), { waitUntil: "networkidle" });
        else if (target.url) await page.goto(target.url.replace(/\/$/, "") + "/#" + route, { waitUntil: "networkidle", timeout: opts.timeout || 15000 });
        else throw new Error("target needs { html } or { url }");
        await page.waitForTimeout(opts.settleMs || 250);
        const buf = await page.screenshot({ type: "png", fullPage: !!opts.fullPage });
        shots.push({ route, pngBase64: buf.toString("base64"), width, height });
      } finally { await page.close(); }
    }
    return shots;
  } finally { await browser.close(); }
}
