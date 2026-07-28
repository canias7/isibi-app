// Remove an ORPHANED published site — R2 objects at sites/<slug>/ whose
// site_backends row no longer exists.
//
// Why this needs to exist at all: DELETE /api/site/<slug> authorises against the
// site_backends row, so a prefix with no row is refused with 404. That refusal is
// deliberate and tested — without it anyone signed in could delete files by
// guessing slugs — but it also means an orphan cannot be cleaned through the
// normal route, because the thing that proves ownership is exactly what is
// missing.
//
// So this is an OPERATOR tool, not an app feature. Using the service key it
// re-attaches the orphan to a throwaway account, deletes it through the same
// route a real owner would use, and removes the account again. Deliberately not
// a second deletion code path: the route is the tested one, and a sweeper with
// its own R2 logic would be the untested one that quietly diverges.
//
// It cannot discover orphans on its own — that would need to list the bucket,
// which only the Worker can do — so the slug is named explicitly.
//
//   SUPABASE_SERVICE_KEY=… node .github/scripts/sweep-orphan-site.mjs <slug>
import { dbNameForSite } from "../../site-db.mjs";

const BASE = process.env.SWEEP_BASE_URL || "https://isibi.ai";
// Overridable for the same reason BASE is: it lets the whole flow — including
// the refuse-a-live-site guard, which must never be exercised for the first time
// against real data — run against a stub. See test/sweep-orphan.test.mjs.
const SUPABASE_URL = process.env.SWEEP_SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const SVC = process.env.SUPABASE_SERVICE_KEY || "";

const slug = String(process.argv[2] || process.env.SWEEP_SLUG || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
if (!SVC) { console.error("SUPABASE_SERVICE_KEY is required"); process.exit(1); }
if (!slug) { console.error("usage: node .github/scripts/sweep-orphan-site.mjs <slug>"); process.exit(1); }

const svc = (extra) => ({ apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json", ...(extra || {}) });

let userId = null, failed = 0;
const step = (name, cond, extra) => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond || !extra ? "" : "  -> " + String(extra).slice(0, 300)}`);
  if (!cond) failed++;
};

try {
  // Is it actually orphaned? A slug with a live row belongs to someone, and this
  // tool must never be the way a real user's site gets taken down.
  const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}&select=uid`, { headers: svc() });
  const owned = await g.json().catch(() => []);
  if (Array.isArray(owned) && owned.length) {
    console.error(`refusing: sites/${slug}/ is owned by ${owned[0].uid} — it is a live site, not an orphan.`);
    console.error("Its owner can delete it with DELETE /api/site/" + slug + ".");
    process.exit(1);
  }

  const before = await fetch(`${BASE}/s/${slug}/`);
  if (before.status === 404) {
    console.log(`nothing to do — /s/${slug}/ already returns 404`);
    process.exit(0);
  }
  console.log(`/s/${slug}/ currently returns ${before.status} — sweeping…`);

  const stamp = Date.now().toString(36);
  const email = `sweep-${stamp}@isibi.ai`;
  const password = `Sw33p-${stamp}-${Math.random().toString(36).slice(2, 10)}`;

  const mk = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST", headers: svc(), body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const made = await mk.json().catch(() => ({}));
  userId = made && made.id;
  step("created a throwaway account to own the orphan", !!userId, JSON.stringify(made));
  if (!userId) throw new Error("cannot continue without an account");

  const si = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const sess = await si.json().catch(() => ({}));
  const jwt = sess && sess.access_token;
  step("signed in", !!jwt, JSON.stringify(sess).slice(0, 200));
  if (!jwt) throw new Error("cannot continue without a token");

  // Claim the orphan. neon_db is the conventional name for the slug; no such
  // database exists, and the route skips the drop anyway because this account
  // has no Neon project.
  const claim = await fetch(`${SUPABASE_URL}/rest/v1/site_backends`, {
    method: "POST", headers: svc({ Prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({ slug, uid: userId, neon_db: dbNameForSite(slug) }),
  });
  step("claimed the orphan for that account", claim.ok, claim.status + " " + (await claim.text().catch(() => "")).slice(0, 200));

  const del = await fetch(`${BASE}/api/site/${slug}`, { method: "DELETE", headers: { Authorization: `Bearer ${jwt}` } });
  const dd = await del.json().catch(() => ({}));
  step("deleted it through the owner route", del.status === 200 && dd.ok === true, del.status + " " + JSON.stringify(dd).slice(0, 200));
  if (dd && dd.ok) console.log(`  removed ${dd.removed} object(s)`);

  const after = await fetch(`${BASE}/s/${slug}/`);
  step("the published files are gone", after.status === 404, `GET /s/${slug}/ -> ${after.status}`);
} catch (e) {
  failed++;
  console.log("UNCAUGHT: " + (e && (e.detail || e.message || e)));
} finally {
  // The row is deleted by the route; remove it anyway in case that call failed,
  // or the slug would stay claimed by an account that is about to not exist.
  try { await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE", headers: svc() }); } catch {}
  if (userId) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: svc() });
      console.log("  removed the throwaway account");
    } catch { console.log("  WARNING: could not remove account " + userId); }
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nswept clean");
process.exit(failed ? 1 : 0);
