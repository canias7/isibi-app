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
import { dropUserProject } from "../../site-db.mjs";

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
  console.log("posting a real build…");
  const r = await fetch(`${BASE}/api/site/react-build`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({ brief }),
  });
  const d = await r.json().catch(() => ({}));
  ok("build returns 200", r.status === 200, r.status + " " + JSON.stringify(d).slice(0, 300));
  slug = d && d.slug;
  ok("response carries a slug and url", !!(slug && d.url), JSON.stringify(d).slice(0, 200));
  ok("response says the site has a backend", d && d.backend === true);
  ok("at least one table was created", Array.isArray(d.tables) && d.tables.length > 0, JSON.stringify(d.tables));
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

  // --- credits were actually charged --------------------------------------
  const bal = await fetch(`${BASE}/api/credits`, { headers: { Authorization: `Bearer ${jwt}` } });
  const bd = await bal.json().catch(() => ({}));
  ok("caller was charged for the build", typeof bd.balance === "number" && bd.balance < 20, JSON.stringify(bd));

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
