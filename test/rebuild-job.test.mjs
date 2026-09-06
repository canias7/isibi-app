// STAGE 9 (2026-09-06): THE PLATFORM REBUILD IS A JOB.
//
// It used to run inside the cron tick — `recompileAndPublish` awaited there,
// eight at a time, every one bounded by the fifteen minutes an invocation gets
// and none of them holding a lease. A tick that ran out of clock left a
// container mid-compile with nothing recording it, a deploy rolled under it
// (3a gates the queue, never the cron), and none of the recovery the edit path
// grew applied to it.
//
// Now the tick files a job and returns; the ordinary edit consumer runs it,
// in the site's own container when the runner flags admit. The row stays the
// queue and the drain keeps every verdict it ever made — it reads the job's
// own answer on a later tick, and finds that job again through a key derived
// from the row rather than from a column nobody has.
//
// Driven: the key, the verdict, the drain's branch, the Worker's dep through
// the REAL cron with a fake Supabase, and the route's gate through the real
// router.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PENDING_DEFER_SEC, BUSY_DEFER_SEC, REBUILD_OP, REBUILD_START_DELAY_S, CLAIM_SEC,
  rebuildIdem, verdictFor, drainRebuild,
} from "../site-rebuild.mjs";
import { cleanIdemKey, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { loadWorker, makeCtx, hit } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { packEditJob, EDIT_JOB_PREFIX } from "../builder/edit-job.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { randomBytes } from "node:crypto";

const ROOT = new URL("..", import.meta.url);
const WORKER = readFileSync(new URL("worker.js", ROOT), "utf8");
const SLUG = "fretwork-1";
const UID = "u-rebuild-1";
const ENQ = "2026-09-06T10:00:00Z";

// ── THE JOB'S NAME ──────────────────────────────────────────────────────────

test("the key names one attempt of one row, and the platform's own key checker admits it", () => {
  const a = rebuildIdem(ENQ, 0);
  assert.equal(cleanIdemKey(a), a, "the rebuild's key is not one edit_create would take: " + a);
  // STABLE INSIDE AN ATTEMPT — this is what lets a later tick find the job it
  // filed rather than filing a second one.
  assert.equal(rebuildIdem(ENQ, 0), a);
  assert.equal(rebuildIdem(Date.parse(ENQ), 0), a, "a stamp read as a number names a different job from the same time");
  // DIFFERENT ACROSS ATTEMPTS: a rebuild that failed and backed off deserves a
  // fresh job, not the old one's answer.
  assert.notEqual(rebuildIdem(ENQ, 1), a);
  assert.equal(cleanIdemKey(rebuildIdem(ENQ, 99999)), rebuildIdem(ENQ, 99999));
  // AND ACROSS GENERATIONS: a site drained months ago and queued again is new
  // work, and must not read the old job's verdict. This is the case a key made
  // of the slug alone would get wrong, and the row has no column to remember an
  // id in.
  assert.notEqual(rebuildIdem("2026-11-01T10:00:00Z", 0), a);
  // A ROW WITH NO READABLE STAMP HAS NO STABLE NAME, and a key that changed
  // every tick would file a rebuild every two minutes. Refused, never guessed.
  for (const junk of [undefined, null, "", "whenever", {}, NaN]) assert.equal(rebuildIdem(junk, 0), null, "a stamp of " + JSON.stringify(junk) + " was given a name");
  // Junk attempts read as the first one rather than throwing.
  for (const junk of [undefined, null, "x", -3, NaN]) assert.equal(rebuildIdem(ENQ, junk), a);
});

// ── THE VERDICT AND THE DRAIN ───────────────────────────────────────────────

test("a pending answer is read first, carries its own wait, and is not a failure", () => {
  const v = verdictFor({ pending: true, reason: "handed to job abc" });
  assert.equal(v.state, "pending");
  assert.match(v.reason, /handed to job abc/);
  assert.equal(v.wait, PENDING_DEFER_SEC);
  // A site under review waits for a person, on the busy cadence.
  assert.equal(verdictFor({ pending: true, wait: BUSY_DEFER_SEC, reason: "under review" }).wait, BUSY_DEFER_SEC);
  for (const junk of ["soon", 0, -5, NaN, undefined]) assert.equal(verdictFor({ pending: true, wait: junk }).wait, PENDING_DEFER_SEC);
  // READ BEFORE `ok` AND `gone`: a pending answer is about the JOB and carries
  // neither, so an answer that says both must not be read as the site's.
  assert.equal(verdictFor({ pending: true, ok: true }).state, "pending");
  assert.equal(verdictFor({ pending: true, gone: true }).state, "pending");
  // And nothing else becomes pending by accident.
  for (const not of [{ ok: true }, { gone: true }, { pending: "yes" }, { pending: 1 }, {}]) {
    assert.notEqual(verdictFor(not).state, "pending", JSON.stringify(not) + " read as pending");
  }
});

test("the drain defers a pending row WITHOUT an attempt or a rung, and counts it apart", async () => {
  const calls = { defer: [], forget: 0, rebuilt: 0 };
  const deps = {
    due: async () => [{ slug: SLUG, attempts: 3, enqueued_at: ENQ }],
    exists: async () => true,
    claim: async () => true,
    rebuild: async () => ({ pending: true, reason: "handed to job abc" }),
    forget: async () => { calls.forget++; },
    defer: async (slug, attempts, sec, why) => { calls.defer.push({ slug, attempts, sec, why }); },
  };
  const out = await drainRebuild(deps);
  assert.equal(out.pending, 1);
  assert.equal(out.deferred, 0, "a pending row was counted as a failure");
  assert.equal(out.parked, 0);
  assert.equal(out.rebuilt, 0);
  assert.equal(calls.forget, 0, "the row was forgotten while its job was still running");
  assert.deepEqual(calls.defer, [{ slug: SLUG, attempts: 3, sec: PENDING_DEFER_SEC, why: "handed to job abc" }]);
  // THE ATTEMPT DID NOT CLIMB: a job in flight is not a failed rebuild, and a
  // row that climbed a rung per tick would park a healthy site in ten minutes.
  assert.equal(calls.defer[0].attempts, 3);

  // The row's own dep is handed the ROW, which is what names the job.
  let sawRow = null;
  await drainRebuild({ ...deps, rebuild: async (slug, row) => { sawRow = row; return { pending: true }; } });
  assert.equal(sawRow && sawRow.enqueued_at, ENQ, "the rebuild dep cannot name its job without the row");

  // And the ordinary verdicts still do what they did.
  const done = await drainRebuild({ ...deps, rebuild: async () => ({ ok: true }) });
  assert.equal(done.rebuilt, 1);
  assert.equal(done.pending, 0);
  const stuck = await drainRebuild({ ...deps, rebuild: async () => ({ ok: false, error: "compile", detail: "tsx" }) });
  assert.equal(stuck.parked, 1);
});

// ── THE WORKER'S DEP, DRIVEN THROUGH THE REAL CRON ──────────────────────────

/**
 * The cron tick, with a fake Supabase and fake bindings. Everything the tick
 * asks for that this does not recognise answers an empty list, which is what
 * every other job on the tick reads as "nothing to do".
 */
async function tick({ rows, owner = UID, create, get, claim = { ok: true, won: true, busy: false } }) {
  const worker = await loadWorker();
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = (init.method || (input && input.method) || "GET").toUpperCase();
    let body = null;
    try { body = init.body ? JSON.parse(init.body) : null; } catch { body = null; }
    seen.push({ url, method, body });
    const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/rest/v1/site_rebuild") && method === "GET") return json(rows);
    if (url.includes("/rest/v1/site_rebuild")) return new Response(null, { status: 204 });
    if (url.includes("/rest/v1/site_backends") && url.includes("select=slug")) return json([{ slug: SLUG }]);
    if (url.includes("/rest/v1/site_backends")) return json(owner ? [{ uid: owner }] : []);
    if (url.includes("/rpc/rebuild_claim")) return json(claim);
    if (url.includes("/rpc/edit_create")) return json(create || { ok: true, job: "j-1", state: "queued", duplicate: false });
    if (url.includes("/rpc/edit_get")) return json(get || { ok: false, error: "no-job" });
    return json([]);
  };
  const sent = [];
  const listed = [];
  const env = {
    SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint",
    SITES_BUCKET: {
      async get() { return null; }, async put() {}, async delete() {},
      // The prefixes the tick listed, so the retention sweep can be DRIVEN
      // rather than read: `if (false) ctx.waitUntil(...)` leaves the call
      // exactly where a regex looks for it (the recorded trap, and the sweep's
      // W9 survived on it).
      async list({ prefix } = {}) { listed.push(prefix); return { objects: [] }; },
    },
    BUILD_QUEUE: { async send(msg, opts) { sent.push({ msg, opts }); } },
  };
  const ctx = makeCtx();
  try {
    await worker.scheduled({ cron: "*/2 * * * *" }, env, ctx);
    await Promise.allSettled(ctx.pending);
  } finally { globalThis.fetch = real; }
  return { seen, sent, listed };
}

const rebuildRow = (extra = {}) => [{ slug: SLUG, attempts: 0, enqueued_at: ENQ, ...extra }];
const deferOf = (seen) => seen.find((c) => c.url.includes("site_rebuild") && c.method === "PATCH");
const createOf = (seen) => seen.find((c) => c.url.includes("/rpc/edit_create"));

test("a due row files a job for the site's OWNER, at the rebuild route, under its own op", async () => {
  const { seen, sent } = await tick({ rows: rebuildRow() });
  const created = createOf(seen);
  assert.ok(created, "no job was filed for a due row");
  assert.equal(created.body.p_uid, UID, "the job is not the site owner's");
  assert.equal(created.body.p_slug, SLUG);
  assert.equal(created.body.p_op, REBUILD_OP, "a rebuild filed under another op would collide with the customer's own edits");
  assert.equal(created.body.p_idem, rebuildIdem(ENQ, 0), "the job's name is not derived from the row");
  // The stored request names the internal route, and the message is delayed so
  // the drain's own claim mark is cleared before the job's claim reads it.
  const job = sent.find((s) => s.msg && s.msg.kind === EDIT_JOB_KIND);
  assert.ok(job, "the job was filed and never sent");
  assert.ok(job.opts && job.opts.delaySeconds >= 1, "the rebuild's message is not delayed past its own claim mark");
  assert.ok(job.opts.delaySeconds <= REBUILD_START_DELAY_S * 2, "the delay is not the module's");
  // THE ROW WAITS, and does not climb a rung for work that has not failed.
  const deferred = deferOf(seen);
  assert.ok(deferred, "the row was not pushed out after the job was filed");
  assert.equal(deferred.body.attempts, 0);
  assert.match(String(deferred.body.last_error), /handed to job/);
  assert.equal(deferred.body.running_until, null, "the drain's claim mark outlives the tick that filed the job");
  // NOTHING WAS COMPILED HERE. The whole point: the tick returns instead of
  // awaiting a publish.
  assert.ok(!seen.some((c) => /\/build\b/.test(c.url)), "the cron reached a container");
});

test("the same tick takes out the litter under `jobs/` — driven, not read", async () => {
  // The other half of stage 9, and DRIVEN because reading the cron for the
  // call cannot tell a call from a call nobody makes: `if (false)` leaves it
  // exactly where a regex looks for it (this is what the sweep's W9 showed).
  const { listed } = await tick({ rows: [] });
  const jobs = listed.filter((p) => typeof p === "string" && p.startsWith("jobs/"));
  assert.equal(jobs.length, 2, "the cron listed " + JSON.stringify(listed) + " — it must sweep one bucket of both job prefixes");
  assert.ok(jobs.some((p) => p.startsWith("jobs/edit/")), "the edit jobs' own prefix was never listed");
  assert.ok(jobs.some((p) => !p.startsWith("jobs/edit/")), "the build jobs' prefix was never listed");
  // The two name the SAME bucket, which is what makes the rotation cover
  // everything rather than half of it.
  assert.equal(jobs[1], "jobs/edit/" + jobs[0].slice("jobs/".length));
});

test("a job already filed is FOUND rather than filed twice, and its answer is the verdict", async () => {
  // The key finds it: `edit_create` answers `duplicate` with the job's id.
  const dup = { ok: true, job: "j-1", state: "publishing", duplicate: true };
  const running = await tick({ rows: rebuildRow(), create: dup, get: { ok: true, state: "publishing" } });
  assert.match(String(deferOf(running.seen).body.last_error), /job j-1 is publishing/);
  assert.equal(running.sent.filter((s) => s.msg && s.msg.kind === EDIT_JOB_KIND).length, 0, "a job already running was sent again");

  // DONE: the row goes, and only after the job said so.
  const ok = await tick({
    rows: rebuildRow(), create: dup,
    get: { ok: true, state: "done", result: { status: 200, body: JSON.stringify({ ok: true, files: 30 }) } },
  });
  assert.ok(ok.seen.some((c) => c.url.includes("site_rebuild") && c.method === "DELETE"), "a republished site was not forgotten");

  // THE SITE'S OWN SOURCE DID NOT COMPILE: parked at the last rung, its reason
  // on the row, exactly as when the drain ran the compile itself.
  const bad = await tick({
    rows: rebuildRow(), create: dup,
    get: { ok: true, state: "failed", result: { status: 200, body: JSON.stringify({ ok: false, error: "compile", detail: "TS2322" }) } },
  });
  const parked = deferOf(bad.seen);
  assert.equal(parked.body.attempts, 1, "a real failure did not count an attempt");
  assert.match(String(parked.body.last_error), /TS2322/);

  // A JOB THE SWEEP DECLARED LOST writes no reply: ours, so it retries under
  // the next attempt's key rather than parking a site whose pages may be fine.
  const lost = await tick({ rows: rebuildRow(), create: dup, get: { ok: true, state: "lost", result: null } });
  const retried = deferOf(lost.seen);
  assert.equal(retried.body.attempts, 1);
  assert.match(String(retried.body.last_error), /no readable answer/);
});

test("a site under review waits for a person; a row with no stamp and an unreadable owner are ours", async () => {
  const review = await tick({ rows: rebuildRow(), create: { ok: false, error: "needs-review", job: "j-old" } });
  const r = deferOf(review.seen);
  assert.equal(r.body.attempts, 0, "a site under review had its rebuild counted as a failure");
  assert.match(String(r.body.last_error), /under review/);

  // No stamp: no stable name, so no job — and it retries rather than parking.
  const nostamp = await tick({ rows: [{ slug: SLUG, attempts: 0 }] });
  assert.equal(createOf(nostamp.seen), undefined, "a row with no stamp filed a job under a name that changes every tick");
  assert.equal(deferOf(nostamp.seen).body.attempts, 1);

  // The owner could not be read (or the site went between the two reads): ours.
  // ITS OWN SLUG: `siteOwnerBySlug` memoizes per slug for five minutes, so a
  // case that reused a slug an earlier case resolved would read that owner and
  // pass whatever the code did (the recorded memoized-reader trap).
  const noowner = await tick({ rows: [{ slug: "noowner-1", attempts: 0, enqueued_at: ENQ }], owner: null });
  assert.equal(createOf(noowner.seen), undefined, "a job was filed with no owner to file it for");
  assert.match(String(deferOf(noowner.seen).body.last_error), /who owns/);
});

test("a site another job holds is still deferred without an attempt, and no job is filed", async () => {
  const busy = await tick({ rows: rebuildRow(), claim: { ok: true, won: false, busy: true, other: "j-other" } });
  assert.equal(createOf(busy.seen), undefined, "a rebuild was filed for a site somebody else holds");
  const d = deferOf(busy.seen);
  assert.equal(d.body.attempts, 0);
  assert.equal(d.body.running_until, null);
  assert.match(String(d.body.last_error), /busy/);
});

// ── THE ROUTE ───────────────────────────────────────────────────────────────

test("the rebuild route exists, is gated, and is INTERNAL — a replay is the only way in", async () => {
  // REACHED: the bottom of the router answers `not found`; this answers the
  // block's own 401, which is what says the route is wired at all.
  const anon = await hit("/api/site/" + SLUG + "/rebuild", { method: "POST" });
  assert.equal(anon.status, 401, "the rebuild route is not reachable: " + anon.text.slice(0, 120));
  // And the source says the rest: no marker is 404 before anything is read, the
  // method is checked, and the ownership gate is the same one every route in
  // the block makes.
  const src = WORKER.slice(WORKER.indexOf("          if (rb) {"), WORKER.indexOf("          if (ed) {", WORKER.indexOf("          if (rb) {")));
  assert.ok(src.length > 400, "the rebuild route moved");
  const noMarker = src.indexOf("if (!eReplay) return Response.json({ error: \"not found\" }, { status: 404 });");
  const method = src.indexOf('request.method !== "POST"');
  const gate = src.indexOf("await assertOwner(ownerDeps, ownerSlug, ou.id)");
  const publish = src.indexOf("recompileAndPublish(env,");
  assert.ok(noMarker > 0 && method > 0 && gate > noMarker && publish > gate,
    "the route does not refuse a non-replay before it does any work");
  assert.match(src, /job: eReplay\.replay/, "the publish does not run under the job's own budget and lease");
  assert.ok(!/charge:/.test(src), "a rebuild must not hand the spine a charge funnel — it is free");
  // The replay identity is offered to this route as well as the two the queue
  // already replayed, and to nothing else.
  assert.match(WORKER, /const eReplay = \(ed \|\| ad \|\| rb\) \? editReplayUser\(request, ownerSlug\) : null;/);
});

test("the drain hands the site to a job and never compiles inside the cron", () => {
  const body = WORKER.slice(WORKER.indexOf("async function runSiteRebuild(env) {"), WORKER.indexOf("\n// ── Free-tier media proxy"));
  assert.ok(body.length > 500 && body.length < 20000, "runSiteRebuild moved");
  assert.match(body, /rebuild: async \(slug, row\) => \{/, "the dep cannot name its job without the row");
  assert.match(body, /op: REBUILD_OP/);
  assert.match(body, /delayS: REBUILD_START_DELAY_S/);
  assert.match(body, /rebuildIdem\(row && row\.enqueued_at, row && row\.attempts\)/, "the job's name is not the row's");
  assert.match(body, /select=slug,attempts,enqueued_at/, "the due read does not carry the stamp the name is made of");
  // THE COMPILE IS NOT HERE ANY MORE. This is the whole change: the tick files
  // and returns.
  assert.ok(!/recompileAndPublish\(/.test(body), "the cron still awaits a publish inside its own invocation");
  assert.ok(!/loadSiteSourceForEdit\(/.test(body), "the cron still reads a site's source to compile it here");
  // And it still costs nothing: no model call on this path, as before.
  for (const banned of ["callBuilderModel", "generateSitePages", "anthropicMessages", "designSiteSchema"]) {
    assert.ok(!body.includes(banned), "the rebuild path must not call " + banned);
  }
  // The claim's window is still the module's, and the busy answer still the
  // drain's to defer.
  assert.match(body, new RegExp("p_sec: Math\\.max\\(10, Math\\.min\\(3600"), "the claim window is not bounded");
  assert.ok(CLAIM_SEC > PENDING_DEFER_SEC, "a pending row comes back due before its own claim expires, which is what makes the next look meet the job's lease");
});

// ── THE WHOLE LOOP, THROUGH THE REAL CONSUMER ───────────────────────────────
//
// A chain asserted by reading is asserted at the layer below the break (the
// recorded trap), and this one crosses four: the stored request, the replay
// marker, the route's own gate, and the publish. So it runs: one queued job
// whose stored request IS the rebuild route, through the real queue handler.

test("a filed rebuild job replays into the route, compiles once, spends nothing, and stores an answer the drain can read", async () => {
  const id = randomBytes(16).toString("hex"), secret = randomBytes(16).toString("hex");
  const slug = "loop-1";
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([{ path: "src/routes/index.tsx", source: "export default function Home(){return <main><h1>Hello</h1></main>}" }])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Loop", theme: "broadsheet" }, css: "footer{color:#000}" })],
    [EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({
      url: "https://gofarther.dev/api/site/" + slug + "/rebuild",
      body: "{}", uid: UID, slug, secret, at: Date.now(),
    }))],
  ]);
  const obj = (v) => ({ text: async () => v, arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  const bucket = {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
  const rpc = [];
  let models = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    const m = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String(init && init.body) || "{}"); } catch { args = {}; }
      rpc.push({ fn: m[1], args });
      switch (m[1]) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: UID, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "rebuilding", cancel: false });
        case "edit_exempt": return json({ ok: true, billing: "exempt", state: "rebuilding" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_finalize": return json({ ok: true, billing: "finalized", cost: 0, published: true });
        default: return json({ ok: true });
      }
    }
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: UID, brief: "" }]);
    if (u.includes("/v1/messages") || u.includes("api.x.ai")) { models++; return new Response("a rebuild must not call a model", { status: 503 }); }
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] },
      { SITES_BUCKET: bucket, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint" }, ctx);
    await Promise.allSettled(ctx.pending);
  } finally { c.uninstall(); globalThis.fetch = real; }

  // THE ROUTE RAN. Nothing else in this Worker compiles from a queued job whose
  // request is `/rebuild`, so one compile is the proof the replay reached it.
  assert.equal(c.calls.length, 1, "the rebuild job did not reach a publish (" + c.calls.length + " compiles)");
  // AND IT COST NOTHING: no model call, no reserve, and the publish gate
  // granted through the free-rung exemption.
  assert.equal(models, 0, "a rebuild reached a model");
  assert.equal(rpc.filter((r) => r.fn === "edit_reserve").length, 0, "a rebuild reserved credits");
  assert.ok(rpc.some((r) => r.fn === "edit_exempt"), "a job that reserved nothing was not exempted, so its publish would be refused");
  // AND THE ANSWER IS WHERE THE DRAIN READS IT — the row's stored reply, in the
  // shape `verdictFor` expects.
  const fin = rpc.find((r) => r.fn === "edit_finalize");
  assert.ok(fin, "the job never finalized");
  assert.equal(fin.args.p_ok, true, "a successful rebuild was not stored as one");
  const answer = JSON.parse(fin.args.p_result.body);
  assert.equal(answer.ok, true, "the stored answer is not the spine's: " + fin.args.p_result.body.slice(0, 200));
  assert.equal(verdictFor(answer).state, "done", "the drain would not read this answer as a republished site");
});
