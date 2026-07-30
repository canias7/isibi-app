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
// Counts reads of `services`, so a retry policy can be asserted on directly
// rather than inferred from how long something took.
let reads = 0;

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "isibi-site-runtime-"));
let buildSrv = null, siteSrv = null, browser = null;

const send = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(obj));
};

// PostgREST reports a refusal as the Postgres error itself: the SQLSTATE in
// `code`, the server's own sentence in `message`. It is NOT the platform's old
// `{error}` shape, and the difference is the whole point of stubbing it — a
// visitor-facing message now has to be derived from a SQLSTATE rather than read
// out of a field we wrote.
const pgError = (res, code, sqlstate, message, details) =>
  send(res, code, { code: sqlstate, details: details ?? null, hint: null, message });

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
  //
  // The data API is Neon's, which is PostgREST, and the Worker only forwards to
  // it — so this stub answers the way PostgREST does, not the way the platform's
  // own deleted `/rows/` routes did. Three differences all matter to the page:
  // the path is `/data/<table>`, a list is the ARRAY ITSELF rather than
  // `{rows:[…]}`, and a refusal carries a Postgres SQLSTATE instead of a sentence
  // we chose. Stubbing the old shape is how this test went green while the real
  // page fetched a URL nothing served.
  siteSrv = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const m = url.pathname.match(/^\/api\/db\/([^/]+)\/data\/([^/]+)$/);
    if (m) {
      const table = m[2];
      if (req.method === "GET") {
        // A `collect` table is granted INSERT and nothing else, so a read is
        // refused by the GRANT before any policy is consulted: Postgres raises
        // 42501, which PostgREST answers as 403. Mirrored rather than softened —
        // a page that lists a collect table must break here, not in production.
        if (table === "appointments") return pgError(res, 403, "42501", `permission denied for table ${table}`);
        if (table !== "services") return pgError(res, 404, "42P01", `relation "public.${table}" does not exist`);
        reads++;
        if (mode === "error") return send(res, 500, { code: "XX000", message: "server error" });
        if (mode === "denied") return pgError(res, 403, "42501", `permission denied for table ${table}`);
        // PostgREST answers a list with the bare array.
        return send(res, 200, mode === "empty" ? [] : SERVICES);
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          let parsed = null; try { parsed = JSON.parse(body); } catch {}
          posted.push({ table, body: parsed });
          if (mode === "overlap") {
            // A double booking is now refused by the DATABASE — `noOverlap` is an
            // `EXCLUDE USING gist` constraint, so the failure is SQLSTATE 23P01 and
            // the message is Postgres's own. Nobody writes "That time is already
            // taken" any more; if the visitor is to see a sentence, something has
            // to translate this.
            return pgError(res, 409, "23P01",
              `conflicting key value violates exclusion constraint "ex_${table}_nooverlap"`,
              "Key (date, tstzrange(...))=(2026-08-03, [...)) conflicts with existing key.");
          }
          // `Prefer: return=representation` is what makes the row come back, and
          // it comes back wrapped in an array even for a single insert.
          const wants = String(req.headers["prefer"] || "").includes("return=representation");
          if (!wants) { res.writeHead(201, { "access-control-allow-origin": "*" }); return res.end(); }
          return send(res, 201, [{ id: 99, ...parsed }]);
        });
        return;
      }
      return pgError(res, 405, "42501", "method not allowed");
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
    reads = 0;
    const { page } = await newPage();
    const t0 = Date.now();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    let shown = true;
    try { await page.getByText(/Couldn't load the services/i).waitFor({ timeout: 20000 }); }
    catch { shown = false; }
    const ms = Date.now() - t0;
    ok("a failed read shows a sentence a visitor can act on", shown,
      "never appeared within 20s: " + (await page.locator("body").innerText()).slice(0, 300));
    // A 5xx is worth retrying — those recover — but the library default of three
    // retries at 1s/2s/4s left the visitor in front of empty skeletons for 7.4
    // seconds. This is the assertion that keeps that from creeping back.
    ok(`the visitor is told within 4s, not 7.4 (took ${(ms / 1000).toFixed(1)}s)`, ms < 4000, `${ms}ms`);
    ok(`a 5xx is retried, but only a couple of times (${reads} reads)`, reads > 1 && reads <= 3, `${reads} reads`);
    await page.context().close();
  }

  // ── 3b. a 4xx is never retried — the answer cannot change ─────────────────
  {
    mode = "denied";
    reads = 0;
    const { page } = await newPage();
    const t0 = Date.now();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    let shown = true;
    try { await page.getByText(/Couldn't load the services/i).waitFor({ timeout: 10000 }); }
    catch { shown = false; }
    const ms = Date.now() - t0;
    ok("a 403 surfaces as an error state too", shown, (await page.locator("body").innerText()).slice(0, 300));
    // The case this matters for: a page that lists a `collect` table. The API
    // says 403 and will say 403 every time, so retrying only delays the truth.
    ok(`a 4xx is not retried (${reads} read)`, reads === 1, `${reads} reads — a 4xx answer cannot change`);
    ok(`and it fails fast (took ${(ms / 1000).toFixed(1)}s)`, ms < 2500, `${ms}ms`);
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
    // The refusal has to reach the visitor as a SENTENCE. PostgREST hands back
    // the raw Postgres text — 'conflicting key value violates exclusion
    // constraint "ex_appointments_nooverlap"' — which is what this page showed
    // its customers until `humanPgError` translated the SQLSTATE. Both halves are
    // asserted: the sentence appears AND the jargon does not, because a passing
    // substring check would survive the constraint name being appended to it.
    ok("a 409 tells the visitor what happened, in a sentence",
      /just been taken/i.test(body), body.slice(-400));
    ok("the raw Postgres error is not shown to a customer",
      !/exclusion constraint|SQLSTATE|23P01|violates/i.test(body), body.slice(-400));
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
