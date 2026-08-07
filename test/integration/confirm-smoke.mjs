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
      // …and outward. Declared for `created` only, so the list form is exercised
      // rather than the `true` shortcut.
      webhooks: ["created"],
    },
    // THE RECEIVER, and it is this site's own Data API through our own proxy.
    //
    // A webhook is the one feature that dials OUT, so proving it needs somewhere
    // real for the delivery to land. A public request-bin would put a
    // customer's name and address on a third party's server on every CI run and
    // make the check depend on somebody else's uptime; our own proxy is public
    // HTTPS, passes the same SSRF guard as any other destination, and turns the
    // delivery into a ROW that can be read back through the owner's door.
    //
    // Its columns are exactly the payload's keys, because PostgREST refuses an
    // insert naming a column that does not exist — so this table doubles as an
    // assertion about the payload's SHAPE. If `shapePayload` ever renames a
    // field, the delivery 400s and the row never arrives.
    //
    // It declares NO webhooks of its own, which is what stops the obvious
    // disaster: a receiver that itself emits is an infinite loop, and the
    // assertion below proves the `firesFor` gate is what prevents it.
    {
      name: "hook_log",
      access: "collect",
      columns: [
        { name: "site", type: "text" },
        { name: "table", type: "text" },
        { name: "action", type: "text" },
        { name: "at", type: "text" },
        { name: "data", type: "json" },
      ],
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

  // --- the outbound webhook, actually delivered ----------------------------
  //
  // The three bookings above were submitted with NO WEBHOOK_URL configured, so
  // they already proved the quiet half live: a table can declare `webhooks` and
  // a site with no destination simply writes the row. That is the state of every
  // site that never wanted this.
  console.log("\nthe outbound webhook…");

  // THE RECEIVER IS NOT OUR OWN DOMAIN, and that is the whole shape of this
  // section. An earlier version pointed the destination at this site's own Data
  // API through our own proxy, so a delivery could be read back as a ROW — which
  // is a lovely assertion and cannot work: a Worker fetching its own zone is a
  // self-referential subrequest and Cloudflare answers 522. Measured, twice.
  //
  // So the delivery is proved from the WORKER'S OWN RECORD instead of from the
  // receiver's rows. That record already exists for the site owner, who has the
  // same problem — their integration goes quiet and nothing says why — and it
  // carries everything worth asserting: whether the vault was read, which
  // destination was chosen, whether the guard admitted it, and what the far end
  // answered.
  //
  // The payload SHAPE is proved separately, by posting it to a real PostgREST by
  // hand. Between them the two cover what one receiver never could, and neither
  // depends on a third party staying up.
  const hookLog = `${BASE}/api/db/${slug}/data/hook_log`;
  const setSecret = async (name, value) => fetch(`${BASE}/api/site/${slug}/secrets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({ name, value }),
  });

  // The Worker's own account of the last attempt, which is also what the owner
  // reads. Polled for one NEWER than the previous, because the record is
  // overwritten and a stale one reads exactly like a fresh failure.
  const note = async () => {
    const r = await fetch(`${BASE}/api/site/${slug}/secrets`, { headers: { Authorization: `Bearer ${jwt}` } });
    const j = await r.json().catch(() => ({}));
    return j && j.webhook ? j.webhook : null;
  };
  const noteAfter = async (since, table = "bookings") => {
    let n = null;
    for (let i = 0; i < 18 && !(n && (n.at || "") > since); i++) {
      await new Promise((r) => setTimeout(r, 1500));
      await data(table, jsonPost({ who: "Probe" + i, email: "probe@example.com", slot: "1" + i + ":00" }));
      n = await note();
    }
    return n;
  };

  // ── the payload shape, against a real PostgREST ──────────────────────────
  //
  // The receiving table's columns are exactly the payload's keys, so PostgREST
  // refusing an unknown column makes this an assertion about the SHAPE: rename a
  // field in shapePayload and this stops being a 201.
  const probeBody = {
    site: slug, table: "bookings", action: "created",
    at: new Date().toISOString(), data: { id: 1, who: "Probe" },
  };
  const probe = await fetch(hookLog, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(probeBody),
  });
  ok("the payload shape is one a real PostgREST accepts",
    probe.status >= 200 && probe.status < 300,
    probe.status + " " + (await probe.text().catch(() => "")).slice(0, 200));

  // ── a destination outside our network ────────────────────────────────────
  //
  // example.com is IANA's reserved domain: stable, foreign, and it answers. The
  // BODY does not matter — it is discarded, and only synthetic data reaches it.
  // What matters is a genuine HTTP status coming back from outside, which is the
  // one thing our own zone made impossible to observe.
  const s1 = await setSecret("WEBHOOK_URL", "https://example.com/hook");
  ok("the owner can store a destination", s1.status >= 200 && s1.status < 300, s1.status);
  const before = (await note() || {}).at || "";
  const ext = await noteAfter(before);
  console.log("   external destination:", JSON.stringify(ext));
  ok("the Worker recorded the attempt", !!ext, "nothing recorded — the emit never ran");
  ok("it names the table and action",
    !!(ext && ext.table === "bookings" && ext.action === "created"), JSON.stringify(ext));
  ok("the call LEFT our network and a real host answered",
    !!(ext && ext.status > 0 && ext.status !== 522),
    JSON.stringify(ext) + " — 522 is a self-referential subrequest, 0 is no response at all");

  // ── the guard refuses a bad destination, checked at FIRE time ────────────
  //
  // Repointed at the cloud metadata endpoint, the address this guard exists for.
  // Storing it SUCCEEDS on purpose: an owner may paste anything, a value refused
  // at rest leaves them no record to find, and one refused at delivery is checked
  // against wherever the name resolves today — which is the whole of DNS
  // rebinding.
  const s2 = await setSecret("WEBHOOK_URL", "https://169.254.169.254/latest/meta-data/");
  ok("a bad destination can still be stored", s2.status >= 200 && s2.status < 300, s2.status);
  const blockedAt = (ext && ext.at) || "";
  const refused = await noteAfter(blockedAt);
  console.log("   blocked destination:", JSON.stringify(refused));
  ok("and the guard refuses it at fire time, by name",
    !!(refused && /destination refused/.test(refused.reason || "")), JSON.stringify(refused));
  ok("without ever making the call", !!(refused && !refused.status), JSON.stringify(refused));

  // The booking is unaffected either way — a webhook is background work and the
  // customer has already been served.
  const stillOk = await data("bookings", jsonPost({ who: "Jo", email: "jo@example.com", slot: "23:30" }));
  ok("a booking whose webhook is refused still succeeds",
    stillOk.status >= 200 && stillOk.status < 300, stillOk.status);

  // --- the jobs that should and should not have registered -----------------
  console.log("\nwhich jobs registered…");
  const jr = await fetch(
    `${SUPABASE_URL}/rest/v1/site_functions?slug=eq.${encodeURIComponent(slug)}&select=name,spec,schedule_minutes,enabled`,
    { headers: svc() });
  const jobs = await jr.json().catch(() => []);
  const names = (Array.isArray(jobs) ? jobs : []).map((j) => j.name).sort();
  const registered = names.includes("reminders");
  ok("the valid job was registered", registered, JSON.stringify(jobs).slice(0, 300));

  // The cross-reference is the whole safety of the feature — a job may only name
  // a function the schema declared AND marked internal — but the negative checks
  // are ANCHORED on a job having registered at all, because `!includes()` is
  // trivially true against an empty list.
  //
  // That is not hypothetical: on this file's FIRST run both of these reported ok
  // while `site_functions` was completely empty, and the only reason the run
  // failed was the positive check beside them. Same shape as the webhook
  // ordering assertions, where `indexOf(a) < indexOf(b)` passed vacuously once
  // `a` was deleted — a negative assertion needs proof its subject exists.
  ok("a job naming a NON-internal function was dropped",
    registered && !names.includes("leaky"), JSON.stringify(names));
  ok("a job naming a function that does not exist was dropped",
    registered && !names.includes("ghost"), JSON.stringify(names));
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
