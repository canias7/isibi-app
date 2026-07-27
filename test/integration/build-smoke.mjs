// Production smoke test for the builder's send path.
//
// The e2e test proves the database layer; this proves the ROUTE — auth, the
// credit charge, the Sonnet schema design, provisioning, and the published
// page — by driving the deployed Worker over HTTP exactly as the browser does.
//
// It creates its own throwaway user, runs one real build, then removes the
// user, its Neon project and its published files. Costs one Sonnet call.
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
let userId = null, slug = null, projectId = null;

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
  const jwt = sess && sess.access_token;
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
  if (slug) {
    const page = await fetch(`${BASE}/s/${slug}/`);
    const html = await page.text().catch(() => "");
    ok("published page serves 200", page.status === 200, String(page.status));
    ok("page names a table it created", Array.isArray(d.tables) && d.tables.some((t) => html.includes(t)), html.slice(0, 160));
  }

  // --- credits were actually charged --------------------------------------
  const bal = await fetch(`${BASE}/api/credits`, { headers: { Authorization: `Bearer ${jwt}` } });
  const bd = await bal.json().catch(() => ({}));
  ok("caller was charged for the build", typeof bd.balance === "number" && bd.balance < 20, JSON.stringify(bd));
} catch (e) {
  failed++;
  console.log("\nUNCAUGHT: " + (e && (e.detail || e.message || e)));
} finally {
  console.log("\ncleaning up…");
  if (projectId && env.NEON_API_KEY) {
    try { await dropUserProject(env, projectId); console.log("  removed the Neon project"); }
    catch { console.log("  WARNING: could not remove Neon project " + projectId); }
  }
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
  console.log("  NOTE: R2 objects under sites/" + slug + "/ are left behind (no delete route).");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
