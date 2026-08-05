// The visitor-account layer, end to end, against the deployed Worker — and it
// spends NO model credits.
//
// WHY THIS EXISTS. `auth-smoke.mjs` — 1,314 lines, ~155 checks — was deleted on
// 2026-07-30 with the hand-built auth layer, and the Neon Auth replacement never
// got one. So signup, login, logout, reset and THREE OF THE FIVE ACCESS LEVELS
// (`user`, `feed`, `admin`) had no live coverage at all. On 2026-08-04 that gap
// produced exactly what an untested layer produces: `admin` was described
// everywhere as writable and is granted SELECT and nothing else, and nobody knew.
//
// WHY IT IS FREE, which is the whole reason it can exist at this size. The build
// route makes two model calls and both are CONDITIONAL:
//
//   if (!body.schema) { … designSiteSchema … }        ← an explicit schema skips it
//   if (brief && SITE_BUILD_CONTAINER && SITES_BUCKET) ← no brief skips page generation
//
// So `{schema, slug}` with no brief provisions a real Neon project, applies real
// RLS policies and grants, enables Neon Auth and publishes a placeholder — for
// zero Anthropic spend. The test asserts `cost === 0`, so if either call ever
// starts firing on this path the bill shows up as a failed check rather than as
// a surprise.
//
// It still costs a throwaway Neon project and a Supabase user, both destroyed in
// the `finally`.
//
// Needs SUPABASE_SERVICE_KEY and NEON_API_KEY. Run from CI, or locally with them
// in the environment.
import { dropUserProject } from "../../site-db.mjs";

const BASE = process.env.SMOKE_BASE_URL || "https://isibi.ai";
const SUPABASE_URL = "https://ujrqdmmtcptvimazlhom.supabase.co";
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

// THE SCHEMA IS SENT, NOT DESIGNED. The auth layer is under test, not the model's
// judgement about tables — and sending it is also what makes the run free. One
// table per access level, so every level is exercised by something.
const SCHEMA = {
  tables: [
    { name: "services", access: "display", columns: [{ name: "title", type: "text" }, { name: "price", type: "integer" }] },
    { name: "enquiries", access: "collect", columns: [{ name: "who", type: "text" }, { name: "body", type: "text" }] },
    { name: "notes", access: "user", columns: [{ name: "body", type: "text" }] },
    { name: "posts", access: "feed", columns: [{ name: "body", type: "text" }] },
    { name: "notices", access: "admin", columns: [{ name: "body", type: "text" }] },
  ],
};
// `seed` goes at the TOP LEVEL of the build body, not inside `schema`: the route
// reads `(designed && designed.seed) || body.seed`, and `designed` is null
// whenever a schema is sent explicitly. Nested, it is silently ignored.
const SEED = { services: [{ title: "Cut", price: 20 }, { title: "Shave", price: 15 }] };

const stamp = Date.now().toString(36);
const email = `member-smoke-${stamp}@isibi.ai`;
const password = `Ms-${stamp}-${Math.random().toString(36).slice(2, 10)}`;
let userId = null, slug = null, jwt = null;

/** The site's own auth endpoints, exactly as `@/lib/rows` calls them. */
const auth = (action, init) => fetch(`${BASE}/api/db/${slug}/auth/${action}`, init);
/** The site's Data API, through the same proxy a published page uses. */
const data = (path, init) => fetch(`${BASE}/api/db/${slug}/data/${path}`, init);
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const jsonPost = (body, t) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...(t ? bearer(t) : {}) },
  body: JSON.stringify(body),
});

/** Better Auth answers a session token as `token` or `session.token`. */
const tokenOf = (d) => {
  const t = d && (d.token ?? (d.session && d.session.token));
  return typeof t === "string" && t ? t : null;
};

try {
  // --- a throwaway isibi user -----------------------------------------------
  const mk = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST", headers: svc(),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const made = await mk.json().catch(() => ({}));
  userId = made && made.id;
  ok("created a throwaway isibi user", !!userId, JSON.stringify(made));
  if (!userId) throw new Error("cannot continue without a user");

  const si = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  jwt = (await si.json().catch(() => ({}))).access_token;
  ok("signed in to isibi", !!jwt);
  if (!jwt) throw new Error("cannot continue without a token");

  // --- a real site, with NO model call --------------------------------------
  const runSlug = "msmoke-" + stamp + "-" + Math.random().toString(36).slice(2, 6);
  console.log("\nbuilding a site with an explicit schema (no brief, no model)…", runSlug);
  const r = await fetch(`${BASE}/api/site/react-build`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({ slug: runSlug, schema: SCHEMA, seed: SEED, brand: "Member Smoke" }),
  });
  const d = await r.json().catch(() => ({}));
  ok("build returns 200", r.status === 200, r.status + " " + JSON.stringify(d).slice(0, 300));
  slug = d && d.slug;
  ok("the site has a backend", d && d.backend === true, JSON.stringify(d).slice(0, 200));
  ok("every table was created", Array.isArray(d.tables) && d.tables.length === SCHEMA.tables.length,
    JSON.stringify(d.tables));
  // THE CHECK THAT KEEPS THIS FREE. `cost` is
  // `(designed ? SITE_BUILD_FEE : 0) + pages.cost`, so a non-zero number here
  // means one of the two model calls fired on a path that is supposed to skip
  // both — a bill, showing up as a failed check rather than a surprise.
  ok("NO model credits were spent", d.cost === 0, "cost=" + JSON.stringify(d.cost));
  ok("and nothing was generated", !d.pagesUsage && !d.schemaUsage,
    JSON.stringify({ pagesUsage: d.pagesUsage, schemaUsage: d.schemaUsage }));
  if (!slug) throw new Error("cannot continue without a site");

  // --- the levels that need no account --------------------------------------
  console.log("\nwhat a signed-out visitor may do…");
  const pub = await data("services?select=*");
  ok("a display table is readable by anyone", pub.status === 200, pub.status);
  const seeded = await pub.json().catch(() => []);
  ok("and it carries its seeded rows", Array.isArray(seeded) && seeded.length === 2, JSON.stringify(seeded).slice(0, 200));

  const collectRead = await data("enquiries?select=*");
  ok("a collect table is NOT readable", collectRead.status === 403 || collectRead.status === 401, collectRead.status);
  const collectWrite = await data("enquiries", jsonPost({ who: "Ada", body: "hello" }));
  ok("but anyone may submit to it", collectWrite.status >= 200 && collectWrite.status < 300, collectWrite.status);

  for (const t of ["notes", "posts", "notices"]) {
    const res = await data(`${t}?select=*`);
    ok(`a signed-out visitor cannot read "${t}"`, res.status === 401 || res.status === 403 || (await res.json().catch(() => [])).length === 0, res.status);
  }

  // --- signing up ------------------------------------------------------------
  console.log("\nsigning up and signing in…");
  const m1 = { email: `ada-${stamp}@example.com`, password: "correct-horse-battery", name: "Ada" };
  const su = await auth("sign-up/email", jsonPost(m1));
  const suBody = await su.json().catch(() => null);
  ok("signup succeeds", su.status >= 200 && su.status < 300, su.status + " " + JSON.stringify(suBody).slice(0, 200));
  const tokA = tokenOf(suBody);
  ok("signup hands back a session token", !!tokA, JSON.stringify(suBody).slice(0, 200));

  // THE SEAM NOTHING HAS EVER PROVEN. CLAUDE.md's own open item: "confirming the
  // bearer token the client stores is the same session.token the resolver looks
  // up — the one seam only a real sign-in proves." `tokenOf` here is a copy of
  // the client's, so this asserts the exact value a generated page would store.
  const me = await auth("get-session", { headers: bearer(tokA) });
  const meBody = await me.json().catch(() => null);
  ok("the token the CLIENT would store opens a session", me.status === 200 && !!(meBody && meBody.user),
    me.status + " " + JSON.stringify(meBody).slice(0, 200));
  ok("and the session names the member who signed up",
    !!(meBody && meBody.user && meBody.user.email === m1.email), JSON.stringify(meBody && meBody.user).slice(0, 200));

  const li = await auth("sign-in/email", jsonPost({ email: m1.email, password: m1.password }));
  const tokA2 = tokenOf(await li.json().catch(() => null));
  ok("signing in again works", li.status >= 200 && li.status < 300 && !!tokA2, li.status);

  const bad = await auth("sign-in/email", jsonPost({ email: m1.email, password: "wrong-password" }));
  ok("a wrong password is refused", bad.status >= 400, bad.status);
  const ghost = await auth("sign-in/email", jsonPost({ email: `nobody-${stamp}@example.com`, password: "whatever-123" }));
  ok("and so is an address with no account", ghost.status >= 400, ghost.status);

  // --- a member's own rows ---------------------------------------------------
  console.log("\nwhat a member may see…");
  const mine = await data("notes", jsonPost({ body: "ada's private note" }, tokA));
  ok("a member may write to a user table", mine.status >= 200 && mine.status < 300, mine.status);
  const mineRead = await data("notes?select=*", { headers: bearer(tokA) });
  const mineRows = await mineRead.json().catch(() => []);
  ok("and read it back", mineRead.status === 200 && Array.isArray(mineRows) && mineRows.length === 1,
    mineRead.status + " " + JSON.stringify(mineRows).slice(0, 200));

  // A SECOND MEMBER IS THE WHOLE POINT. Every naive "own rows" implementation
  // looks correct with one account in the database.
  const m2 = { email: `bob-${stamp}@example.com`, password: "another-good-passphrase", name: "Bob" };
  const su2 = await auth("sign-up/email", jsonPost(m2));
  const tokB = tokenOf(await su2.json().catch(() => null));
  ok("a second member can sign up", !!tokB, su2.status);

  if (tokB) {
    const bobSees = await data("notes?select=*", { headers: bearer(tokB) });
    const bobRows = await bobSees.json().catch(() => []);
    ok("a member does NOT see another member's private rows",
      bobSees.status === 200 && Array.isArray(bobRows) && bobRows.length === 0,
      bobSees.status + " " + JSON.stringify(bobRows).slice(0, 200));

    // `feed` is the opposite level and must behave the opposite way, or "own
    // rows" has simply been applied everywhere.
    await data("posts", jsonPost({ body: "ada's public post" }, tokA));
    const bobFeed = await data("posts?select=*", { headers: bearer(tokB) });
    const feedRows = await bobFeed.json().catch(() => []);
    ok("but a feed row IS visible to every signed-in member",
      bobFeed.status === 200 && Array.isArray(feedRows) && feedRows.length >= 1,
      bobFeed.status + " " + JSON.stringify(feedRows).slice(0, 200));
  }

  // --- admin is READ-ONLY, which is what 2026-08-04 got wrong ---------------
  console.log("\nadmin…");
  const adminRead = await data("notices?select=*", { headers: bearer(tokA) });
  ok("a signed-in member may READ an admin table", adminRead.status === 200, adminRead.status);
  const adminWrite = await data("notices", jsonPost({ body: "should not land" }, tokA));
  ok("and may NOT write to it — it is granted SELECT and nothing else",
    adminWrite.status === 401 || adminWrite.status === 403, adminWrite.status);

  // --- signing out -----------------------------------------------------------
  console.log("\nsigning out…");
  // The same shape the client sends — a bare POST answers 415, which is what the
  // first run found and what `useLogout` was doing on every generated site.
  const out = await auth("sign-out", jsonPost({}, tokA));
  ok("sign-out is accepted", out.status >= 200 && out.status < 400, out.status);
  const after = await auth("get-session", { headers: bearer(tokA) });
  ok("and the token stops working", after.status === 401 || !(await after.json().catch(() => null))?.user, after.status);

  // Always 200, whether or not the address is a member — saying which would
  // confirm who has an account here.
  const rs1 = await auth("forget-password", jsonPost({ email: m1.email }));
  const rs2 = await auth("forget-password", jsonPost({ email: `nobody-${stamp}@example.com` }));
  ok("a reset request answers the same for a member and a stranger",
    rs1.status === rs2.status, `${rs1.status} vs ${rs2.status}`);

} catch (e) {
  failed++;
  console.log("\nUNCAUGHT: " + ((e && (e.stack || e.message)) || e));
} finally {
  console.log("\ncleaning up…");
  if (slug && jwt) {
    const del = await fetch(`${BASE}/api/site/${slug}`, { method: "DELETE", headers: { Authorization: `Bearer ${jwt}` } })
      .catch(() => null);
    const body = del ? await del.json().catch(() => ({})) : {};
    ok("the owner can delete the site", !!del && del.status === 200, JSON.stringify(body).slice(0, 200));
    // A Neon project is a capped, billed resource whose only record is a
    // Supabase row that cascades with the user — so it is dropped here as well
    // as by the route, and a failure is reported rather than swallowed.
    if (body && body.projectDropped === false && env.NEON_API_KEY) {
      try { await dropUserProject(env, body.projectId); } catch (e2) { console.log("  WARNING: Neon project left behind: " + ((e2 && e2.message) || e2)); }
    }
  }
  if (userId) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: svc() }).catch(() => {});
    console.log("  removed the throwaway isibi user");
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
