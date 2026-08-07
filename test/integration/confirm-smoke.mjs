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
// The signer, imported rather than rewritten. Unlike `site-otp.mjs` — where the
// test writes its own authenticator, because importing the implementation under
// test proves only that it agrees with itself — HMAC-SHA256 is a published
// standard with one right answer, and the thing under test here is the ROUTE.
import { hmacHex } from "../../site-inbound.mjs";

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
    // Where an INBOUND delivery lands. `collect`, so nothing public can read
    // it back — the assertions go through the owner's door, which is the same
    // path a real owner would use to see what a supplier sent.
    {
      name: "stock",
      access: "collect",
      columns: [
        { name: "sku", type: "text" },
        { name: "qty", type: "int" },
        { name: "event_id", type: "text" },
      ],
      // IDEMPOTENCY, which is the whole difference between a retried delivery
      // and a duplicate order. Every webhook sender retries; the schema is
      // where that is expressed, and the function below leans on it.
      unique: ["event_id"],
    },
  ],
  // THIRD-PARTY READS. Two declarations, differing in one thing: whether the
  // request needs a secret. That pair is what separates "the call went out" from
  // "the placeholder was resolved out of the vault" — a single declaration can
  // only ever show one of them.
  //
  // Pointed at CLOUDFLARE'S OWN trace endpoint, and the choice matters: it is
  // always up, needs no key, has no rate limit, and is EXTERNAL. Our own zone
  // answers 522 to a Worker subrequest, which is the reason the outbound webhook
  // test also has to leave the network to observe a real status.
  apis: [
    {
      name: "pub",
      // The parameter is in the PATH, so a different value is a different
      // STATUS — which is observable from outside where an echoed query string
      // would need a service that echoes. `trace` is 200 and anything else 404.
      url: "https://www.cloudflare.com/cdn-cgi/{{param.p}}",
      params: ["p"],
      cacheSeconds: 0,
    },
    {
      name: "keyed",
      url: "https://www.cloudflare.com/cdn-cgi/trace",
      headers: { "X-Smoke": "Bearer {{SMOKE_API_KEY}}" },
      cacheSeconds: 0,
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
    // THE INBOUND HANDLER. Named `hook_*`, internal, one jsonb argument — the
    // four properties `functionFor` demands, all of which have to hold together
    // for the route to reach it at all.
    //
    // `ON CONFLICT DO NOTHING` against the unique `event_id` is what makes a
    // retried delivery harmless, and it is model-written SQL rather than
    // anything the platform provides. That is the point of the design: the
    // platform owns the endpoint and the secret, the site owns the meaning.
    {
      name: "hook_stock",
      args: [{ name: "payload", type: "jsonb" }],
      returns: "json", language: "sql", internal: true,
      body: `WITH ins AS (
        INSERT INTO stock (sku, qty, event_id)
        VALUES (payload->>'sku', (payload->>'qty')::int, payload->>'event_id')
        ON CONFLICT (event_id) DO NOTHING
        RETURNING id
      ) SELECT json_build_object('stored', (SELECT count(*) FROM ins))`,
    },
    // Internal, one jsonb argument — and NOT named `hook_`, so the route must
    // refuse it even to a caller holding the shared secret. This is the
    // enumeration boundary in the same shape as `confirm_booking`.
    {
      name: "private_peek",
      args: [{ name: "payload", type: "jsonb" }],
      returns: "json", language: "sql", internal: true,
      body: "SELECT json_build_object('leaked', (SELECT count(*) FROM bookings))",
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

  // --- INBOUND: somebody else's system pushing data in ---------------------
  //
  // The mirror of everything above. Proved live, and free: no model call, no
  // third party, and the delivery lands as a real row in the site's own
  // Postgres which is read back through the owner's door.
  console.log("\ninbound webhooks…");
  const HOOK_SECRET = "whsec_" + stamp + "_" + Math.random().toString(36).slice(2, 12);
  const hookUrl = (n) => `${BASE}/api/db/${slug}/hook/${n}`;
  const deliver = (n, headers, body) => fetch(hookUrl(n), {
    method: "POST", headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  // Through the OWNER's door: `stock` is `collect`, so nothing public reads it.
  const stockRows = async () => {
    const r = await fetch(`${BASE}/api/site/${slug}/rows/stock`, { headers: { Authorization: `Bearer ${jwt}` } });
    const j = await r.json().catch(() => ({}));
    return Array.isArray(j.rows) ? j.rows : [];
  };

  // FAILS CLOSED BEFORE THE SECRET EXISTS, which is the opposite of the spam
  // gate and deliberately so: this one writes to the owner's database on behalf
  // of a stranger, so unproven means refused.
  const unsecured = await deliver("stock", { authorization: "Bearer " + HOOK_SECRET }, { sku: "A", qty: 1, event_id: "e0" });
  ok("with no secret stored the hook does not exist", unsecured.status === 404, unsecured.status);
  ok("and nothing was written", (await stockRows()).length === 0);

  const hs = await setSecret("HOOK_SECRET_STOCK", HOOK_SECRET);
  ok("the owner can store the hook's secret", hs.status >= 200 && hs.status < 300, hs.status);

  // The shared secret, the way most systems offer to send one.
  const d1 = await deliver("stock", { authorization: "Bearer " + HOOK_SECRET }, { sku: "AB-1", qty: 4, event_id: "evt_1" });
  const d1b = await d1.json().catch(() => ({}));
  ok("a delivery with the right secret is accepted", d1.status === 200, d1.status + " " + JSON.stringify(d1b));
  ok("and the function's own answer comes back", d1b && d1b.stored === 1, JSON.stringify(d1b));
  let rows = await stockRows();
  ok("the row really landed in Postgres", rows.length === 1 && rows[0].sku === "AB-1", JSON.stringify(rows).slice(0, 200));

  // AN HMAC OVER THE RAW BODY — the stronger proof, and the one GitHub, Shopify
  // and most payment providers send.
  const rawBody = JSON.stringify({ sku: "CD-2", qty: 9, event_id: "evt_2" });
  const sig = await hmacHex(HOOK_SECRET, rawBody);
  const d2 = await deliver("stock", { "x-hub-signature-256": "sha256=" + sig }, rawBody);
  ok("a signed delivery is accepted", d2.status === 200, d2.status);
  ok("and it landed too", (await stockRows()).length === 2);

  // A signature over DIFFERENT bytes must not open the door — that is the only
  // thing an HMAC buys over a shared secret.
  const tampered = JSON.stringify({ sku: "CD-2", qty: 9000, event_id: "evt_3" });
  const d3 = await deliver("stock", { "x-hub-signature-256": "sha256=" + sig }, tampered);
  ok("a signature over other bytes is refused", d3.status === 401, d3.status);
  ok("and nothing was written", (await stockRows()).length === 2);

  const d4 = await deliver("stock", { authorization: "Bearer not-the-secret" }, { sku: "X", qty: 1, event_id: "evt_4" });
  ok("a wrong secret is refused", d4.status === 401, d4.status);

  const d5 = await deliver("stock", {}, { sku: "X", qty: 1, event_id: "evt_5" });
  ok("no credential at all is refused", d5.status === 401, d5.status);
  ok("still nothing written", (await stockRows()).length === 2);

  // RETRIES ARE THE NORMAL CASE. Every sender redelivers on a timeout; the
  // model's ON CONFLICT is what stops the second one becoming a duplicate.
  const d6 = await deliver("stock", { authorization: "Bearer " + HOOK_SECRET }, { sku: "AB-1", qty: 4, event_id: "evt_1" });
  const d6b = await d6.json().catch(() => ({}));
  ok("a redelivered event is accepted", d6.status === 200, d6.status);
  ok("and says it stored nothing", d6b && d6b.stored === 0, JSON.stringify(d6b));
  rows = await stockRows();
  ok("so the retry did not duplicate the row", rows.length === 2, JSON.stringify(rows.map((r) => r.event_id)));

  // THE PREFIX IS THE BOUNDARY, and this is the check that matters: knowing the
  // shared secret must not become a way to call every other internal function.
  // `private_peek` is internal and takes one jsonb argument — it satisfies
  // everything except the name.
  const peek = await deliver("private_peek", { authorization: "Bearer " + HOOK_SECRET }, {});
  ok("an internal function without the hook_ prefix is unreachable", peek.status === 404, peek.status);
  const peekBody = await peek.text();
  ok("even holding the secret", !/leaked/.test(peekBody), peekBody.slice(0, 120));
  // And the confirmation builder, which is the real-world version of the same.
  const conf = await deliver("booking", { authorization: "Bearer " + HOOK_SECRET }, { row_id: 1 });
  ok("nor is the confirmation builder", conf.status === 404, conf.status);

  const wrongMethod = await fetch(hookUrl("stock"), { headers: { authorization: "Bearer " + HOOK_SECRET } });
  ok("a GET is 405, so a misconfigured sender learns why", wrongMethod.status === 405, wrongMethod.status);

  const notJson = await deliver("stock", { authorization: "Bearer " + HOOK_SECRET }, "this is not json");
  ok("a body that is not json is the caller's fault", notJson.status === 400, notJson.status);

  const unknown = await deliver("nothing_here", { authorization: "Bearer " + HOOK_SECRET }, {});
  ok("an undeclared hook is 404", unknown.status === 404, unknown.status);

  // --- READING SOMEBODY ELSE'S API -----------------------------------------
  console.log("\nthird-party reads…");
  const extApi = (n, qs) => fetch(`${BASE}/api/db/${slug}/api/${n}${qs || ""}`);

  const good = await extApi("pub", "?p=trace");
  const goodText = await good.text();
  ok("a declared read reaches the real service", good.status === 200, good.status + " " + goodText.slice(0, 120));
  // Cloudflare's trace endpoint answers key=value lines; `fl=` is on every one.
  //
  // PARSED FIRST, because the route answers `Response.json(body)` whatever the
  // service sent — a text/plain upstream arrives as a JSON *string*, newlines
  // and all, so a regex looking for a real newline never matches. That is the
  // contract a page gets (`useApi<string>` for a text service, `useApi<T>` for a
  // JSON one) and it is worth asserting rather than assuming: the first draft of
  // this check tested the raw body and failed against a perfectly good response.
  let goodBody = null;
  try { goodBody = JSON.parse(goodText); } catch { /* not json at all */ }
  ok("and hands back what that service actually sent",
    typeof goodBody === "string" && /(^|\n)fl=/.test(goodBody), goodText.slice(0, 160));

  // THE PARAMETER REALLY REACHED THE URL. A different value is a different
  // path, so the STATUS moves — which is the one way to see substitution from
  // outside without a service that echoes.
  const other = await extApi("pub", "?p=definitely-not-a-real-endpoint");
  ok("a different parameter is a different request", other.status !== 200, other.status);

  // A parameter the declaration never named is DROPPED, not forwarded. If it
  // were, this would rewrite the path and stop being a 200.
  const extra = await extApi("pub", "?p=trace&host=evil.example&url=https://evil.example");
  ok("an undeclared parameter is ignored", extra.status === 200, extra.status);

  // …AND THE SECRET HALF. Identical declaration but for one `{{SMOKE_API_KEY}}`
  // in a header. With nothing stored it must REFUSE rather than send the header
  // empty — an API called with `Bearer ` can answer 200 with degraded data, and
  // the page would render something plausible and wrong.
  const beforeKey = await extApi("keyed");
  ok("a read whose secret is not stored refuses", beforeKey.status === 503, beforeKey.status);
  const beforeKeyBody = await beforeKey.text();
  ok("and never names the secret to the visitor", !/SMOKE_API_KEY/.test(beforeKeyBody), beforeKeyBody.slice(0, 120));

  const sk = await setSecret("SMOKE_API_KEY", "sk_smoke_" + stamp);
  ok("the owner can store it", sk.status >= 200 && sk.status < 300, sk.status);
  const afterKey = await extApi("keyed");
  const afterKeyText = await afterKey.text();
  // THE PROOF OF SUBSTITUTION: the same request refused a moment ago precisely
  // because the placeholder could not be resolved, and succeeds now that it can.
  ok("and the same read now goes through", afterKey.status === 200, afterKey.status + " " + afterKeyText.slice(0, 120));
  ok("the secret is never in the response", !afterKeyText.includes("sk_smoke_" + stamp), afterKeyText.slice(0, 160));

  const unknownApi = await extApi("no_such_connection");
  ok("an undeclared connection is 404", unknownApi.status === 404, unknownApi.status);
  const wrongVerb = await fetch(`${BASE}/api/db/${slug}/api/pub?p=trace`, { method: "POST" });
  ok("and it is GET only", wrongVerb.status === 405, wrongVerb.status);

  // --- SPAM PROTECTION -----------------------------------------------------
  //
  // The SERVER half, proved live at $0 using CLOUDFLARE'S OWN PUBLISHED TEST
  // SECRETS — one that verifies everything and one that verifies nothing. No
  // account, no widget, no browser. The page half (the widget rendering and
  // `useCreateRow` attaching the token) is not covered here.
  console.log("\nspam protection…");
  const ALWAYS_FAIL = "2x0000000000000000000000000000000AA";
  const ALWAYS_PASS = "1x0000000000000000000000000000000AA";
  const book = (extra2) => data("bookings", jsonPost({ who: "Turn", email: "t@example.com", slot: "21:00", ...extra2 }));

  // THE CONFIGURATION IS CACHED FOR 15 SECONDS PER ISOLATE and invalidated only
  // on the isolate that took the write, so a change takes up to that long to be
  // seen everywhere. That is a real property of the feature, not a flaw in the
  // test — an owner switching this on waits the same 15s — so the check waits
  // for the transition rather than asserting on the first request after it.
  const settle = async (want, extra2) => {
    let last = 0;
    for (let i = 0; i < 14; i++) {
      const r = await book(extra2);
      last = r.status;
      if (want === "refused" ? r.status === 403 : r.status < 300) return r.status;
      await new Promise((r2) => setTimeout(r2, 2500));
    }
    return last;
  };

  const ts1 = await setSecret("TURNSTILE_SECRET", ALWAYS_FAIL);
  ok("the owner can store a Turnstile secret", ts1.status >= 200 && ts1.status < 300, ts1.status);
  const refusedStatus = await settle("refused", { "cf-turnstile-response": "anything" });
  ok("a submission Cloudflare refuses is stopped", refusedStatus === 403, refusedStatus);
  // Configured and no token at all is refused too, and WITHOUT calling
  // Cloudflare — the widget is in the page, so a submission without one did not
  // come from the page.
  const noToken = await book();
  ok("and so is one with no token at all", noToken.status === 403, noToken.status);
  const refusedBody = await noToken.json().catch(() => ({}));
  // `message` is the field `rows.ts` reads; `error` would render as
  // "request failed (403)" on the customer's screen.
  ok("the visitor is told something they can act on", typeof refusedBody.message === "string" && refusedBody.message.length > 10,
    JSON.stringify(refusedBody).slice(0, 160));

  const ts2 = await setSecret("TURNSTILE_SECRET", ALWAYS_PASS);
  ok("the owner can change it", ts2.status >= 200 && ts2.status < 300, ts2.status);
  const passStatus = await settle("accepted", { "cf-turnstile-response": "anything" });
  // AND THIS IS ALSO THE PROOF THE TOKEN IS STRIPPED. `cf-turnstile-response`
  // is not a column `bookings` declared, so left in the row PostgREST refuses
  // the insert — a 2xx here is only possible if it was removed on the way past.
  ok("a verified submission goes through, token stripped", passStatus < 300, passStatus);

  // Back off, so the checks after this are not fighting a gate.
  await fetch(`${BASE}/api/site/${slug}/secrets/TURNSTILE_SECRET`, {
    method: "DELETE", headers: { Authorization: `Bearer ${jwt}` },
  }).catch(() => {});

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
