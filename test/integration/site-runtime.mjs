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

// The reference app, read from disk rather than copied — this test is only
// meaningful if it runs the real thing.
//
// EVERY ROUTE, NOT JUST index.tsx. The build service wipes `src/routes` before
// writing what it was posted, so a route this leaves out simply does not exist
// in the built app — and the reference page navigates to `/book`, which
// navigates to `/manage`. Posting the index alone made `tsc` refuse
// `to: "/book"` as not assignable to `"/" | "." | ".."`, so the build failed
// and every assertion below it never ran. That is the same failure the chart
// exclusion test hit (`<Link to="/menu">` against a route nobody posted), and
// it broke this job the day the reference page gained a Book button.
//
// DERIVED, NOT LISTED, for that reason: naming the three routes here means the
// next link added to the reference app breaks this test again, in a way that
// reads as unrelated to whoever added it.
const ROUTES = Object.fromEntries(
  fs.readdirSync(path.join(TEMPLATE, "src/routes"))
    .filter((f) => f.endsWith(".tsx") && f !== "__root.tsx")
    .map((f) => [f, fs.readFileSync(path.join(TEMPLATE, "src/routes", f), "utf8")]),
);
// AN EDIT PAGE, WRITTEN THE WAY THE GENERATOR WRITES ONE.
//
// `useUpdateRow` accepts the columns bare or nested under `values`, because the
// eval recorded the nested form four times in five runs. The TYPE accepting it
// is only half: a mutation that made the runtime ignore `values` and PATCH an
// empty body survived the whole unit suite — a page that compiles, publishes,
// and silently saves nothing. Only driving it in a browser can see that.
ROUTES["edit.tsx"] = `import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useUpdateRow, type Row } from "@/lib/rows";

export const Route = createFileRoute("/edit")({ component: Edit });

type Service = Row & { name: string; price: number | null };

function Edit() {
  const update = useUpdateRow<Service>("services");
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    update.mutate({ id: 1, values: { name: "Skin fade" } }, { onSettled: () => setDone(true) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <main data-done={done ? "yes" : "no"}>edit</main>;
}
`;

// A SEARCH BOX, WRITTEN THE OBVIOUS WAY — the value typed handed straight to
// `useRows` in an object literal.
//
// That literal is the whole reason this page exists. It is a NEW object on every
// render, so a debounce keyed on the object's identity restarts its timer every
// render and never fires: the list would freeze on its first result and never
// update again. Only driving real keystrokes can tell that apart from a debounce
// that works, because both typecheck and both look right in the source.
ROUTES["find.tsx"] = `import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";

export const Route = createFileRoute("/find")({ component: Find });

type Service = Row & { name: string };

function Find() {
  const [q, setQ] = React.useState("");
  // SOMETHING ELSE ON THE PAGE THAT RE-RENDERS, and it is what makes this probe
  // honest. A debounce keyed on the params OBJECT resets its timer on every
  // render, so on a page that renders only when you type it still fires and the
  // bug hides. Any live element — a clock, a countdown, a carousel, a "3 left"
  // badge — resets it forever and the list never updates again. A generated
  // site has one of those more often than not.
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60);
    return () => clearInterval(t);
  }, []);
  const { data = [], isFetching } = useRows<Service>("services", { limit: q.length + 1 });
  return (
    <main>
      <input aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <p data-busy={isFetching ? "yes" : "no"} data-limit={String(q.length + 1)}>
        {data.length} found
      </p>
    </main>
  );
}
`;

// A BASKET ACROSS TWO PAGES — the thing that could not be built at all before
// `useCart`, and the reason it exists.
ROUTES["shop.tsx"] = `import { createFileRoute, Link } from "@tanstack/react-router";
import { useCart } from "@/lib/rows";

export const Route = createFileRoute("/shop")({ component: Shop });

function Shop() {
  const cart = useCart("orders");
  return (
    <main>
      <button data-t="add" onClick={() => cart.add(1)}>Add one</button>
      {/* TWO CALLS IN ONE TICK. A mutator reading the RENDERED lines starts both
          from the same snapshot and the second erases the first, so this button
          would add 1 instead of 2 — a double-clicked "Add" losing an item. */}
      <button data-t="add2" onClick={() => { cart.add(2); cart.add(2); }}>Add two at once</button>
      <button data-t="clear" onClick={() => cart.clear()}>Clear</button>
      <span data-t="count">{cart.count}</span>
      <span data-t="ready">{cart.ready ? "yes" : "no"}</span>
      <Link to="/basket">Basket</Link>
    </main>
  );
}
`;

ROUTES["basket.tsx"] = `import { createFileRoute } from "@tanstack/react-router";
import { useCart } from "@/lib/rows";

export const Route = createFileRoute("/basket")({ component: Basket });

function Basket() {
  const cart = useCart("orders");
  return (
    <main>
      <span data-t="count">{cart.count}</span>
      <span data-t="lines">{JSON.stringify(cart.lines)}</span>
      <span data-t="qty1">{cart.qtyOf(1)}</span>
      <span data-t="ready">{cart.ready ? "yes" : "no"}</span>
    </main>
  );
}
`;
const REFERENCE = ROUTES["index.tsx"];
if (!REFERENCE) throw new Error("the template has no src/routes/index.tsx to drive");

// What a failed read has to put in front of a visitor. Matched on the SHAPE of
// the sentence rather than its exact words: this looked for "Couldn't load the
// services" and the reference page now says "the price list", so the wait timed
// out at 20s and reported the retry policy as broken when the copy had simply
// been edited. The assertion is that a visitor sees a sentence instead of a
// skeleton forever — the noun is the page author's business.
const FAILED_READ = /(couldn't|couldn’t|could not|unable to) load|refresh and try again/i;

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
const patched = [];

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
  fs.copyFileSync(path.join(sandbox, "src/styles.css"), path.join(sandbox, ".styles-base.css"));
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
    body: JSON.stringify({ files: ROUTES, slug: SLUG, title: "Barber Shop" }),
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
          // ASKING FOR THE ROW BACK IS REFUSED ON A collect TABLE, and this
          // stub used to hand it over — which is why this harness passed, all
          // 23 checks green, while every real generated site answered 403 to
          // its own customers. Measured live 2026-08-04.
          //
          // The mechanism it now mirrors: a `collect` table is granted INSERT
          // and nothing else, `Prefer: return=representation` makes PostgREST
          // run `INSERT … RETURNING`, and RETURNING needs SELECT. Postgres
          // raises 42501 and the whole insert fails — the row is NOT written.
          //
          // A fake more permissive than the real thing hides bugs exactly the
          // way one that is less capable does. Both have now happened here.
          const wants = String(req.headers["prefer"] || "").includes("return=representation");
          if (wants && table === "appointments") {
            return pgError(res, 403, "42501", `permission denied for table ${table}`);
          }
          if (!wants) { res.writeHead(201, { "access-control-allow-origin": "*" }); return res.end(); }
          return send(res, 201, [{ id: 99, ...parsed }]);
        });
        return;
      }
      if (req.method === "PATCH") {
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          let parsed = null; try { parsed = JSON.parse(body); } catch {}
          patched.push({ table, body: parsed });
          return send(res, 200, [{ id: 1, ...(parsed || {}) }]);
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
  // A REAL PATH SINCE 2026-08-09, not `#/book`. The stub above already falls
  // back to index.html for anything it does not have, which is the Worker's own
  // rule — so `/s/<slug>/book` serves the shell and the router resolves the book
  // route from the path. Left as a hash it would render the INDEX route at a URL
  // that still ends in "book": the page loads, it is a real page, it is the
  // wrong one, and every assertion about the form fails with nothing saying why.
  const formUrl = `${base}book`;
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
    try { await page.getByText(FAILED_READ).waitFor({ timeout: 20000 }); }
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
    try { await page.getByText(FAILED_READ).waitFor({ timeout: 10000 }); }
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
    // THE FORM IS ON /book, NOT ON THE INDEX PAGE. The reference app grew a
    // booking route and the index page kept only a "Book a chair" button; this
    // block went on driving `base` and timed out waiting for a combobox that is
    // one navigation away. `formPage()` is the one place that knows where the
    // form lives, so moving it again is a one-line change here.
    const { page, errors } = await newPage();
    await page.goto(formUrl, { waitUntil: "networkidle" });

    // shadcn's Select is a Radix portal, not a <select> — open it and pick.
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Skin fade" }).click();
    await page.getByLabel("Your name").fill("Ada Lovelace");
    await page.getByLabel("Phone").fill("07700900123");
    await page.locator('input[type="date"]').fill("2026-08-03");
    // The time is an AvailabilityGrid, not an <input type="time">: taken slots
    // are struck through and disabled so a visitor sees a slot has gone BEFORE
    // filling the form in. Picking one is a click, and its accessible name is
    // the slot itself.
    await page.getByRole("button", { name: "10:30", exact: true }).click();
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
    // A CONFIRMATION SCREEN, not a silently-emptied form. This asserted that the
    // name field went blank, which was the old behaviour only because the
    // confirmation was gated behind a claim token the insert could never return
    // — reading that token off the insert is what made every submission 403.
    // With the gate gone the page always confirms, which is what a customer who
    // just booked needs to see. A blank form is indistinguishable from one that
    // never sent.
    ok("the visitor gets a confirmation screen, not a blank form",
      /you're booked/i.test(afterBody) && !(await page.getByLabel("Your name").count()),
      afterBody.slice(-400));
    ok("no runtime error during submit", errors.length === 0, errors.join("\n"));
    await page.context().close();
  }

  // ── 5. the API's own error message reaches the visitor ────────────────────
  {
    mode = "overlap";
    posted.length = 0;
    const { page } = await newPage();
    await page.goto(formUrl, { waitUntil: "networkidle" });
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Beard trim" }).click();
    await page.getByLabel("Your name").fill("Grace Hopper");
    await page.getByLabel("Phone").fill("07700900456");
    await page.locator('input[type="date"]').fill("2026-08-03");
    // The time is an AvailabilityGrid, not an <input type="time">: taken slots
    // are struck through and disabled so a visitor sees a slot has gone BEFORE
    // filling the form in. Picking one is a click, and its accessible name is
    // the slot itself.
    await page.getByRole("button", { name: "10:30", exact: true }).click();
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
    await page.goto(formUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Request appointment/i }).click();
    await page.waitForTimeout(800);
    const body = await page.locator("body").innerText();
    ok("an empty form is rejected client-side, with no request sent", posted.length === 0, JSON.stringify(posted));
    ok("the visitor is told which field is wrong", /Pick a service|Tell us your name/i.test(body), body.slice(0, 600));
    await page.context().close();
  }
  // ── 7. an edit written the nested way actually SAVES ──────────────────────
  //
  // The type accepting `{ id, values: {...} }` is only half the fix. A mutation
  // that made the runtime ignore `values` and PATCH an empty body survived the
  // entire unit suite: the page compiles, publishes, reports success, and saves
  // nothing. This is the only check that can see the difference.
  {
    mode = "ok";
    patched.length = 0;
    const { page } = await newPage();
    await page.goto(`${base}edit`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("main")?.dataset.done === "yes", null, { timeout: 8000 }).catch(() => {});
    ok("an edit written with the columns under `values` reaches the API",
      patched.length === 1, JSON.stringify(patched));
    ok("…and the COLUMN is in the body, not an empty object",
      patched[0] && patched[0].body && patched[0].body.name === "Skin fade",
      JSON.stringify(patched[0] && patched[0].body));
    // …and `values` itself is not sent as though it were a column, which is the
    // original error this whole change is about.
    ok("…and `values` is not sent as a column",
      patched[0] && patched[0].body && patched[0].body.values === undefined,
      JSON.stringify(patched[0] && patched[0].body));
    await page.context().close();
  }

  // ── 8. a search box does not spend the site's read allowance per keystroke ─
  //
  // Reads share ONE rate-limit bucket for the whole site (300/min), so a
  // visitor typing steadily into an undebounced search field can exhaust the
  // allowance for every other visitor's every other page. `useRows` holds a
  // CHANGED set of parameters still for a moment; nothing on the page asks for
  // that, which is the point.
  {
    mode = "ok";
    const { page } = await newPage();
    await page.goto(`${base}find`, { waitUntil: "networkidle" });
    const box = page.getByLabel("Search");
    await box.waitFor({ timeout: 8000 });

    reads = 0;
    // Six keystrokes, faster than the settle window. Undebounced this is six
    // requests; settled it is one.
    await box.pressSequentially("fadeee", { delay: 30 });
    await page.waitForTimeout(900);
    const typed = reads;
    ok(`six keystrokes cost one read, not six (${typed})`, typed === 1,
      `${typed} reads — an undebounced box would be 6`);

    // THE ASSERTION THAT CATCHES THE IDENTITY BUG, and it must be here: a
    // debounce keyed on the params OBJECT never fires at all, so the read count
    // above would be 0 — which passes no test that only counts down. The list
    // has to have actually caught up with what was typed.
    const limit = await page.locator("p").getAttribute("data-limit");
    ok("…and the list did catch up with what was typed", limit === "7",
      `the page is asking for limit=${limit}, expected 7 — the settled value never advanced`);

    // A pause between letters is a separate search and is allowed to cost one
    // read each: the settle window is a pause, not a cap.
    reads = 0;
    await box.pressSequentially("x", { delay: 10 });
    await page.waitForTimeout(700);
    await box.pressSequentially("y", { delay: 10 });
    await page.waitForTimeout(700);
    ok(`two deliberate searches are two reads (${reads})`, reads === 2, `${reads} reads`);
    await page.context().close();
  }

  // ── 9. a basket survives leaving the page ─────────────────────────────────
  //
  // The thing that could not be built at all before `useCart`: measured over
  // the corpus the generator learns from, 0 of 324 exemplars hold any state
  // across routes, so "add here, check out there" had no shape.
  {
    const { page, errors: errs } = await newPage();
    await page.goto(`${base}shop`, { waitUntil: "networkidle" });
    const count = () => page.locator('[data-t="count"]').innerText();

    await page.locator('[data-t="add"]').click();
    ok("adding an item moves the basket count", (await count()) === "1", await count());

    // A DOUBLE-CLICKED ADD. Both calls land in one tick; a mutator reading the
    // rendered lines starts both from the same snapshot and the second erases
    // the first, so this reads 2 instead of 3 — an item silently lost.
    await page.locator('[data-t="add2"]').click();
    ok("two adds in one tick both count", (await count()) === "3", await count() + " — expected 3");

    // ACROSS A NAVIGATION, which is the whole feature.
    await page.getByRole("link", { name: "Basket" }).click();
    await page.waitForURL(/\/basket$/, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('[data-t="ready"]')?.textContent === "yes", null, { timeout: 8000 }).catch(() => {});
    ok("the basket survives a navigation", (await count()) === "3", await count());
    ok("…and it carries the row id and quantity, and NOTHING about money",
      /^\[\{"id":1,"qty":1\},\{"id":2,"qty":2\}\]$/.test(await page.locator('[data-t="lines"]').innerText()),
      await page.locator('[data-t="lines"]').innerText());

    // ACROSS A RELOAD — localStorage, not React state.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector('[data-t="ready"]')?.textContent === "yes", null, { timeout: 8000 }).catch(() => {});
    ok("…and a reload", (await count()) === "3", await count());

    // AND THE RELOAD IS WHERE A HYDRATION MISMATCH WOULD SHOW: every route is
    // prerendered, the server has no storage, and this is a page loaded with
    // something already in the basket.
    //
    // WHAT KEEPS IT QUIET IS `getServerSnapshot`, which React uses for the
    // client's hydration render too — measured, by removing the `ready` gate and
    // watching this stay green. So this asserts the PROPERTY rather than any one
    // line: a basket that ever starts rendering before hydration settles is a
    // mismatch on every shop on the platform, whichever line caused it.
    ok("…with no hydration mismatch — the server renders an empty basket and the client agrees",
      errs.length === 0, errs.slice(0, 2).join(" · "));

    // COMING BACK FROM STRIPE EMPTIES IT. Checkout leaves the site and returns
    // to `?paid=<orderId>`; without this the basket they just bought is still
    // sitting there, inviting them to pay for it twice.
    await page.goto(`${base}basket?paid=42`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector('[data-t="ready"]')?.textContent === "yes", null, { timeout: 8000 }).catch(() => {});
    ok("coming back paid empties the basket", (await count()) === "0", await count());
    await page.goto(`${base}basket`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector('[data-t="ready"]')?.textContent === "yes", null, { timeout: 8000 }).catch(() => {});
    ok("…and it stays empty on the next visit", (await count()) === "0", await count());
    await page.context().close();
  }

  // ── 10. a corrupt stored basket does not break the shop ───────────────────
  //
  // This value is editable by hand and survives across deploys. Parsed
  // carelessly it throws during render, and the customer's shop is broken for
  // good with nothing they can do about it.
  {
    const { page, errors } = await newPage();
    await page.goto(`${base}shop`, { waitUntil: "networkidle" });
    // ADD SOMETHING FIRST, so the real key exists to overwrite. A fresh browser
    // context has no basket at all, and guessing the key name here wrote the
    // corrupt value somewhere nothing reads — which reported a clean basket and
    // an empty one as the same number, passing this check for the wrong reason.
    await page.locator('[data-t="add"]').click();
    const key = await page.evaluate(() => Object.keys(localStorage).find((x) => x.startsWith("site_cart_")) || "");
    ok("the basket is stored per site and per table", /^site_cart_.+_orders$/.test(key), key || "(no key written)");
    // EVERY BAD LINE HAS A VALID QUANTITY, deliberately. The first fixture here
    // was `{"id":null}` and `{"qty":"x"}`, both of which the QUANTITY check
    // already refuses — so the id check never had to fire and a mutation
    // removing it passed. These can only be caught by looking at the id: an
    // object, a boolean, an empty string, and a line that is not an object.
    await page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify([
        { id: { evil: 1 }, qty: 2 },
        { id: true, qty: 2 },
        { id: "", qty: 2 },
        "nonsense",
        { qty: 2 },
        { id: 9, qty: 3 },
      ]));
    }, key);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector('[data-t="ready"]')?.textContent === "yes", null, { timeout: 8000 }).catch(() => {});
    ok("a corrupt basket keeps only the lines that make sense",
      (await page.locator('[data-t="count"]').innerText()) === "3",
      await page.locator('[data-t="count"]').innerText());
    ok("…and nothing threw", errors.length === 0, errors.slice(0, 2).join(" · "));
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
