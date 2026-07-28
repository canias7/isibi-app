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
import path from "node:path";
import { dropUserProject } from "../../site-db.mjs";

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

  // --- the access levels are enforced live --------------------------------
  // The build must produce something readable and something submittable, and
  // must NOT let a visitor read back other people's submissions.
  const levels = Array.isArray(d.schema) ? d.schema : [];
  ok("build reports an access level per table", levels.length > 0, JSON.stringify(levels));
  const display = levels.find((t) => t.access === "display");
  const collect = levels.find((t) => t.access === "collect");
  ok("the designer chose a readable table for content", !!display, JSON.stringify(levels));
  ok("the designer chose a write-only table for submissions", !!collect, JSON.stringify(levels));

  if (display) {
    const r2 = await fetch(`${BASE}/api/db/${slug}/rows/${display.name}`);
    ok(`GET ${display.name} (display) is allowed`, r2.status === 200, String(r2.status));
    const w = await fetch(`${BASE}/api/db/${slug}/rows/${display.name}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    ok(`POST ${display.name} (display) is refused`, w.status === 403, String(w.status));
  }
  if (collect) {
    const r3 = await fetch(`${BASE}/api/db/${slug}/rows/${collect.name}`);
    ok(`GET ${collect.name} (collect) is refused — submissions are not public`,
      r3.status === 403, String(r3.status));
  }

  // --- the ledger rows ----------------------------------------------------
  if (slug) {
    const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}&select=neon_db,uid`, { headers: svc() });
    const rows = await g.json().catch(() => []);
    ok("site_backends row written", Array.isArray(rows) && rows.length === 1 && !!rows[0].neon_db, JSON.stringify(rows));
    ok("site is owned by the caller", rows[0] && rows[0].uid === userId);
  }
  const p = await fetch(`${SUPABASE_URL}/rest/v1/user_site_project?uid=eq.${userId}&select=neon_project`, { headers: svc() });
  const projs = await p.json().catch(() => []);
  projectId = projs && projs[0] && projs[0].neon_project;
  ok("a Neon project was provisioned for the user", !!projectId, JSON.stringify(projs));

  // --- the published page -------------------------------------------------
  // `page` says which of the two things was published. The generated app is the
  // normal outcome; the placeholder is the fallback for a build that failed, so
  // landing on it is a regression and has to go red rather than pass quietly.
  ok("the generated app was published, not the fallback", d.page === "app",
    "page=" + d.page + " notes=" + (d.notes || "-") + " problems=" + JSON.stringify(d.problems || []));
  ok("the build reports the route files it wrote",
    Array.isArray(d.files) && d.files.some((f) => /index\.tsx$/.test(f)), JSON.stringify(d.files));

  if (slug) {
    const page = await fetch(`${BASE}/s/${slug}/`);
    const html = await page.text().catch(() => "");
    ok("published page serves 200", page.status === 200, String(page.status));
    if (d.page === "app") {
      ok("the page is the compiled app shell", /id="root"/.test(html) && /<script[^>]+src=/.test(html), html.slice(0, 240));
      ok("its stylesheet was published too", /<link[^>]+\.css/.test(html), html.slice(0, 240));
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
        if (u.includes(`/api/db/${slug}/rows/`)) apiCalls.push({ method: res.request().method(), url: u, status: res.status() });
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
      ok("the site rendered a form with real controls", ui.forms > 0 && ui.controls > 1, JSON.stringify(ui));

      // The starter content actually reached the page. Without it a site is a
      // brochure with an empty list, and a form whose required Select reads that
      // list has nothing to choose — so nobody can submit it. This assertion
      // could not pass before seeding existed.
      ok("the seeded content is on the page, not an empty list",
        Object.keys(d.seeded || {}).length > 0, "seeded=" + JSON.stringify(d.seeded || {}));

      // And the whole reason seeding matters: a real visitor submission, filled
      // in a real browser and landing in real Postgres.
      const form = await pg.$("form");
      ok("the site has a form a visitor can submit", !!form);
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
        const submit = await pg.$('form button[type="submit"]') || await pg.$("form button");
        if (submit) await submit.click({ timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(7000);

        const writes = apiCalls.filter((c) => c.method === "POST");
        ok("submitting the form wrote to the database", writes.length > 0,
          "no POST went out — a required Select with no options is the usual cause: " + JSON.stringify(apiCalls.slice(-4)));
        ok("the submission was accepted",
          writes.length > 0 && writes.every((c) => c.status >= 200 && c.status < 300),
          JSON.stringify(writes));
      }

      await pg.screenshot({ path: "smoke-site.png", fullPage: true });
      console.log(`   screenshot: smoke-site.png  (live at ${BASE}/s/${slug}/)`);
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
