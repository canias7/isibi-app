// Production smoke test for the builder's send path.
//
// The e2e test proves the database layer; this proves the ROUTE — auth, the
// credit charge, the Sonnet schema design, provisioning, the page generator, the
// build container, and the published app — by driving the deployed Worker over
// HTTP exactly as the browser does.
//
// It creates its own throwaway user, runs one real build, then removes the
// user, its Neon project and its published files. Costs two Sonnet calls (the
// schema design and the pages), plus a third if the pages need a repair pass.
//
// Needs SUPABASE_SERVICE_KEY and NEON_API_KEY. Run from CI (workflow_dispatch),
// or locally with those in the environment.
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { dropUserProject, connForDatabase, dbNameForSite, sqlQuery } from "../../site-db.mjs";

// Use whatever Chromium is already on the machine — same reasoning as
// site-runtime.mjs: the pinned playwright version and a pre-installed browser
// build often disagree, and the build number is not what this test is about.
// Returns null to let playwright resolve its own.
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
  found.sort((a, b) => Number(/headless/.test(a)) - Number(/headless/.test(b)));
  return found[0] || null;
}

const BASE = process.env.SMOKE_BASE_URL || "https://isibi.ai";
const SUPABASE_URL = "https://ujrqdmmtcptvimazlhom.supabase.co";
// Public by design — it is shipped in the browser bundle. Kept inline so the
// workflow needs no extra secret.
const ANON = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const SVC = process.env.SUPABASE_SERVICE_KEY || "";
const env = { NEON_API_KEY: process.env.NEON_API_KEY };

if (!SVC) { console.error("SUPABASE_SERVICE_KEY is required"); process.exit(1); }

let passed = 0, failed = 0;
const ok = (name, cond, extra) => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? "  -> " + String(extra).slice(0, 300) : ""}`); }
};
const svc = (extra) => ({ apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json", ...(extra || {}) });

const stamp = Date.now().toString(36);
const email = `smoke-${stamp}@isibi.ai`;
const password = `Sm0ke-${stamp}-${Math.random().toString(36).slice(2, 10)}`;
// `jwt` is hoisted because cleanup needs it: taking the published site down is
// an authenticated call, so it has to happen in `finally` while the throwaway
// user still exists.
let userId = null, slug = null, projectId = null, jwt = null;

try {
  // --- a throwaway, already-confirmed user -------------------------------
  const mk = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST", headers: svc(),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const made = await mk.json().catch(() => ({}));
  userId = made && made.id;
  ok("created a throwaway user", !!userId, JSON.stringify(made));
  if (!userId) throw new Error("cannot continue without a user");

  const si = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const sess = await si.json().catch(() => ({}));
  jwt = sess && sess.access_token;
  ok("signed in and got a session", !!jwt, JSON.stringify(sess).slice(0, 200));
  if (!jwt) throw new Error("cannot continue without a token");

  // --- the actual build ---------------------------------------------------
  const brief = "A small barber shop site. Visitors book an appointment by picking a date and time, and can see the list of services with prices.";

  // The slug is CHOSEN here, not left to the designer.
  //
  // A slug is claimed by whoever built it first, across every account. Letting
  // the designer name the site from a fixed brief meant it kept proposing the
  // same good name — and the moment any real user (or an earlier manual test)
  // owns that name, the build correctly answers 409 and the whole smoke run
  // fails on something that is not a bug. It failed exactly that way on
  // 2026-07-28 against `sharp-fade-barbershop`. A test must not depend on a
  // global namespace it does not control.
  const runSlug = "smoke-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  console.log("posting a real build…", runSlug);
  const r = await fetch(`${BASE}/api/site/react-build`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({ brief, slug: runSlug }),
  });
  const d = await r.json().catch(() => ({}));
  ok("build returns 200", r.status === 200, r.status + " " + JSON.stringify(d).slice(0, 300));
  slug = d && d.slug;
  ok("response carries a slug and url", !!(slug && d.url), JSON.stringify(d).slice(0, 200));
  ok("and it is the slug we asked for", slug === runSlug, `${slug} !== ${runSlug}`);
  ok("response says the site has a backend", d && d.backend === true);
  ok("at least one table was created", Array.isArray(d.tables) && d.tables.length > 0, JSON.stringify(d.tables));
  // Nothing can write to a `display` table after the build, so a table that was
  // not seeded here is an empty list forever.
  ok("every display table got starter content", (() => {
    const want = (Array.isArray(d.schema) ? d.schema : []).filter((t) => t.access === "display").map((t) => t.name);
    return want.length > 0 && want.every((n) => (d.seeded || {})[n] > 0);
  })(), "seeded=" + JSON.stringify(d.seeded || {}) + " schema=" + JSON.stringify(d.schema || []));
  console.log("   seeded:", JSON.stringify(d.seeded || {}));
  console.log("   designed:", JSON.stringify(d.tables), "brand:", d.brand);
  console.log("   pages:", JSON.stringify(d.files), "→", d.page, d.buildMs ? "(" + d.buildMs + "ms)" : "");
  if (d.notes) console.log("   notes:", d.notes);
  if (d.problems) console.log("   problems:", JSON.stringify(d.problems));

  // --- WHAT THE BUILD ACTUALLY DID ----------------------------------------
  // The build's own account of itself, printed rather than asserted. A duration
  // is not a pass/fail — a slow build is still a correct one — but a run that
  // takes four minutes and a run that takes ninety seconds looked identical in
  // this log until now, and the schema call's real cost had never been measured
  // against the flat SITE_BUILD_FEE it is billed at.
  if (Array.isArray(d.trace) && d.trace.length) {
    // The extras are printed too — `s.ms` alone drops exactly the numbers the
    // step was instrumented to carry (the pages split, the token counts).
    const fmt = (s) => {
      const extra = Object.entries(s).filter(([k]) => k !== "s" && k !== "ms");
      return s.s + " " + s.ms + "ms" + (extra.length ? " [" + extra.map(([k, v]) => k + " " + v).join(", ") + "]" : "");
    };
    console.log("   trace:");
    for (const step of d.trace) console.log("     " + fmt(step));
    console.log("   total:", d.totalMs + "ms");
  }
  // Both model calls, side by side, in the four kinds they are priced in. Whether
  // the flat SITE_BUILD_FEE is right, and whether the cached prefixes are paying
  // for themselves, are answerable from these two lines and from nothing else.
  const usage = (label, u, extra) => u && console.log(
    `   ${label}: in ${u.in} · out ${u.out} · cacheRead ${u.cacheRead} · cacheWrite ${u.cacheWrite}${extra || ""}`);
  usage("schema call", d.schemaUsage, ` → ${d.schemaCredits} credits, charged ${d.schemaFee}`);
  usage("pages call ", d.pagesUsage, ` → charged ${d.cost - (d.schemaFee || 0)} credits`);
  // A RETRIED CONTAINER, SAID OUT LOUD. A build that succeeded on its second
  // compile is indistinguishable from one that succeeded on its first unless
  // this is printed — and the whole point of the retry is that the failure it
  // absorbs is infrastructure, which nobody would otherwise learn was happening.
  if (d.builds > 1) console.log(`   the container was retried: ${d.retriedBuild}`);
  // Reported, never enforced: the trace is a diagnostic, and a smoke test that
  // fails on a slow step turns a measurement into a flake.
  ok("the build reports its own steps", Array.isArray(d.trace) && d.trace.length >= 3,
    "trace=" + JSON.stringify(d.trace || null));

  // --- the access levels are enforced live --------------------------------
  // The build must produce something readable and something submittable, and
  // must NOT let a visitor read back other people's submissions.
  const levels = Array.isArray(d.schema) ? d.schema : [];
  ok("build reports an access level per table", levels.length > 0, JSON.stringify(levels));
  const display = levels.find((t) => t.access === "display");
  const collect = levels.find((t) => t.access === "collect");
  ok("the designer chose a readable table for content", !!display, JSON.stringify(levels));
  ok("the designer chose a write-only table for submissions", !!collect, JSON.stringify(levels));

  // Against the site's own Neon Data API, through the platform's proxy. These
  // statuses are no longer produced by a rule in the Worker — the row routes were
  // deleted 2026-07-30 — they come from the GRANTs the schema engine issues, so
  // this is now a live check that `grantsFor` says what we think it says. A
  // `display` table is granted SELECT only and a `collect` table INSERT only, and
  // Postgres refuses the other direction with 42501, which PostgREST answers 403.
  // A BRAND-NEW SITE IS NOT REACHABLE THE INSTANT THE BUILD RETURNS.
  //
  // Measured 2026-08-04: this probe ran 10s after the build and got
  // `400 missing authentication credentials` — our proxy fetches an anonymous
  // token from the site's own Neon Auth server and attaches it, and that fetch
  // had failed, so nothing was attached. A second probe 43s in timed out (503).
  // The browser then made the SAME reads at 45s and every one answered 200.
  //
  // These assertions are about GRANTS, not about latency, so they retry rather
  // than reporting a permissions failure that is really a cold start. The wait
  // is bounded and it REPORTS what it saw on the way, because "the first minute
  // of a new site's life is broken" is a real thing to know about and not
  // something a retry should paper over silently.
  const settle = async (url, want, tries = 6) => {
    let last = null;
    for (let i = 0; i < tries; i++) {
      const r = await fetch(url).catch((e) => ({ status: 0, text: async () => String(e && e.message) }));
      const body = await r.text().catch(() => "");
      last = { status: r.status, body };
      if (r.status === want) {
        if (i) console.log(`   (settled after ${i} retr${i === 1 ? "y" : "ies"}: ${url.split("/data/")[1]})`);
        return last;
      }
      await new Promise((res) => setTimeout(res, 5000));
    }
    return last;
  };

  if (display) {
    // THE BODY, NOT JUST THE STATUS. `-> 501` and `-> 400` were the entire
    // report on three failures for a whole day, and each time the reason was
    // sitting in a response nobody read. The proxy passes the Data API's answer
    // through as-is, so PostgREST's own `message`/`code`/`hint` is right there.
    const r2 = await settle(`${BASE}/api/db/${slug}/data/${display.name}?select=*`, 200);
    const b2 = r2.body;
    ok(`GET ${display.name} (display) is allowed`, r2.status === 200, r2.status + " " + b2.slice(0, 300));
    const w = await fetch(`${BASE}/api/db/${slug}/data/${display.name}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    ok(`POST ${display.name} (display) is refused`, w.status === 403,
      w.status + " " + (await w.text().catch(() => "")).slice(0, 300));
  }
  if (collect) {
    const r3 = await settle(`${BASE}/api/db/${slug}/data/${collect.name}?select=*`, 403);
    const b3 = r3.body;
    ok(`GET ${collect.name} (collect) is refused — submissions are not public`,
      r3.status === 403, r3.status + " " + b3.slice(0, 300));
  }

  // --- the ledger rows ----------------------------------------------------
  if (slug) {
    const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}&select=neon_db,uid`, { headers: svc() });
    const rows = await g.json().catch(() => []);
    ok("site_backends row written", Array.isArray(rows) && rows.length === 1 && !!rows[0].neon_db, JSON.stringify(rows));
    ok("site is owned by the caller", rows[0] && rows[0].uid === userId);
  }
  // BY SLUG, from `site_project`. This read `user_site_project?uid=eq.<user>`,
  // the PER-USER layout that per-site projects replaced on 2026-07-29 — so it
  // asserted against a table this design stopped writing, and failed on a build
  // that had provisioned perfectly. The cleanup below drops whatever project it
  // finds, so reading the wrong table also leaked one project per run.
  const p = await fetch(`${SUPABASE_URL}/rest/v1/site_project?slug=eq.${slug}&select=neon_project,neon_conn`, { headers: svc() });
  const projs = await p.json().catch(() => []);
  projectId = projs && projs[0] && projs[0].neon_project;
  ok("a Neon project was provisioned for this site", !!projectId, JSON.stringify(projs));

  // WHAT `_meta` ACTUALLY CONTAINS — asserted, not inferred.
  //
  // The 501s below say `siteDataBase` resolved null, and from outside that has
  // two indistinguishable causes: the row was never written, or it was written
  // and cannot be parsed. A day was spent reasoning between them, and two
  // theories were wrong (the field name; a cached null — `makeCache` refuses to
  // cache absence, so that one was never possible). This reads the row.
  //
  // `data_api` is what every list and every form on the published site goes
  // through, and `auth_info` is every sign-in — with the Worker's own row routes
  // deleted, a site missing them is a shell.
  const proj0 = projs && projs[0];
  if (proj0 && proj0.neon_conn) {
    try {
      const siteConn = connForDatabase(proj0.neon_conn, dbNameForSite(slug));
      const meta = await sqlQuery(siteConn, "SELECT k, length(v) AS n FROM _meta ORDER BY k");
      const keys = meta.map((r) => `${r.k}(${r.n})`).join(", ") || "(empty)";
      console.log("   _meta holds: " + keys);
      const has = (k) => meta.some((r) => r.k === k && Number(r.n) > 0);
      ok("_meta records the Data API endpoint", has("data_api"), keys);
      ok("_meta records the auth endpoint", has("auth_info"), keys);
      // Parsed, not just present: a stored blob the resolver cannot read is the
      // same 501 from a visitor's side, and telling them apart is the point.
      const row = meta.find((r) => r.k === "data_api");
      if (row) {
        const v = await sqlQuery(siteConn, "SELECT v FROM _meta WHERE k='data_api'");
        let url = null;
        try { url = JSON.parse(v[0].v).url; } catch { /* reported below */ }
        ok("the recorded Data API endpoint is an https url", /^https:\/\//.test(String(url || "")), String(url).slice(0, 120));
      }
    } catch (e) {
      console.log("   FAIL could not read the site's _meta -> " + String(e && e.message).slice(0, 200));
      failed++;
    }
  }

  // --- the published page -------------------------------------------------
  // `page` says which of the two things was published. The generated app is the
  // normal outcome; the placeholder is the fallback for a build that failed, so
  // landing on it is a regression and has to go red rather than pass quietly.
  // Diagnostic order matters: `notes` is the model's own prose and can run to
  // hundreds of characters, which pushed the fields that say WHY off the end of
  // the truncated line. stage/error/problems first, notes last and short.
  // `cited` is the SOURCE LINE each compiler error points at. Without it a
  // typecheck failure is a file and a column number, and diagnosing one means
  // guessing what the model wrote — a whole round went on inferring
  // `TS2344: Type 'PublicBooking' does not satisfy the constraint 'Row'` from
  // its position alone. The pages are gone the moment the build returns.
  ok("the generated app was published, not the fallback", d.page === "app",
    "page=" + d.page + " stage=" + (d.stage || "-") +
    " problems=" + JSON.stringify(d.problems || []));
  // THE ERROR AND ITS SOURCE LINES GO ON THEIR OWN LINES.
  //
  // `ok()` truncates its extra at 300 characters, and this used to pack
  // page/stage/error/problems/cited/notes into that one string. A typecheck
  // failure reports two or three TS errors, which is more than 300 characters by
  // itself — so `cited`, the field added specifically to explain a compile
  // failure, was pushed off the end and printed nothing on the first real
  // typecheck failure after it shipped.
  //
  // The comment this replaces already said exactly that, about `notes`: "which
  // pushed the fields that say WHY off the end of the truncated line". The fix
  // then was to reorder. Reordering only moves which field gets lost.
  if (d.page !== "app") {
    if (d.error) console.log("   error:\n     " + String(d.error).split("\n").join("\n     "));
    if (d.cited && d.cited.length) console.log("   the model wrote:\n     " + d.cited.join("\n     "));
    else if (d.stage === "typecheck") console.log("   (no cited lines — citedLines could not match the error to a page)");
  }
  ok("the build reports the route files it wrote",
    Array.isArray(d.files) && d.files.some((f) => /index\.tsx$/.test(f)), JSON.stringify(d.files));

  if (slug) {
    const page = await fetch(`${BASE}/s/${slug}/`);
    const html = await page.text().catch(() => "");
    ok("published page serves 200", page.status === 200, String(page.status));
    if (d.page === "app") {
      ok("the page is the compiled app shell", /id="root"/.test(html) && /<script[^>]+src=/.test(html), html.slice(0, 240));
      ok("its stylesheet was published too", /<link[^>]+\.css/.test(html), html.slice(0, 240));
      // What a shared link shows. Link previews fetch the HTML once and read the
      // head — they do not run the bundle — so without these a customer sent
      // this URL on WhatsApp sees a bare address. Checked HERE because the tags
      // are injected at publish time and this is the only place a real publish
      // happens on every deploy.
      ok("a shared link has a description", /<meta name="description" content="[^"]{10,}"/.test(html), html.slice(0, 400));
      ok("and an Open Graph title", /<meta property="og:title" content="[^"]{2,}"/.test(html), html.slice(0, 400));
      ok("and a twitter card, exactly one", (html.match(/twitter:card/g) || []).length === 1, String((html.match(/twitter:card/g) || []).length));
      ok("the description is not the raw brief", !/A small barber shop site\. Visitors book/.test(html),
        "the designer should write a customer-facing sentence, not echo the prompt");
      // The shell is a root div — the table names live in the bundle, which is
      // also the only proof the pages actually talk to the database that was
      // just provisioned rather than to hardcoded content. The router code-splits
      // each route into its own lazy chunk, so the entry NAMES the pages rather
      // than containing them and the chunks have to be followed.
      const grab = (href) => fetch(href).then((x) => (x.ok ? x.text() : "")).catch(() => "");
      const entry = (html.match(/src="([^"]+\.js)"/) || [])[1];
      const entryUrl = entry ? new URL(entry, `${BASE}/s/${slug}/`).href : "";
      const head = entryUrl ? await grab(entryUrl) : "";
      // Chunks sit beside the entry and are named relative to it ("./index-X.js").
      const chunks = [...new Set([...head.matchAll(/["'](\.\/[A-Za-z0-9._-]+\.js)["']/g)].map((m) => m[1]))].slice(0, 8);
      const js = head + (await Promise.all(chunks.map((c) => grab(new URL(c, entryUrl).href)))).join("");
      ok("the bundle serves 200 from the same site", !!head, entry || "no script src in the shell");
      ok("the bundle reads a table the build created",
        !!js && Array.isArray(d.tables) && d.tables.some((t) => js.includes(t)),
        entry + " + " + chunks.length + " chunk(s)");

      // IS THE CONTAINER RUNNING THE IMAGE WE JUST DEPLOYED?
      //
      // The template — including `@/lib/rows.ts` — is baked into the build
      // container's image, so a site is only as current as the image that built
      // it. Cloudflare's rollout is asynchronous: `wrangler` returns after
      // "Modified application", and this job starts immediately afterwards.
      //
      // Measured 2026-08-04: the image went `ede44c96` -> `070b1f68` at 17:37:35
      // and the build POST landed ~60s later. Its bundle was the PREVIOUS
      // rows.ts, so `usePublicRows` still fetched the table instead of the view
      // and the run reported two failures with no hint that the code under test
      // was not the code that ran. That cost a full diagnosis to rule out a bug
      // that did not exist.
      //
      // The check below is a DIGEST comparison rather than the marker string this
      // comment used to describe — see the note on it.
      // A DIGEST, NOT A MARKER — and the difference has now cost two diagnoses.
      //
      // This used to look for the string `_public` in the bundle. That proved
      // the image was at least as new as the change which introduced it, and
      // nothing more: after the NEXT change it passes happily while testing
      // stale code. Exactly what happened on 2026-08-04 — a booking-form fix
      // merged, deployed at 22:53:09, the build POST landed 42s later on the
      // PREVIOUS image, the marker check went green, and the run reported the
      // bug as still present when it had already been fixed.
      //
      // A digest of `src/lib/rows.ts` changes with every edit, so comparing the
      // container's against this checkout's answers the question exactly rather
      // than approximately. Derived at both ends from the same file.
      const wantId = createHash("sha256")
        .update(fs.readFileSync(new URL("../../builder/lovable/template/src/lib/rows.ts", import.meta.url)))
        .digest("hex").slice(0, 12);
      ok("the container built this site with the CURRENT template",
        d.templateId === wantId,
        `container template ${d.templateId || "(not reported)"} != checkout ${wantId} — the image is ` +
        "behind, so this run did NOT test the code under test. Cloudflare's rollout is async; re-run after it lands.");
    } else {
      ok("the fallback page names a table it created",
        Array.isArray(d.tables) && d.tables.some((t) => html.includes(t)), html.slice(0, 160));
    }
  }

  // --- does a VISITOR actually get a working site? ------------------------
  //
  // Everything above proves the files were published. None of it executes the
  // JavaScript. A site that mounts to a blank page, or whose every data call
  // 403s, or that throws on its first render, passes every check so far — and
  // that is precisely the failure GENERATOR.md exists to prevent: a page that
  // typechecks, bundles, screenshots fine, and does nothing.
  //
  // site-runtime.mjs drives the REFERENCE page against a STUB. This drives the
  // REAL generated page against the REAL API, which is the only version of the
  // question a user cares about.
  if (d.page === "app" && slug) {
    let browser = null;
    try {
      const { chromium } = await import("playwright");
      browser = await chromium.launch({ executablePath: findChromium() || undefined });
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const pg = await ctx.newPage();

      // A page that throws during render still leaves the shell in the DOM, so
      // "did it render" is not enough on its own — the errors have to be caught.
      const pageErrors = [], consoleErrors = [], apiCalls = [];
      pg.on("pageerror", (e) => pageErrors.push(String(e && e.message).slice(0, 200)));
      pg.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
      pg.on("response", (res) => {
        const u = res.url();
        if (u.includes(`/api/db/${slug}/data/`)) apiCalls.push({ method: res.request().method(), url: u, status: res.status() });
      });

      await pg.goto(`${BASE}/s/${slug}/`, { waitUntil: "networkidle", timeout: 60000 });
      // React mounting is what separates a live site from a served file.
      await pg.waitForFunction(() => !!document.querySelector("#root")?.firstElementChild, null, { timeout: 20000 }).catch(() => {});

      const mounted = await pg.evaluate(() => (document.querySelector("#root")?.childElementCount || 0) > 0);
      ok("the app mounted — React rendered into #root", mounted);
      ok("nothing threw during render", pageErrors.length === 0, pageErrors.join(" | "));
      ok("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

      const text = (await pg.evaluate(() => document.body.innerText || "")).trim();
      ok("the page rendered real content, not an empty shell", text.length > 60, `${text.length} chars: ${text.slice(0, 120)}`);

      // The whole point of the platform: the page reads the database that was
      // provisioned for it moments ago. A hardcoded page would make no call.
      const reads = apiCalls.filter((c) => c.method === "GET");
      ok("the page called its own data API", reads.length > 0, JSON.stringify(apiCalls));
      ok("every data read the page made was allowed",
        reads.length > 0 && reads.every((c) => c.status === 200),
        JSON.stringify(reads));
      // The lint predicts exactly this; here it is measured against the live API.
      const forbidden = apiCalls.filter((c) => c.status === 403);
      ok("the page never hit a 403 — it respected the access levels", forbidden.length === 0, JSON.stringify(forbidden));

      // shadcn is the whole UI contract — a page that hand-rolled its controls
      // would still render and still pass everything above. This version of
      // shadcn does not stamp `data-slot` (only 2 of the 46 components do), so
      // the marker is Radix's own a11y wiring plus new-york's class signature.
      const ui = await pg.evaluate(() => ({
        radix: document.querySelectorAll('[role="combobox"],[data-radix-collection-item],[data-state]').length,
        shadcnClasses: [...document.querySelectorAll("button,input,textarea")]
          .some((e) => /\bring-offset-background\b|\bborder-input\b|\bbg-primary\b/.test(e.className)),
        tailwind: !!document.querySelector("[class*='rounded-'],[class*='flex']"),
        forms: document.querySelectorAll("form").length,
        controls: document.querySelectorAll("form input, form textarea, form button").length,
      }));
      ok("shadcn controls are rendering, not hand-rolled ones", ui.shadcnClasses, JSON.stringify(ui));
      ok("Radix primitives are live in the page", ui.radix > 0, JSON.stringify(ui));
      ok("Tailwind utilities are applied", ui.tailwind);

      // THE FORM IS NOT NECESSARILY ON THE HOME PAGE, and asserting that it is
      // was a test defect rather than a product one. `build smoke` failed twice
      // on 2026-08-04 against a correct site: the barber shop put its booking
      // form on /book and linked to it from three places, which is where a
      // booking form belongs. The old check ran `pg.$("form")` on the home page
      // only, so it asserted a one-page site — exactly the over-specification
      // this repo already refuses elsewhere ("a timetable can legitimately
      // render the same signed in or out; that check fails on a correct site").
      //
      // So: walk the routes the BUILD ITSELF reported, home first, and stop at
      // the page that has a form.
      //
      // The router is hash history (`createHashHistory` in main.tsx), so a route
      // is `/s/<slug>/#/book` — `/s/<slug>/book` ignores the path entirely and
      // renders home. That mistake has already been made in this repo once, and
      // it is invisible: the page loads, it is a real page, it is the wrong one.
      // Hence the fingerprint assertion below rather than trusting the URL.
      const routes = (d.files || [])
        .map((f) => String(f).replace(/^src\/routes\//, "").replace(/\.tsx$/, ""))
        .filter((r) => /^[a-z0-9-]+$/i.test(r) || r === "index");
      const asHash = (r) => (r === "index" ? "#/" : "#/" + r);
      const fingerprint = () => pg.evaluate(() => (document.body.innerText || "").trim().slice(0, 400));

      const homePrint = await fingerprint();
      let formRoute = ui.forms > 0 ? "index" : null;
      let formUi = ui;
      for (const r of routes) {
        if (formRoute) break;
        if (r === "index") continue;
        await pg.goto(`${BASE}/s/${slug}/${asHash(r)}`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        // A route that renders identically to home did not navigate. Skipping it
        // is what stops a silent SPA fallback being reported as "no form here".
        if ((await fingerprint()) === homePrint) continue;
        const u = await pg.evaluate(() => ({
          forms: document.querySelectorAll("form").length,
          controls: document.querySelectorAll("form input, form textarea, form button").length,
        }));
        if (u.forms > 0) { formRoute = r; formUi = u; }
      }
      ok("the site rendered a form with real controls, on some page",
        !!formRoute && formUi.forms > 0 && formUi.controls > 1,
        `routes=${JSON.stringify(routes)} home=${JSON.stringify(ui)} found=${formRoute} ${JSON.stringify(formUi)}`);
      if (formRoute) console.log(`   the form lives on ${asHash(formRoute)}`);

      // The starter content actually reached the page. Without it a site is a
      // brochure with an empty list, and a form whose required Select reads that
      // list has nothing to choose — so nobody can submit it. This assertion
      // could not pass before seeding existed.
      ok("the seeded content is on the page, not an empty list",
        Object.keys(d.seeded || {}).length > 0, "seeded=" + JSON.stringify(d.seeded || {}));

      // And the whole reason seeding matters: a real visitor submission, filled
      // in a real browser and landing in real Postgres. Driven on whichever page
      // the walk above found the form on — the browser is already there.
      const form = await pg.$("form");
      ok("the site has a form a visitor can submit", !!form,
        formRoute ? `expected one on ${asHash(formRoute)}` : "no page in the site had one");
      if (form) {
        // Best-effort fill: the schema is designed per-brief, so the fields are
        // not known ahead of time. Every input gets something type-appropriate.
        await pg.evaluate(() => {
          const set = (el, v) => {
            const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
            Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, v);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          };
          for (const el of document.querySelectorAll("form input, form textarea")) {
            if (el.type === "hidden" || el.disabled) continue;
            if (el.type === "email") set(el, "smoke@example.com");
            else if (el.type === "tel") set(el, "5551234567");
            else if (el.type === "number") set(el, "2");
            else if (el.type === "date") set(el, "2030-06-15");
            else if (el.type === "time") set(el, "14:30");
            else if (el.type === "datetime-local") set(el, "2030-06-15T14:30");
            else if (el.type === "checkbox" || el.type === "radio") { if (!el.checked) el.click(); }
            else set(el, "Smoke Test");
          }
        });
        // shadcn Selects are buttons, not <select> — open each and take an option.
        // These are the fields fed by the seeded tables, so this is the step that
        // silently did nothing before there was anything to choose.
        for (const trigger of (await pg.$$('form [role="combobox"]')).slice(0, 4)) {
          try {
            await trigger.click({ timeout: 3000 });
            const opt = await pg.waitForSelector('[role="option"]', { timeout: 4000 });
            await opt.click({ timeout: 3000 });
          } catch { /* not every combobox opens a listbox; skip it */ }
        }
        // A SLOT GRID IS A CHOOSER MADE OF BUTTONS, and the filler above cannot
        // see it: it handles inputs, textareas and comboboxes. A generated
        // booking page picks its time from a row of buttons fed by the live
        // availability read — which is the correct design and the one this
        // platform exists to produce.
        //
        // Measured 2026-08-04: every field filled, `Time` in red, "Pick a time"
        // underneath, no POST. The form was right and the robot could not drive
        // it, so the run reported "no POST went out — a required Select with no
        // options is the usual cause", which named the wrong cause entirely.
        //
        // Deliberately narrow: only a GROUP of three or more enabled
        // `type="button"` siblings, and never the submit. One or two buttons in a
        // form are "cancel" and "add another"; three or more that share a parent
        // are options to choose between.
        await pg.evaluate(() => {
          const form = document.querySelector("form");
          if (!form) return;
          const groups = new Map();
          for (const b of form.querySelectorAll('button[type="button"]:not([disabled])')) {
            const p = b.parentElement;
            if (!p) continue;
            if (!groups.has(p)) groups.set(p, []);
            groups.get(p).push(b);
          }
          for (const [, bs] of groups) {
            if (bs.length >= 3 && !bs.some((b) => b.getAttribute("aria-pressed") === "true")) bs[0].click();
          }
        });
        await pg.waitForTimeout(400);

        const submit = await pg.$('form button[type="submit"]') || await pg.$("form button");
        if (submit) await submit.click({ timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(7000);

        const writes = apiCalls.filter((c) => c.method === "POST");
        // NAMED FOR WHAT IT CHECKS. This said "wrote to the database" and only
        // checked that a POST went OUT — so on the run that found every
        // submission being refused with 403, the log's first line about the form
        // was a green tick claiming the write had landed. A name stronger than
        // its assertion is worse than no assertion: it is a false negative that
        // reads as evidence.
        ok("the form sent a submission", writes.length > 0,
          "no POST went out — a required Select with no options is the usual cause: " + JSON.stringify(apiCalls.slice(-4)));
        ok("and the database accepted it",
          writes.length > 0 && writes.every((c) => c.status >= 200 && c.status < 300),
          JSON.stringify(writes));

        // ── AND THE OWNER CAN READ IT BACK ──────────────────────────────────
        //
        // The half this test never had. A visitor's write was proved live and
        // the OWNER'S DOOR onto the same rows — `/api/site/<slug>/rows` and
        // `/rows/<table>`, which is exactly what the builder's Data panel calls
        // — was covered only by unit tests against fakes. So "the booking
        // landed" and "the shop can see the booking" were never joined up in
        // one run, and a barber shop taking bookings nobody can read is the
        // oldest failure this platform has had.
        //
        // It is also the door that reads `collect` tables, which the published
        // site's public API refuses by design. Nothing else can see them.
        const tRes = await fetch(`${BASE}/api/site/${slug}/rows`, { headers: { Authorization: `Bearer ${jwt}` } });
        const tJson = await tRes.json().catch(() => ({}));
        const ownerTables = Array.isArray(tJson.tables) ? tJson.tables : [];
        ok("the owner's door lists the site's tables", tRes.status === 200 && ownerTables.length > 0,
          `${tRes.status} ${JSON.stringify(tJson).slice(0, 200)}`);
        console.log("   owner sees tables: " + ownerTables.map((t) => `${t.name}(${t.access})`).join(", "));

        // The table the visitor actually wrote to, taken from the POST's own
        // URL rather than guessed — the schema is designed per brief, so the
        // name is not known ahead of time.
        const wrote = writes[0] && String(writes[0].url || "");
        const target = (wrote.match(/\/data\/([^?/]+)/) || [])[1];
        if (target) {
          const rRes = await fetch(`${BASE}/api/site/${slug}/rows/${encodeURIComponent(target)}`,
            { headers: { Authorization: `Bearer ${jwt}` } });
          const rJson = await rRes.json().catch(() => ({}));
          const rows = Array.isArray(rJson.rows) ? rJson.rows : [];
          ok(`the owner can read back the ${target} the visitor submitted`,
            rRes.status === 200 && rows.length > 0, `${rRes.status} ${JSON.stringify(rJson).slice(0, 200)}`);
          // THE ROW, not just A row. The browser types "Smoke Test" into every
          // text field, so finding it proves this is the submission that was
          // just made and not a seeded leftover — which a count alone cannot
          // tell apart on a table that shipped with rows in it.
          const mine = rows.some((r) => Object.values(r || {}).some((v) => String(v).includes("Smoke Test")));
          ok("and it is the row that was just submitted, not a seeded one", mine,
            JSON.stringify(rows.slice(0, 2)).slice(0, 300));
          if (rows[0]) console.log("   owner reads row: " + JSON.stringify(rows[0]).slice(0, 220));
        }
      }

      // The form page as it stands after the submit, THEN home. Two shots
      // because the walk above may have left the browser on a sub-route, and a
      // file called "the published site" showing a booking form is the kind of
      // small lie that costs a round of confusion later.
      if (formRoute && formRoute !== "index") {
        await pg.screenshot({ path: "smoke-form.png", fullPage: true }).catch(() => {});
        await pg.goto(`${BASE}/s/${slug}/#/`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
        await pg.waitForTimeout(1200);
      }
      await pg.screenshot({ path: "smoke-site.png", fullPage: true });
      console.log(`   screenshot: smoke-site.png  (live at ${BASE}/s/${slug}/)`
        + (formRoute && formRoute !== "index" ? `, plus smoke-form.png (${asHash(formRoute)})` : ""));
      console.log("   api calls:", JSON.stringify(apiCalls));
    } catch (e) {
      failed++;
      console.log("  FAIL could not drive the published site in a browser -> " + String(e && e.message).slice(0, 300));
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  // --- credits were actually charged --------------------------------------
  const bal = await fetch(`${BASE}/api/credits`, { headers: { Authorization: `Bearer ${jwt}` } });
  const bd = await bal.json().catch(() => ({}));
  ok("caller was charged for the build", typeof bd.balance === "number" && bd.balance < 20, JSON.stringify(bd));

  // --- nothing is reachable without a session ------------------------------
  //
  // test/api-auth.test.mjs proves every handler CALLS authUser by reading the
  // source; this proves the deployed Worker actually refuses. GET only, so the
  // sweep cannot mutate anything even if a gate were missing — the routes that
  // answer POST are covered by the static test.
  const OPEN_BY_DESIGN = ["/api/stripe/webhook", "/api/m/"];
  const gettable = [
    "/api/credits", "/api/storage", "/api/gallery", "/api/fal-balance", "/api/video/poll",
    "/api/game/source", "/api/game/build-health", "/api/social/status", "/api/social/analytics",
    "/api/social/posts", "/api/social/comments", "/api/social/playlists", "/api/social/dm",
    "/api/social/autoreply",
  ];
  const leaked = [];
  for (const p of gettable) {
    if (OPEN_BY_DESIGN.some((o) => p.startsWith(o))) continue;
    const r = await fetch(`${BASE}${p}`);
    if (r.status < 400) leaked.push(`${p} -> ${r.status}`);
  }
  ok(`all ${gettable.length} GET routes refuse an unauthenticated caller`, leaked.length === 0, leaked.join(", "));

  // --- the delete route cannot be used to take down someone else's site ----
  // Checked BEFORE the real delete in cleanup, while the site is still up. If
  // either of these ever passed the wrong way the site would vanish here and
  // every later assertion would fail loudly, which is the right failure mode.
  const anonDel = await fetch(`${BASE}/api/site/${slug}`, { method: "DELETE" });
  ok("an unauthenticated delete is refused", anonDel.status === 401, String(anonDel.status));

  const ghostDel = await fetch(`${BASE}/api/site/definitely-not-a-real-site-${stamp}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${jwt}` },
  });
  ok("deleting a slug that isn't yours is 404, not a silent success",
    ghostDel.status === 404, String(ghostDel.status));
} catch (e) {
  failed++;
  console.log("\nUNCAUGHT: " + (e && (e.detail || e.message || e)));
} finally {
  console.log("\ncleaning up…");
  // Take the published site down through the route a real owner would use —
  // FIRST, while the JWT and the ownership row it authorises against still
  // exist. This is cleanup and coverage at once: before this route the R2
  // objects were simply left behind, so every run added a public, half-broken
  // site at a guessable URL.
  if (slug && jwt) {
    try {
      const del = await fetch(`${BASE}/api/site/${slug}`, { method: "DELETE", headers: { Authorization: `Bearer ${jwt}` } });
      const dd = await del.json().catch(() => ({}));
      ok("the owner can delete the site", del.status === 200 && dd.ok === true,
        del.status + " " + JSON.stringify(dd).slice(0, 200));
      if (dd.ok) console.log(`  removed the published site (${dd.removed} objects)`);

      const gone = await fetch(`${BASE}/s/${slug}/`);
      ok("the published files are actually gone", gone.status === 404, `GET /s/${slug}/ -> ${gone.status}`);
    } catch (e) {
      failed++;
      console.log("  FAIL could not delete the published site -> " + String(e && e.message));
    }
  }
  if (projectId && env.NEON_API_KEY) {
    try { await dropUserProject(env, projectId); console.log("  removed the Neon project"); }
    catch { console.log("  WARNING: could not remove Neon project " + projectId); }
  }
  // Belt and braces: the delete above already removes this row, but it must go
  // even when that call failed, or the slug stays claimed forever.
  if (slug) {
    try { await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE", headers: svc() }); } catch {}
  }
  if (userId) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/user_site_project?uid=eq.${userId}`, { method: "DELETE", headers: svc() });
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: svc() });
      console.log("  removed the throwaway user");
    } catch { console.log("  WARNING: could not remove user " + userId); }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
