// The confirmation email and scheduled jobs, end to end against the deployed
// Worker — and it spends NO model credits.
//
// WHY THIS EXISTS. `site-mail.mjs` and `site-jobs.mjs` have 41 unit tests
// between them and every one drives an injected fake. What none of them touches
// is the WIRING: `confirmSubmitter` hanging off the insert path in `worker.js`,
// and `persistSiteJobs` hanging off the build. Both were added on 2026-08-07 and
// `worker.js` cannot be imported, so the only way to exercise either is over
// HTTP against a real site. This repo's recurring failure is a feature that is
// correct at every layer and reachable at none, and both halves of this one were
// one HTTP call away from being exactly that.
//
// WHY IT IS FREE, which is what lets it exist while the Anthropic account is
// empty. The build route makes two model calls and both are CONDITIONAL:
//
//   if (!body.schema) { … designSiteSchema … }        ← an explicit schema skips it
//   if (brief && SITE_BUILD_CONTAINER && SITES_BUCKET) ← no brief skips page generation
//
// So `{schema, slug}` with no brief provisions a real Neon project and applies
// real DDL, policies and grants for zero spend. `cost === 0` is asserted, so if
// either call ever starts firing here the bill arrives as a failed check.
//
// THE CHECK THAT MATTERS MOST is the plainest one: a form submission still
// works. `confirmSubmitter` was added as a branch on the successful-POST path,
// so if it throws synchronously rather than settling into its reason-returning
// shape, EVERY form on EVERY published site breaks — and no unit test can see
// that, because the unit tests call the module directly and never go through the
// branch that calls it.
//
// It costs a throwaway Neon project and a Supabase user, both destroyed in the
// `finally`. Needs SUPABASE_SERVICE_KEY and NEON_API_KEY.
import { dropUserProject } from "../../site-db.mjs";

const BASE = process.env.SMOKE_BASE_URL || "https://gofarther.dev";
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

// THE SCHEMA IS SENT, NOT DESIGNED — the wiring is under test, not the model's
// judgement, and sending it is also what makes the run free.
//
// Two functions, deliberately differing in ONE field. `confirm_booking` is
// internal and `slot_note` is not, so every privilege assertion below has a
// same-database, same-role control: "anonymous cannot call it" is also what you
// get from a function that was never created or a typo in the privilege string,
// and the pair is what separates those from the flag doing its job.
const SCHEMA = {
  tables: [
    { name: "slots", access: "display", columns: [{ name: "label", type: "text" }] },
    {
      name: "bookings",
      access: "collect",
      columns: [
        { name: "who", type: "text" },
        { name: "email", type: "text" },
        { name: "slot", type: "text" },
      ],
      // The feature under test: the FUNCTION form, where model-written SQL
      // decides the whole message rather than filling three blanks.
      confirm: { fn: "confirm_booking" },
    },
  ],
  functions: [
    {
      name: "confirm_booking",
      args: [{ name: "row_id", type: "bigint" }],
      returns: "json", language: "sql", internal: true,
      body: `SELECT json_build_object('to', b.email, 'subject', 'Booking confirmed', 'body', 'Thanks ' || b.who) FROM bookings b WHERE b.id = row_id`,
    },
    {
      name: "slot_note",
      args: [{ name: "want", type: "text" }],
      returns: "text", language: "sql",
      body: "SELECT 'we have ' || want",
    },
  ],
  jobs: [
    // Registers: names an internal function, schedule above the 15-minute floor.
    { name: "reminders", fn: "confirm_booking", everyMinutes: 60 },
    // MUST NOT register: names a function that exists and is NOT internal. A job
    // is run by the platform on the owner's connection, so pointing one at a
    // publicly-callable function is the same hole `internal` exists to close.
    { name: "leaky", fn: "slot_note", everyMinutes: 60 },
    // MUST NOT register: names nothing at all.
    { name: "ghost", fn: "no_such_function", everyMinutes: 60 },
  ],
};
const SEED = { slots: [{ label: "09:00" }, { label: "09:30" }] };

const stamp = Date.now().toString(36);
const email = `confirm-smoke-${stamp}@gofarther.dev`;
const password = `Cs-${stamp}-${Math.random().toString(36).slice(2, 10)}`;
let userId = null, slug = null, jwt = null;

const data = (path, init) => fetch(`${BASE}/api/db/${slug}/data/${path}`, init);
const jsonPost = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

try {
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

  const runSlug = "csmoke-" + stamp + "-" + Math.random().toString(36).slice(2, 6);
  console.log("\nbuilding a site with a confirm table and jobs (no brief, no model)…", runSlug);
  const r = await fetch(`${BASE}/api/site/react-build`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({ slug: runSlug, schema: SCHEMA, seed: SEED, brand: "Confirm Smoke" }),
  });
  const d = await r.json().catch(() => ({}));
  ok("build returns 200", r.status === 200, r.status + " " + JSON.stringify(d).slice(0, 400));
  slug = d && d.slug;
  ok("the site has a backend", d && d.backend === true, JSON.stringify(d).slice(0, 200));
  // Keeps the run free: `cost` is `(designed ? SITE_BUILD_FEE : 0) + pages.cost`,
  // so anything non-zero means a model call fired on a path that skips both.
  ok("NO model credits were spent", d.cost === 0, "cost=" + JSON.stringify(d.cost));
  if (!slug) throw new Error("cannot continue without a site");

  // --- what the build kept -------------------------------------------------
  console.log("\nwhat the build kept…");
  const tbl = (d.schema || []).find((t) => t && t.name === "bookings");
  ok("the collect table is in the applied schema", !!tbl, JSON.stringify(d.schema || []).slice(0, 200));
  ok("and it kept its access level", !!(tbl && tbl.access === "collect"), JSON.stringify(tbl));

  // NOT ASSERTED HERE: that `confirm` survived the normaliser. The response's
  // `schema` is `levels` — `{name, access}` per table and nothing else — so the
  // declaration is genuinely not observable over HTTP, and an assertion against
  // `tbl.confirm` could never have passed. It is held by a unit test against
  // `normalizeSchema` instead, which is the layer the risk lives at (the
  // allow-list in `coerceTable` silently dropping a property, the way `teamScope`
  // was dead for months). Written down rather than deleted, because "there is no
  // check here" and "the check was forgotten" look identical later.

  // Functions ARE reported, deliberately — the response reads them off the array
  // explicitly so a site cannot declare one, have it fail, and report success.
  const fns = Array.isArray(d.functions) ? d.functions : [];
  ok("both declared functions were created",
    fns.length === SCHEMA.functions.length, JSON.stringify(d.functions));

  // --- a form still works, which is the whole point ------------------------
  console.log("\nsubmitting the form…");
  const first = await data("bookings", jsonPost({ who: "Ada", email: "ada@example.com", slot: "09:00" }));
  ok("a visitor may submit, with a confirm declared",
    first.status >= 200 && first.status < 300, first.status + " " + (await first.text().catch(() => "")).slice(0, 200));
  // TWICE, because the confirm path has a cooldown and a second submission is
  // the one that exercises it. A cooldown that throws instead of returning its
  // reason would break the second booking and not the first — the shape of bug
  // that reaches production looking like an intermittent form failure.
  const second = await data("bookings", jsonPost({ who: "Grace", email: "grace@example.com", slot: "09:30" }));
  ok("and again — the cooldown path does not break the write",
    second.status >= 200 && second.status < 300, second.status);
  // Same address as the first, the case the cooldown is actually for.
  const third = await data("bookings", jsonPost({ who: "Ada", email: "ada@example.com", slot: "10:00" }));
  ok("and a repeat address is still accepted", third.status >= 200 && third.status < 300, third.status);

  // --- the internal function is not a public RPC ---------------------------
  //
  // Proven on a directly-provisioned database by `neon e2e`; this proves it on a
  // site built through the real route, which is a different question — the DDL
  // could be right and the build could apply a stale path.
  console.log("\nwhat a visitor may call…");
  const pub = await data("rpc/slot_note", jsonPost({ want: "09:00" }));
  ok("an ordinary declared function IS callable", pub.status >= 200 && pub.status < 300,
    pub.status + " " + (await pub.text().catch(() => "")).slice(0, 160));
  const priv = await data("rpc/confirm_booking", jsonPost({ row_id: 1 }));
  ok("an internal function is NOT callable by a visitor",
    priv.status === 404 || priv.status === 401 || priv.status === 403,
    priv.status + " " + (await priv.text().catch(() => "")).slice(0, 160));

  // --- the jobs that should and should not have registered -----------------
  console.log("\nwhich jobs registered…");
  const jr = await fetch(
    `${SUPABASE_URL}/rest/v1/site_functions?slug=eq.${encodeURIComponent(slug)}&select=name,spec,schedule_minutes,enabled`,
    { headers: svc() });
  const jobs = await jr.json().catch(() => []);
  const names = (Array.isArray(jobs) ? jobs : []).map((j) => j.name).sort();
  ok("the valid job was registered", names.includes("reminders"), JSON.stringify(jobs).slice(0, 300));
  // The cross-reference, which is the whole safety of the feature: a job may only
  // name a function the schema declared AND marked internal.
  ok("a job naming a NON-internal function was dropped", !names.includes("leaky"), JSON.stringify(names));
  ok("a job naming a function that does not exist was dropped", !names.includes("ghost"), JSON.stringify(names));
  const reg = (Array.isArray(jobs) ? jobs : []).find((j) => j.name === "reminders");
  ok("and it carries the schedule and function it declared",
    !!(reg && reg.schedule_minutes === 60 && reg.spec && reg.spec.fn === "confirm_booking" && reg.enabled === true),
    JSON.stringify(reg));
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
    // A Neon project is a capped, billed resource whose only record is a Supabase
    // row that cascades with the user, so it is dropped here as well as by the
    // route and a failure is reported rather than swallowed.
    if (body && body.projectDropped === false && env.NEON_API_KEY) {
      try { await dropUserProject(env, body.projectId); } catch (e2) { console.log("  WARNING: Neon project left behind: " + ((e2 && e2.message) || e2)); }
    }
    // `site_functions` rows are keyed by owner and slug and cascade with the
    // user below, but the row is deleted explicitly too: a stale registered job
    // is drained by the live 2-minute cron, and one pointing at a database that
    // no longer exists is real work done on every tick forever.
    await fetch(`${SUPABASE_URL}/rest/v1/site_functions?slug=eq.${encodeURIComponent(slug)}`,
      { method: "DELETE", headers: svc() }).catch(() => {});
  }
  if (userId) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: svc() }).catch(() => {});
    console.log("  removed the throwaway isibi user");
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
