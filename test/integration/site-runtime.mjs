// Does a generated site actually WORK for a visitor?
//
// Everything else stops short of this. The unit tests check the generator's
// output without running it; site-build.mjs checks it compiles and bundles; the
// production smoke test checks the published bundle CONTAINS a table name. None
// of that proves a visitor loads the page and sees data, or that a form submits.
// That gap is exactly the failure GENERATOR.md exists to prevent — a page that
// typechecks, bundles, screenshots fine, and does nothing.
//
// So this builds the REFERENCE PAGE (the file the generator is told to imitate,
// and the one page-gen.mjs embeds), serves it behind a stub of the real data API,
// and drives it in a browser.
//
// The stub answers the way the live API does — including its 409 shapes — so the
// four list states and the form's success and failure paths are all reachable
// without spending anything. $0: no model call, no container, no Neon project.
//
//   cd builder/lovable/template && npm ci
//   node test/integration/site-runtime.mjs
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATE = path.join(ROOT, "builder", "lovable", "template");

// playwright is one of the template's devDependencies, where the browser-driving
// belongs — resolve it from there rather than adding it to the Worker's root
// package.json, which wrangler bundles.
const { chromium } = createRequire(path.join(TEMPLATE, "package.json"))("playwright");

// Use whatever Chromium is already on the machine. The pinned playwright version
// and the pre-installed browser build often disagree, and downloading a matching
// one is both slow and blocked in some environments — the build number is not
// what this test is about. Falls back to playwright's own resolution when the
// directory layout is not the one we expect.
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const rels = ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/headless_shell"];
  const found = [];
  try {
    for (const dir of fs.readdirSync(root)) {
      for (const rel of rels) {
        const p = path.join(root, dir, rel);
        if (fs.existsSync(p)) found.push(p);
      }
    }
  } catch { /* fall through to playwright's own lookup */ }
  // Prefer full Chromium over the headless shell — the shell is more limited.
  found.sort((a, b) => Number(/headless/.test(a)) - Number(/headless/.test(b)));
  return found[0] || null;
}
const chromiumPath = findChromium();
const BUILD_PORT = 8124, SITE_PORT = 8125, SLUG = "barber-shop-runtime";

let passed = 0, failed = 0;
const ok = (name, cond, extra) => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? "\n       -> " + String(extra).slice(0, 600) : ""}`); }
};

if (!fs.existsSync(path.join(TEMPLATE, "node_modules"))) {
  console.error("the template's dependencies are not installed — run `npm ci` in " + TEMPLATE);
  process.exit(1);
}

// The reference page, read from disk rather than copied — this test is only
// meaningful if it runs the real thing.
const REFERENCE = fs.readFileSync(path.join(TEMPLATE, "src/routes/index.tsx"), "utf8");

const SERVICES = [
  { id: 1, name: "Skin fade", description: "Clippers, blended to the skin.", price: 28, duration_minutes: 45, created_at: "2026-07-28 10:00:00" },
  { id: 2, name: "Beard trim", description: null, price: 15, duration_minutes: 20, created_at: "2026-07-28 10:00:00" },
];

// What the stub does next — flipped between assertions to reach each state.
let mode = "ok";
const posted = [];

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "isibi-site-runtime-"));
let buildSrv = null, siteSrv = null, browser = null;

const send = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(obj));
};

try {
  // ── build the reference page into a real dist ──────────────────────────────
  fs.cpSync(TEMPLATE, sandbox, { recursive: true, filter: (src) => !/(^|[\\/])(node_modules|dist)$/.test(src) });
  fs.symlinkSync(path.join(TEMPLATE, "node_modules"), path.join(sandbox, "node_modules"), "dir");
  fs.mkdirSync(path.join(sandbox, ".routes-base"), { recursive: true });
  fs.copyFileSync(path.join(sandbox, "src/routes/__root.tsx"), path.join(sandbox, ".routes-base/__root.tsx"));
  fs.copyFileSync(path.join(sandbox, "index.html"), path.join(sandbox, ".index-base.html"));
  fs.rmSync(path.join(sandbox, "src/routes/index.tsx"), { force: true });

  buildSrv = spawn("node", [path.join(ROOT, "builder", "build-server.mjs")], {
    env: { ...process.env, APP_DIR: sandbox, PORT: String(BUILD_PORT), NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  buildSrv.stderr.on("data", (d) => process.stderr.write("  [build] " + d));

  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    try { up = (await fetch(`http://127.0.0.1:${BUILD_PORT}/health`)).ok; }
    catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!up) throw new Error("build service never came up");

  console.log("building the reference page…");
  const built = await (await fetch(`http://127.0.0.1:${BUILD_PORT}/build`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ files: { "index.tsx": REFERENCE }, slug: SLUG, title: "Barber Shop" }),
  })).json();
  ok("the reference page builds", built.ok === true, built.stage + ": " + built.error);
  if (!built.ok) throw new Error("cannot drive a site that did not build");

  // ── serve it exactly as production does: /s/<slug>/ + the data API ─────────
  siteSrv = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const m = url.pathname.match(/^\/api\/db\/([^/]+)\/rows\/([^/]+)$/);
    if (m) {
      const table = m[2];
      if (req.method === "GET") {
        // `collect` is write-only in the real API; if the page ever lists it the
        // visitor gets nothing, so mirror that rather than being generous.
        if (table === "appointments") return send(res, 403, { error: "that table is not readable", access: "collect" });
        if (table !== "services") return send(res, 404, { error: "no such table" });
        if (mode === "error") return send(res, 500, { error: "that didn't work" });
        return send(res, 200, { rows: mode === "empty" ? [] : SERVICES, limit: 50, offset: 0 });
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          let parsed = null; try { parsed = JSON.parse(body); } catch {}
          posted.push({ table, body: parsed });
          if (mode === "overlap") {
            // The real API's 409 for a double booking. The page is supposed to
            // show THIS message, not a generic failure.
            return send(res, 409, { error: "That time is already taken", code: "overlap" });
          }
          return send(res, 201, { row: { id: 99, ...parsed } });
        });
        return;
      }
      return send(res, 405, { error: "method not allowed" });
    }
    // Static dist under /s/<slug>/…
    const sm = url.pathname.match(/^\/s\/[^/]+\/?(.*)$/);
    if (!sm) { res.writeHead(404); return res.end("nf"); }
    const rel = sm[1] || "index.html";
    const file = built.files[rel] || built.files["index.html"];
    if (!file) { res.writeHead(404); return res.end("nf"); }
    const ext = (rel.match(/\.([a-z0-9]+)$/i) || [])[1] || "html";
    const type = { js: "text/javascript", css: "text/css", svg: "image/svg+xml", html: "text/html; charset=utf-8" }[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(file.t != null ? file.t : Buffer.from(file.b, "base64"));
  });
  await new Promise((r) => siteSrv.listen(SITE_PORT, r));

  browser = await chromium.launch(chromiumPath ? { executablePath: chromiumPath } : {});
  const base = `http://127.0.0.1:${SITE_PORT}/s/${SLUG}/`;
  const newPage = async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    return { page, errors };
  };

  // ── 1. loaded state: the rows actually render ─────────────────────────────
  console.log("\ndriving the page…");
  {
    mode = "ok";
    const { page, errors } = await newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    ok("the app mounts without a runtime error", errors.length === 0, errors.join("\n"));
    ok("rows from the API render", body.includes("Skin fade") && body.includes("Beard trim"), body.slice(0, 400));
    ok("a column value renders, not just the name", body.includes("28") && body.includes("45 min"), body.slice(0, 400));
    ok("a null column is skipped rather than printed", !/\bnull\b/i.test(body), body.slice(0, 400));
    await page.context().close();
  }

  // ── 2. empty state ────────────────────────────────────────────────────────
  {
    mode = "empty";
    const { page } = await newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    ok("an empty table says so instead of rendering an empty grid", body.includes("Nothing listed yet"), body.slice(0, 400));
    await page.context().close();
  }

  // ── 3. error state ────────────────────────────────────────────────────────
  {
    mode = "error";
    const { page } = await newPage();
    const t0 = Date.now();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    // NOT immediate: TanStack Query retries a failed read three times with
    // backoff before it settles into isError, so the message a visitor can act
    // on only appears after those retries. Waiting for it is the correct
    // assertion; how LONG it takes is reported below, because a visitor sitting
    // in front of empty skeletons is the part worth knowing about.
    let shown = true;
    try { await page.getByText(/Couldn't load the services/i).waitFor({ timeout: 20000 }); }
    catch { shown = false; }
    const ms = Date.now() - t0;
    ok("a failed read eventually shows a sentence a visitor can act on", shown,
      "never appeared within 20s: " + (await page.locator("body").innerText()).slice(0, 300));
    console.log(`       (took ${(ms / 1000).toFixed(1)}s — the query retries before it gives up)`);
    await page.context().close();
  }

  // ── 4. the form actually submits to the collect table ─────────────────────
  {
    mode = "ok";
    posted.length = 0;
    const { page, errors } = await newPage();
    await page.goto(base, { waitUntil: "networkidle" });

    // shadcn's Select is a Radix portal, not a <select> — open it and pick.
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Skin fade" }).click();
    await page.getByLabel("Your name").fill("Ada Lovelace");
    await page.getByLabel("Phone").fill("07700900123");
    await page.locator('input[type="date"]').fill("2026-08-03");
    await page.locator('input[type="time"]').fill("10:30");
    await page.getByRole("button", { name: /Request appointment/i }).click();
    await page.waitForTimeout(1200);

    ok("the form POSTs to the collect table", posted.length === 1 && posted[0].table === "appointments", JSON.stringify(posted));
    const sent = (posted[0] && posted[0].body) || {};
    ok("it sends the declared columns, with the visitor's values",
      sent.service === "Skin fade" && sent.customer_name === "Ada Lovelace" &&
      sent.customer_phone === "07700900123" && sent.date === "2026-08-03" && sent.time === "10:30",
      JSON.stringify(sent));
    ok("it does not send a managed column",
      !("id" in sent) && !("created_at" in sent) && !("owner_id" in sent), JSON.stringify(sent));

    const afterBody = await page.locator("body").innerText();
    ok("success is reported to the visitor (the Toaster is actually mounted)",
      /we'll call to confirm/i.test(afterBody), afterBody.slice(-400));
    ok("the form resets after a successful submit",
      (await page.getByLabel("Your name").inputValue()) === "", "name field still filled");
    ok("no runtime error during submit", errors.length === 0, errors.join("\n"));
    await page.context().close();
  }

  // ── 5. the API's own error message reaches the visitor ────────────────────
  {
    mode = "overlap";
    posted.length = 0;
    const { page } = await newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Beard trim" }).click();
    await page.getByLabel("Your name").fill("Grace Hopper");
    await page.getByLabel("Phone").fill("07700900456");
    await page.locator('input[type="date"]').fill("2026-08-03");
    await page.locator('input[type="time"]').fill("10:30");
    await page.getByRole("button", { name: /Request appointment/i }).click();
    await page.waitForTimeout(1200);

    const body = await page.locator("body").innerText();
    // The whole point of onError: (e) => toast.error(e.message) — "That time is
    // already taken" is useful, "something went wrong" is not.
    ok("a 409 surfaces the API's own message, not a generic failure",
      /That time is already taken/i.test(body), body.slice(-400));
    ok("the form keeps the visitor's input after a failure",
      (await page.getByLabel("Your name").inputValue()) === "Grace Hopper", "input was cleared on failure");
    await page.context().close();
  }

  // ── 6. validation happens before a round trip ─────────────────────────────
  {
    mode = "ok";
    posted.length = 0;
    const { page } = await newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Request appointment/i }).click();
    await page.waitForTimeout(800);
    const body = await page.locator("body").innerText();
    ok("an empty form is rejected client-side, with no request sent", posted.length === 0, JSON.stringify(posted));
    ok("the visitor is told which field is wrong", /Pick a service|Tell us your name/i.test(body), body.slice(0, 600));
    await page.context().close();
  }
} catch (e) {
  failed++;
  console.log("\nUNCAUGHT: " + ((e && (e.stack || e.message)) || e));
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  if (siteSrv) { try { siteSrv.close(); } catch {} }
  if (buildSrv) { try { buildSrv.kill("SIGKILL"); } catch {} }
  try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch {}
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
