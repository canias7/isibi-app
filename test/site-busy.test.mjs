// ONE JOB PER SITE AT A TIME (stage 6, 2026-09-05, owner: "go").
//
// edit_create checked only review and the idempotency key, so two edits with
// different keys, an edit and an addon, an edit and a revise, or an edit and
// the platform rebuild ran at once on one site; the pointer's conditional
// write (stage 7) stops a holder whose pointer moved under it and nothing
// else. Now the CLAIM is the wall: under the site's own advisory lock, a job
// whose site another job holds — a live lease, a publish in flight, the
// platform rebuilding it — is refused `site-busy` and counted; the queue
// consumer re-sends its own message with a delay, and the refusal past the
// cap fails the row from inside the RPC with nothing charged. The consumer
// claims BEFORE it asks a container, and the runner takes the lease over by
// name. edit_committed needs a LIVE lease. The platform rebuild's claim asks
// the same question and leaves a mark the next edit reads. And the editable
// copy ends with a marker naming its version, repaired from the pointer's
// version before an editing reader reads it.
//
// THE DATABASE HALF IS DRIVEN by scripts/edit-rpc-check.sql section 20 against
// the live database — red at FAIL 81 against the old edit_claim (a second job
// claimed a held site), 24 of 24 after the migration — which this suite cannot
// reach. What this file guards is the RECORD of that (the migration, the
// snapshot equal to it, the check's order), the numbers both sides agree on,
// and every Worker hop the check cannot see — DRIVEN through the real queue
// handler, the real runner export, the real routes, and read where a read is
// honest.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hit, loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { SITE_BUSY_DEFER_S, MAX_SITE_BUSY_DEFERRALS, LEASE_TTL_S, EDIT_JOB_KIND, EDIT_JOB_PREFIX, packEditJob } from "../builder/edit-job.mjs";
import { BUSY_BUILD_MSG, BUSY_EDIT_MSG, FAILED_MSG, rowVerdict } from "../builder/build-lease.mjs";
import { jobKey, resultKey, packJob, JOB_KIND } from "../builder/build-job.mjs";
import { readLaunch, runJob } from "../builder/container-job.mjs";
import { BUSY_DEFER_SEC } from "../site-rebuild.mjs";

const DIR = new URL("../supabase/applied/", import.meta.url);
const FILE = fs.readdirSync(DIR).find((f) => /^\d{14}_site_serialization\.sql$/.test(f));
assert.ok(FILE, "the stage-6 migration is not in supabase/applied/");
const MIG = fs.readFileSync(new URL(FILE, DIR), "utf8");
const SNAP = fs.readFileSync(new URL("20260901222000_live_snapshot_edit_rpcs.sql", DIR), "utf8");
const CHECK = fs.readFileSync(new URL("../scripts/edit-rpc-check.sql", import.meta.url), "utf8");
const RAW = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const POLL = fs.readFileSync(new URL("../public/edit-poll.js", import.meta.url), "utf8");

const blankSql = (s) => s.replace(/^([ \t]*)--.*$/gm, (m) => " ".repeat(m.length));

/** JS comments blanked, length preserved and string-aware. */
function blankJs(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const W = blankJs(RAW);
assert.equal(W.length, RAW.length, "the blanker changed worker.js's length");

/** One function's CREATE statement, header to closing dollar quote. `qualified` is `public.name(` or `private.name(`. */
function fnBlock(src, qualified) {
  const head = "CREATE OR REPLACE FUNCTION " + qualified;
  const at = src.indexOf(head);
  assert.ok(at >= 0, qualified + " is not defined in the file");
  const open = src.indexOf("AS $function$", at);
  const close = src.indexOf("$function$", open + "AS $function$".length);
  assert.ok(open > at && close > open, qualified + " has no dollar-quoted body");
  return src.slice(at, close + "$function$".length);
}

/** The named top-level function of worker.js, bounded by the NEXT top-level declaration. */
function fnW(name) {
  let at = W.indexOf(`\nasync function ${name}(`);
  if (at < 0) at = W.indexOf(`\nfunction ${name}(`);
  if (at < 0) at = W.indexOf(`\nexport async function ${name}(`);
  assert.ok(at > 0, name + " is gone from worker.js — rescope this guard");
  const re = /\n(?:export )?(?:async )?function |\n(?:export )?(?:const|let|class) /g;
  re.lastIndex = at + 1;
  const m = re.exec(W);
  const body = W.slice(at, m ? m.index : W.length);
  assert.ok(body.length > 150, `the window on ${name} is ${body.length} characters — this guard would be vacuous`);
  return body;
}

/** The queue handler's edit branch: from the edit dispatch to the build dispatch. */
function editBranch() {
  const q = W.slice(W.indexOf("async queue(batch, env, ctx)"), W.indexOf("async function runQueuedSiteBuild("));
  const at = q.indexOf("if (edit) {");
  const end = q.indexOf("} else if (msg) {", at);
  assert.ok(at > 0 && end > at, "the queue handler's edit branch is gone");
  return q.slice(at, end);
}

const ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const USER = { id: "11111111-2222-4333-8444-555555555555", email: "owner@example.test" };
const AUTHED = { Authorization: "Bearer some-token" };
const ENV_KEYS = { SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test" };
const SECRET = "0123456789abcdef0123456789abcdef";

/** Stub every fetch the Worker makes: GoTrue answers the owner, RPCs answer per name, the rest answers empty lists. */
function stubFetch(rpcAnswers, rpc) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json(USER);
    const m = u.match(/\/rest\/v1\/rpc\/(edit_\w+|rebuild_claim|credit_reverse)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String(init && init.body) || "{}"); } catch { args = {}; }
      delete args.p_mint;
      rpc.push({ fn: m[1], args });
      const a = rpcAnswers[m[1]];
      if (a === undefined) return json({ ok: false, error: "no stub for " + m[1] }, 500);
      return json(typeof a === "function" ? a(args) : a);
    }
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("unavailable", { status: 503 });
  };
  return () => { globalThis.fetch = real; };
}

/** A bucket that remembers what it holds and records deletes. */
function bucket(entries = {}) {
  const store = new Map(Object.entries(entries));
  const deleted = [];
  return {
    store, deleted,
    async get(k) { return store.has(k) ? { key: k, etag: "e-" + k, async text() { return store.get(k); }, async json() { return JSON.parse(store.get(k)); } } : null; },
    async put(k, v) { store.set(k, typeof v === "string" ? v : String(v)); return { key: k, etag: "e-" + k }; },
    async delete(k) { deleted.push(k); store.delete(k); },
    async head(k) { return store.has(k) ? { key: k, size: 1 } : null; },
    async list() { return { objects: [], truncated: false }; },
  };
}

/** A queue that remembers what was sent, with its options. */
function queue() {
  const sent = [];
  return { sent, async send(msg, opts) { sent.push({ msg, opts: opts || null }); }, async sendBatch() { throw new Error("no batch"); } };
}

const EDIT_JOB = () => JSON.stringify(packEditJob({ url: "https://gofarther.dev/api/site/fold-lane/edit", body: JSON.stringify({ layer: "look", instruction: "x" }), uid: USER.id, slug: "fold-lane", secret: SECRET, at: Date.now() }));

// ── THE NUMBERS BOTH SIDES AGREE ON ──────────────────────────────────────────

test("the deferral cap is the migration's literal, the wait fits the browser's own watch, and the delay is a real minute", () => {
  // RE-ANCHORED 2026-09-05 (stage 3a): the count and the cap moved out of
  // edit_claim into private.claim_deferred (one body for a busy site and a
  // deploy's gate), so the literal is read off the NEWEST migration that
  // spells it — found by the file, never assumed to be this stage's — which
  // is what keeps this guard reading the live cap rather than a copy that
  // stopped being the one the database runs.
  const spelled = fs.readdirSync(DIR).filter((f) => /^\d{14}_.*\.sql$/.test(f) && !/live_snapshot/.test(f))
    .sort().reverse().find((f) => /if deferred > \d+ then/.test(fs.readFileSync(new URL(f, DIR), "utf8")));
  assert.ok(spelled, "no migration gives up on a count");
  const cap = /if deferred > (\d+) then/.exec(blankSql(fs.readFileSync(new URL(spelled, DIR), "utf8")));
  assert.ok(cap, "the newest migration no longer gives up on a count");
  assert.equal(Number(cap[1]), MAX_SITE_BUSY_DEFERRALS, "the Worker's copy of the cap and the RPC's literal disagree");
  // THE WHOLE WAIT SITS INSIDE THE BROWSER'S WATCH: 400 attempts at the poll's
  // longest delay, read off the poll module, so a customer is told rather than
  // left with a spinner that gave up first.
  const maxMs = /var POLL_MAX_MS = (\d+);/.exec(POLL);
  const attempts = /if \(w\.attempt > (\d+)\)/.exec(fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8"));
  assert.ok(maxMs && attempts, "the browser's watch bound could not be read");
  assert.ok(SITE_BUSY_DEFER_S * MAX_SITE_BUSY_DEFERRALS <= (Number(attempts[1]) * Number(maxMs[1])) / 1000,
    `a job may wait ${SITE_BUSY_DEFER_S * MAX_SITE_BUSY_DEFERRALS}s and the browser stops watching after ${(Number(attempts[1]) * Number(maxMs[1])) / 1000}s`);
  assert.ok(SITE_BUSY_DEFER_S >= 30 && SITE_BUSY_DEFER_S <= 300, "the re-send delay is not a real minute: " + SITE_BUSY_DEFER_S);
  // …AND LONG ENOUGH TO OUTLAST A GENERATION: the container's thirty-minute
  // bound is the longest a site is held by one job.
  assert.ok(SITE_BUSY_DEFER_S * MAX_SITE_BUSY_DEFERRALS >= 1800, "a job behind a whole generation gives up before it ends");
  assert.ok(BUSY_DEFER_SEC >= SITE_BUSY_DEFER_S, "the rebuild is more eager than an edit");
});

// ── THE MIGRATION, THE SNAPSHOT AND THE CHECK ────────────────────────────────

test("the migration: one lock per site taken before the question, both claims ask it, the busy branch counts and gives up through the refund, the commit needs a live lease", () => {
  const busy = blankSql(fnBlock(MIG, "private.site_busy("));
  const lock = busy.indexOf("perform pg_advisory_xact_lock(hashtext('site:' || p_slug));");
  const others = busy.indexOf("select o.id into other from public.edit_jobs o");
  const mark = busy.indexOf("r.running_until > now()");
  assert.ok(lock > 0 && others > lock && mark > others, "the lock is not taken before the rows are read, or the rebuild mark is not read");
  assert.match(busy, /o\.slug = p_slug and o\.id is distinct from p_self/, "the row asking is counted as its own blocker, or another site's rows count");
  assert.match(busy, /and o\.state not in \('done','failed','cancelled','lost'\)\s+and o\.needs_review = false\s+and \(\(o\.lease_owner is not null and o\.lease_expires_at > now\(\)\) or o\.state = 'publishing'\)/,
    "a live lease or a publish in flight is not what holds the site");
  assert.match(busy, /then return 'rebuild'; end if;/);
  const claim = blankSql(fnBlock(MIG, "public.edit_claim("));
  const own = claim.indexOf("if j.needs_review or j.state in ('done','failed','cancelled','lost')");
  const ask = claim.indexOf("other := private.site_busy(j.slug, p_id);");
  const count = claim.indexOf("update public.edit_jobs set deferrals = deferrals + 1, phase = 'waiting', updated_at = now()");
  const give = claim.indexOf("res := public.edit_refund(p_id, 'failed', 'the site was busy for the whole wait', p_mint);");
  const take = claim.indexOf("set lease_owner = p_owner,");
  assert.ok(own > 0 && ask > own && count > ask && give > count && take > give, "the claim's order is not: the row's own answers, the site's question, the count, the give-up, the lease");
  assert.match(claim, /'error', 'site-busy', 'gave_up', true,/);
  assert.match(claim, /'error', 'site-busy', 'gave_up', false,/);
  assert.match(claim, /jsonb_build_object\('kind', 'site-busy', 'phase', 'queued', 'other', other, 'deferrals', deferred\)/, "a row given up on does not carry its reason");
  assert.match(claim, /'needs_review', j\.needs_review,\s+'deferrals', j\.deferrals\)/, "a claimed answer does not carry the count");
  const rc = blankSql(fnBlock(MIG, "public.rebuild_claim("));
  assert.match(rc, /other := private\.site_busy\(p_slug, null\);/, "the rebuild's claim asks a different question");
  const committed = blankSql(fnBlock(MIG, "public.edit_committed("));
  assert.match(committed, /where id = p_id and lease_owner = p_owner\s+and lease_expires_at > now\(\)/, "the commit does not require a LIVE lease beside the owner");
  assert.match(committed, /when j\.lease_expires_at is null or j\.lease_expires_at <= now\(\) then 'lease-expired'/, "a lapsed holder's refusal is not named");
  assert.match(committed, /when j\.lease_owner is distinct from p_owner then 'not-holder'/);
  assert.match(blankSql(fnBlock(MIG, "public.edit_get(")), /'result', j\.result, 'error', j\.error, 'deferrals', j\.deferrals\);/, "edit_get does not carry the count");
  assert.match(blankSql(fnBlock(MIG, "public.edit_handoff(")), /'uid', j\.uid, 'expires', j\.lease_expires_at\);/, "a handoff does not name the row's owner");
  // THE COLUMNS, AND THE GRANTS: the rebuild's claim is the service's alone,
  // the helper nobody's but postgres.
  const sql = blankSql(MIG);
  assert.match(sql, /alter table public\.edit_jobs add column if not exists deferrals integer not null default 0;/);
  assert.match(sql, /alter table public\.site_rebuild add column if not exists running_until timestamp with time zone;/);
  assert.ok(sql.includes("revoke all on function public.rebuild_claim(text, integer, text) from public, anon, authenticated;"));
  assert.ok(sql.includes("grant execute on function public.rebuild_claim(text, integer, text) to service_role;"));
  assert.ok(sql.includes("revoke all on function private.site_busy(text, text) from public, anon, authenticated;"));
  assert.ok(!sql.includes("grant execute on function private.site_busy"), "the helper is granted to a caller");
});

test("the live snapshot carries the six functions byte for byte as the migration applied them", () => {
  // RE-ANCHORED 2026-09-05 (stage 3a): edit_claim was replaced again that
  // night (a deploy id on the claim), so the snapshot holds the NEWEST
  // migration's copy of it — found by the file, never assumed to be this one
  // — and this stage's copy of the other five. The property is the same: the
  // snapshot is the database's own answer, equal to the migration that put
  // each function there.
  const newest = fs.readdirSync(DIR).filter((f) => /^\d{14}_.*\.sql$/.test(f) && !/live_snapshot/.test(f))
    .sort().reverse().find((f) => fs.readFileSync(new URL(f, DIR), "utf8").includes("CREATE OR REPLACE FUNCTION public.edit_claim("));
  assert.ok(newest, "no migration defines edit_claim");
  assert.equal(fnBlock(SNAP, "public.edit_claim("), fnBlock(fs.readFileSync(new URL(newest, DIR), "utf8"), "public.edit_claim("), "the snapshot's edit_claim differs from " + newest);
  for (const q of ["public.edit_committed(", "public.edit_get(", "public.edit_handoff(", "public.rebuild_claim(", "private.site_busy("]) {
    assert.equal(fnBlock(SNAP, q), fnBlock(MIG, q), "the snapshot's " + q + " differs from the migration");
  }
  assert.match(SNAP, /edit_claim, edit_committed, edit_get and edit_handoff REPLACED IN PLACE,\s*-- rebuild_claim and private\.site_busy ADDED/, "the snapshot's header does not record the change");
});

test("the check drives it: two claims on one site, the count, the cap with nothing moved, an expired lease freeing it, a lapsed publisher holding it, never its own blocker, the commit's wall, the rebuild's claim both ways", () => {
  const s20 = CHECK.indexOf("20. ONE JOB PER SITE AT A TIME (stage 6)");
  const restore = CHECK.indexOf("update private.mint set key_hash = keep;");
  assert.ok(s20 > 0 && restore > s20, "section 20 is gone, or sits after the mint restore");
  const sec = CHECK.slice(s20, restore);
  const order = [
    "public.edit_claim(j16, 'ownerRRRR', 90, k)",
    "public.edit_claim(j17, 'ownerSSSS', 90, k)",
    "'FAIL 81 (a second job claimed a site another job holds)",
    "'FAIL 81b (the refusal was not counted on the row)",
    "update public.edit_jobs set deferrals = 45 where id = j17;",
    "'FAIL 82b (giving up did not fail the row with its reason and nothing moved)",
    "update public.edit_jobs set lease_expires_at = now() - interval '1 second' where id = j16;",
    "'FAIL 83 (an expired lease still holds the site)",
    "update public.edit_jobs set state = 'publishing', lease_expires_at = now() - interval '1 second' where id = j18;",
    "'FAIL 84 (a lapsed publisher no longer holds the site)",
    "public.edit_refund(j18, 'failed'",
    "'FAIL 84b (a terminal row still holds the site)",
    "'FAIL 85 (a row counted itself as the site being busy)",
    "public.edit_committed(j19, 'ownerVVVV', 'b1', k)",
    "'FAIL 86b (a holder whose lease lapsed recorded a commit)",
    "'FAIL 86d (a stranger''s commit was not refused by name)",
    "insert into public.site_rebuild (slug, next_try_at) values (c1, now() - interval '1 minute');",
    "public.rebuild_claim(c1, 600, k)",
    "'FAIL 87 (the rebuild claimed a site a job holds)",
    "'FAIL 87b (the rebuild could not claim a free site)",
    "'FAIL 87c (the rebuild claim did not mark the site as running for its window)",
    "'FAIL 88 (an edit claimed a site the platform is rebuilding)",
    "'FAIL 88b (a second tick did not see its own rebuild running)",
    "update public.site_rebuild set running_until = null where site_rebuild.slug = c1;",
    "'FAIL 88c (a cleared rebuild mark still holds the site)",
    "'FAIL 89 (edit_get does not carry the deferral count)",
    "'FAIL 89b (a handoff does not name the row''s owner and site)",
    "ok_count := ok_count + 24;",
  ];
  let last = -1;
  for (const needle of order) {
    const i = sec.indexOf(needle);
    assert.ok(i > last, "section 20 lost or reordered: " + needle);
    last = i;
  }
  // THE MONEY IS READ around the give-up, and the two rows are on ONE slug.
  assert.match(sec, /select balance into b0 from public\.credits where user_id = u;\s+r := public\.edit_claim\(j17, 'ownerSSSS', 90, k\);\s+select balance into b1/);
  assert.match(sec, /c1 := slug\|\|'-c1';/, "the section does not name its one site");
  assert.match(CHECK, /j16 text := 'e_'\|\|substr\(md5\(random\(\)::text\),1,20\);/);
  assert.match(CHECK, /ts2 timestamptz; c1 text;/);
});

// ── THE VERDICT ──────────────────────────────────────────────────────────────

test("a build row the claim failed as site-busy answers its own sentence, and any other failed row the build's", () => {
  const busy = rowVerdict({ state: "failed", slug: "fold-lane", job: ID, error: { kind: "site-busy", phase: "queued", other: "e_x", deferrals: 46 } });
  assert.deepEqual(busy, { status: 410, body: { ok: false, failed: true, busy: true, stage: "queue", job: ID, msg: BUSY_BUILD_MSG } });
  assert.deepEqual(rowVerdict({ state: "failed", job: ID, error: { kind: "TimeoutError" } }).body.msg, FAILED_MSG);
  assert.deepEqual(rowVerdict({ state: "failed", job: ID, error: ["site-busy"] }).body.msg, FAILED_MSG, "a one-element array read as a reason");
  assert.deepEqual(rowVerdict({ state: "failed", job: ID }).body.msg, FAILED_MSG);
  assert.equal(rowVerdict({ state: "queued", job: ID, error: { kind: "site-busy" } }), null, "a reason on a row in flight read as terminal");
  assert.notEqual(BUSY_BUILD_MSG, BUSY_EDIT_MSG);
  for (const m of [BUSY_BUILD_MSG, BUSY_EDIT_MSG]) assert.match(m, /nothing was charged/, "the sentence does not say nothing was charged");
});

// ── DRIVEN: THE QUEUE CONSUMER CLAIMS FIRST, DEFERS, GIVES UP, OR RUNS UNDER ITS CLAIM ──

async function driveEdit(claimAnswer, { env = {}, rpcAnswers = {}, entries, tries } = {}) {
  const b = bucket(entries || { [EDIT_JOB_PREFIX + ID]: EDIT_JOB() });
  const q = queue();
  const rpc = [];
  const restore = stubFetch({
    edit_claim: claimAnswer, edit_beat: { ok: true, alive: true }, edit_finalize: { ok: true },
    edit_refund: { ok: true, refunded: 0 }, edit_handoff: { ok: true }, edit_phase_write: { ok: true }, ...rpcAnswers,
  }, rpc);
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    let acked = 0;
    await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id: ID, ...(tries === undefined ? {} : { tries }) }, ack() { acked++; } }] }, { ...ENV_KEYS, SITES_BUCKET: b, BUILD_QUEUE: q, ...env }, ctx);
    await Promise.allSettled(ctx.pending);
    return { b, q, rpc, acked, fns: rpc.map((x) => x.fn) };
  } finally { restore(); }
}

test("a claim the site's lock refused re-sends the consumer's own message with the delay, runs nothing, and leaves the request where the next delivery finds it", async () => {
  const r = await driveEdit({ ok: true, claimed: false, error: "site-busy", gave_up: false, other: "e_other", deferrals: 2, state: "queued" });
  assert.equal(r.acked, 1);
  assert.deepEqual(r.fns, ["edit_claim"], "the consumer did more than claim on a busy site");
  assert.deepEqual(r.q.sent, [{ msg: { kind: EDIT_JOB_KIND, id: ID }, opts: { delaySeconds: SITE_BUSY_DEFER_S } }], "the message was not re-sent with the delay");
  assert.equal(r.b.store.has(EDIT_JOB_PREFIX + ID), true, "the stored request was taken");
  assert.deepEqual(r.b.deleted, []);
});

test("the refusal past the cap stores the customer's sentence on the row the RPC already failed, and sends nothing", async () => {
  const r = await driveEdit({ ok: true, claimed: false, error: "site-busy", gave_up: true, other: "e_other", deferrals: 46, state: "failed", refund: { ok: true, refunded: 0 } });
  assert.deepEqual(r.fns, ["edit_claim", "edit_finalize"]);
  const fin = r.rpc[1].args;
  assert.equal(fin.p_id, ID);
  assert.equal(fin.p_ok, false, "a job that never ran was finalized as an ok answer");
  assert.equal(fin.p_result.status, 409);
  const body = JSON.parse(fin.p_result.body);
  assert.deepEqual(body, { ok: false, error: "site-busy", job: ID, deferrals: 46, msg: BUSY_EDIT_MSG });
  assert.deepEqual(r.q.sent, [], "a job the RPC gave up on was re-sent");
  assert.equal(r.b.store.has(EDIT_JOB_PREFIX + ID), true);
});

test("a claimed row runs the job under that one claim — never a second — and a row that cannot be claimed for its own reasons runs nothing", async () => {
  const r = await driveEdit({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug: "fold-lane", needs_review: false, deferrals: 0 });
  assert.equal(r.fns.filter((f) => f === "edit_claim").length, 1, "the consumer claimed twice: " + r.fns.join(","));
  assert.ok(r.fns.includes("edit_finalize"), "the job did not run under the consumer's claim: " + r.fns.join(","));
  assert.equal(r.b.store.has(EDIT_JOB_PREFIX + ID), false, "the request was not deleted once read");
  assert.deepEqual(r.q.sent, []);
  for (const refused of [{ ok: true, claimed: false, error: "leased", state: "routing" }, { ok: false, claimed: false, error: "no-job" }]) {
    const x = await driveEdit(refused);
    assert.deepEqual(x.fns, ["edit_claim"], JSON.stringify(refused) + " ran something");
    assert.deepEqual(x.q.sent, [], JSON.stringify(refused) + " was re-sent");
  }
  // RE-ANCHORED 2026-09-05 (stage 3a). A claim that could not be READ — a
  // transport failure, a refusal with a status — was "runs nothing" here; it
  // is deferred ONCE now: the consumer cannot ask the deploy gate either, so
  // its message is sent again carrying `tries`, and only the second
  // unreadable claim leaves the row queued (for the stale sweep).
  // test/deploy-gate.test.mjs drives both halves; this holds the first.
  const unread = await driveEdit({ ok: false, error: "rpc" });
  assert.deepEqual(unread.fns, ["edit_claim"], "an unreadable claim ran something");
  assert.deepEqual(unread.q.sent, [{ msg: { kind: EDIT_JOB_KIND, id: ID, tries: 1 }, opts: { delaySeconds: SITE_BUSY_DEFER_S } }], "an unreadable claim was not deferred once");
});

test("a re-send that cannot be made is said, not thrown, and the message is acked", async () => {
  const r = await driveEdit({ ok: true, claimed: false, error: "site-busy", gave_up: false, other: "e_other", deferrals: 1 },
    { env: { BUILD_QUEUE: { async send() { throw new Error("queue down"); } } } });
  assert.equal(r.acked, 1);
  assert.deepEqual(r.fns, ["edit_claim"]);
});

// ── DRIVEN: THE RUNNER TAKES THE LEASE OVER FROM THE CONSUMER BY NAME ────────

async function driveRunner(holder, answers) {
  const b = bucket({});
  const rpc = [];
  const restore = stubFetch({ edit_claim: { ok: true, claimed: false, error: "leased", state: "claimed" }, edit_refund: { ok: true, refunded: 0 }, ...answers }, rpc);
  try {
    const mod = await loadWorkerModule();
    await mod.runContainerJob({ ...ENV_KEYS, SITES_BUCKET: b }, makeCtx(), { kind: "edit", id: ID, ...(holder ? { holder } : {}) });
    return { rpc, fns: rpc.map((x) => x.fn) };
  } finally { restore(); }
}

test("the runner: a leased row is taken over from the launch's holder by name and the job runs; no holder, or a refused takeover, runs nothing", async () => {
  const took = await driveRunner("c_consumer0001", { edit_handoff: { ok: true, state: "claimed", owner: "c_x", slug: "fold-lane", uid: USER.id } });
  // The takeover landed, then the run began: with no stored request, the
  // consumer's own next step is the refund that says so.
  assert.deepEqual(took.fns, ["edit_claim", "edit_handoff", "edit_refund"]);
  const h = took.rpc[1].args;
  assert.equal(h.p_id, ID);
  assert.equal(h.p_owner, "c_consumer0001", "the takeover is not from the launch's holder");
  assert.match(String(h.p_next), /^c_/, "the runner's own name is not a minted owner");
  assert.equal(h.p_ttl, LEASE_TTL_S);
  assert.equal(h.p_state, null);
  assert.equal(h.p_slug, null);
  assert.equal(took.rpc[2].args.p_note, "request object missing");
  const none = await driveRunner("", {});
  assert.deepEqual(none.fns, ["edit_claim"], "a runner with no holder took something over, or ran");
  const refused = await driveRunner("c_consumer0001", { edit_handoff: { ok: false, error: "not-holder", state: "claimed" } });
  assert.deepEqual(refused.fns, ["edit_claim", "edit_handoff"], "a refused takeover ran the job");
});

test("the launch admits a holder in a minted owner's shape and nothing else, and the runner hands it to the Worker", async () => {
  // v2 since stage 4b (the launch names the Supabase origin; the credential shape is sb-gateway.test.mjs's).
  const good = { v: 2, kind: "edit", id: ID, gateway: { url: "https://gofarther.dev/api/job/" + ID, token: "t" }, sb: { url: "https://ujrqdmmtcptvimazlhom.supabase.co" }, secrets: {}, buildPort: 8080 };
  assert.equal(readLaunch(JSON.stringify(good)).holder, undefined);
  assert.equal(readLaunch(JSON.stringify({ ...good, holder: "c_abc123" })).holder, "c_abc123");
  for (const bad of ["", "ab", "x".repeat(81), "has space", ["c_abc"], 7, { c: 1 }]) {
    assert.equal("holder" in readLaunch(JSON.stringify({ ...good, holder: bad })), false, "admitted holder " + JSON.stringify(bad));
  }
  const seen = [];
  const fake = { runContainerJob: async (env, ctx, job) => { seen.push(job); } };
  await runJob(readLaunch(JSON.stringify({ ...good, holder: "c_abc123" })), { importWorker: async () => fake, env: {}, ctx: { drain: async () => {} } });
  assert.deepEqual(seen, [{ kind: "edit", id: ID, holder: "c_abc123" }]);
  await runJob(readLaunch(JSON.stringify(good)), { importWorker: async () => fake, env: {}, ctx: { drain: async () => {} } });
  assert.deepEqual(seen[1], { kind: "edit", id: ID }, "a launch with no holder handed one on");
});

// ── DRIVEN: THE BUILD CONSUMER WAITS, OR GIVES THE DEPOSIT BACK ──────────────

async function driveBuild(claimAnswer) {
  const b = bucket({ [jobKey(ID)]: JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: JSON.stringify({ brief: "a coffee shop", slug: "fold-lane" }), uid: USER.id, at: 1 })) });
  const q = queue();
  const rpc = [];
  const restore = stubFetch({
    edit_claim: claimAnswer, edit_beat: { ok: true, alive: true }, edit_refund: { ok: true, refunded: 0, billing: "external" },
    edit_finalize: { ok: true, billing: "external" }, edit_handoff: { ok: true },
    credit_reverse: { ok: true, refunded: 2, debited: 2, already: 0, repeat: false },
  }, rpc);
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: JOB_KIND, id: ID }, ack() {} }] }, { ...ENV_KEYS, SITES_BUCKET: b, BUILD_QUEUE: q }, ctx);
    await Promise.allSettled(ctx.pending);
    const out = b.store.get(resultKey(ID));
    return { b, q, rpc, fns: rpc.map((x) => x.fn), out: out ? JSON.parse(out) : null };
  } finally { restore(); }
}

test("a revise whose site is busy puts its request back and re-sends its message with the delay; nothing runs, nothing is written", async () => {
  const r = await driveBuild({ ok: true, claimed: false, error: "site-busy", gave_up: false, other: "e_other", deferrals: 4, state: "queued" });
  assert.deepEqual(r.fns, ["edit_claim"], "the build consumer did more than claim on a busy site");
  assert.equal(r.b.store.has(jobKey(ID)), true, "the job object was not put back for the re-sent message");
  assert.deepEqual(r.q.sent, [{ msg: { kind: JOB_KIND, id: ID }, opts: { delaySeconds: SITE_BUSY_DEFER_S } }]);
  assert.equal(r.out, null, "a deferred build wrote an answer");
});

test("the refusal past the cap gives the deposit back under the build's own ref and writes the busy answer for the waiting request", async () => {
  const r = await driveBuild({ ok: true, claimed: false, error: "site-busy", gave_up: true, other: "e_other", deferrals: 46, state: "failed" });
  assert.deepEqual(r.fns, ["edit_claim", "credit_reverse"]);
  const rev = r.rpc[1].args;
  assert.equal(rev.p_target, USER.id);
  assert.equal(rev.p_ref, "build:" + ID + ":deposit", "the reversal is not under the deposit's own ref");
  assert.equal(rev.p_reason, "busy");
  assert.equal(rev.p_amount, 2, "the reversal is not the deposit");
  assert.ok(r.out, "no answer was written for the waiting request");
  assert.equal(r.out.status, 409);
  const body = JSON.parse(r.out.body);
  assert.equal(body.error, "site-busy");
  assert.equal(body.msg, BUSY_BUILD_MSG);
  assert.equal(body.refunded, 2);
  assert.equal(r.out.uid, USER.id);
  assert.deepEqual(r.q.sent, [], "a build the RPC gave up on was re-sent");
  assert.equal(r.b.store.has(jobKey(ID)), false, "the job object outlived the give-up");
});

// ── DRIVEN: THE POLL SAYS A JOB IS WAITING ───────────────────────────────────

test("the edit poll carries `waiting` once the site's lock has refused the claim, and not before", async () => {
  for (const [deferrals, want] of [[3, true], [0, undefined], [undefined, undefined]]) {
    const rpc = [];
    const restore = stubFetch({ edit_get: { ok: true, job: ID, slug: "fold-lane", state: "queued", phase: deferrals ? "waiting" : null, cost: 0, billing: "none", needs_review: false, cancel: false, ms: 10, result: null, error: null, deferrals } }, rpc);
    try {
      const r = await hit("/api/site/edit/" + ID, { headers: AUTHED, env: ENV_KEYS });
      assert.equal(r.status, 202);
      assert.equal(r.json.waiting, want, `deferrals ${deferrals}`);
      assert.equal(r.json.status, "queued");
    } finally { restore(); }
  }
});

// ── READ: THE WORKER'S HOPS ──────────────────────────────────────────────────

test("the queue handler claims before it asks a container, defers a busy claim, hands its lease name to the fire and the inline run", () => {
  const br = editBranch();
  // RE-ANCHORED 2026-09-05 (stage 3a): the claim's arguments come from
  // `claimArgs`, which adds this Worker's deploy id; the deferral covers a
  // gated claim and an unreadable one beside a busy site, and is handed the
  // MESSAGE (with its `tries`) rather than the id. deploy-gate drives it.
  const claim = br.indexOf('await editRpc(env, "edit_claim", claimArgs(env, edit.id, owner))');
  const defer = br.indexOf("await deferEditJob(env, edit, claim);");
  const beat = br.indexOf("const beat = buildRowBeat(env, edit.id, owner);");
  const fire = br.indexOf("fire = await fireContainerJob(env, edit.id, { holder: owner });");
  const clear = br.indexOf("} finally { clearInterval(beat); }");
  // RE-ANCHORED 2026-09-06 (stage 5e): the inline call gained `startedAt`, this
  // delivery's own clock — the fire above may have waited for container room,
  // and that wait comes out of the invocation the job has to finish inside.
  // The property here is the ORDER and the lease it runs under, both unchanged.
  const inline = br.search(/await runQueuedSiteEdit\(env, ctx, edit\.id, \{ lease: owner, claim[,)} ]/);
  assert.ok(claim > 0 && defer > claim && beat > defer && fire > beat && clear > fire && inline > clear,
    "the edit branch's order is not: claim, defer on busy, beat, fire with the holder, clear, run under the lease");
  assert.match(br, /if \(deferredClaim\(claim\) \|\| unreadClaim\(claim\)\) \{/, "a busy or gated claim, or one that could not be read, is not the deferral's own case");
  assert.match(br, /\} else if \(!claim \|\| claim\.claimed !== true\) \{/, "any other refusal runs something");
  assert.equal((br.match(/edit_claim/g) || []).length, 1, "the handler claims more than once");
});

test("the consumer runs under a handed lease, takes over on `leased` only when told a holder, and never re-sends from inside", () => {
  const fn = fnW("runQueuedSiteEdit");
  // RE-ANCHORED 2026-09-06 (stage 5e): the signature gained `startedAt = 0`,
  // the delivery's own clock, which bounds the inline budget. The property
  // pinned here is the THREE WAYS IN — a handed lease, a handed claim, a
  // takeover by name — each defaulting to absent, so the signature is read for
  // those and left open at the end.
  assert.match(fn, /async function runQueuedSiteEdit\(env, ctx, id, \{ lease = null, claim: held = null, takeOver = null[,}]/);
  assert.match(fn, /const owner = lease \|\| newLeaseOwner\(\);/, "a handed lease is not the owner");
  assert.match(fn, /let claim = held && held\.claimed === true \? held : null;\s+if \(!claim\) \{/, "a handed claim is claimed again");
  assert.match(fn, /if \(claim && claim\.claimed !== true && claim\.error === "leased" && takeOver\) \{\s+const h = await editRpc\(env, "edit_handoff", \{ p_id: id, p_owner: takeOver, p_next: owner, p_ttl: LEASE_TTL_S, p_state: null, p_slug: null \}\);/,
    "the takeover is not from the named holder to this owner for the lease's TTL");
  assert.match(fn, /if \(h && h\.ok === true\) claim = \{ ok: true, claimed: true, state: h\.state, uid: h\.uid, slug: h\.slug, takenOver: true \};/, "a taken-over lease does not carry the row's identity for the agreement check");
  assert.doesNotMatch(fn, /BUILD_QUEUE\.send/, "the consumer re-sends from inside the run — the container's runtime has no queue");
  const defer = fnW("deferEditJob");
  // RE-ANCHORED 2026-09-05 (stage 3a): the give-up carries the claim's own
  // reason and the sentence for it (busy or gated), and the re-send goes
  // through `resendMessage` — one cadence for every deferral — after the
  // unreadable case, which is sent again once. deploy-gate drives all three.
  assert.match(defer, /if \(claim\.gave_up === true\) \{/);
  assert.match(defer, /p_id: id, p_ok: false,\s+p_result: \{ status: 409, type: "application\/json", body: JSON\.stringify\(\{ ok: false, error: claim\.error, job: id, deferrals: n, msg: gated \? GATED_EDIT_MSG : BUSY_EDIT_MSG \}\) \},/,
    "the give-up does not store the customer's sentence as a stored reply");
  assert.match(defer, /return resendMessage\(env, \{ kind: EDIT_JOB_KIND, id \},/, "the re-send is not the consumer's own message");
  assert.match(fnW("resendMessage"), /await env\.BUILD_QUEUE\.send\(msg, \{ delaySeconds: queueDelay\(SITE_BUSY_DEFER_S\) \}\);/, "the re-send is not with the delay");
  const gave = defer.indexOf("claim.gave_up === true");
  const send = defer.indexOf("return resendMessage(env, { kind: EDIT_JOB_KIND, id },");
  assert.ok(gave > 0 && send > gave, "a job the RPC gave up on could be re-sent");
  const ex = fnW("runContainerJob");
  // RE-ANCHORED 2026-09-06 (stage 5b): the job carries a build's slug beside
  // the holder, and the fire takes the kind and an identity; the holder's
  // hop is the property, driven for an edit here and a build in build-runner.
  assert.match(ex, /\{ kind, id, holder = "", slug = "" \} = \{\}/);
  assert.match(ex, /runQueuedSiteEdit\(env, ctx, id, \{ takeOver: typeof holder === "string" && holder \? holder : null \}\)/);
  const fire = fnW("fireContainerJob");
  assert.match(fire, /async function fireContainerJob\(env, id, \{ holder = "", kind = "edit", who: identity = null \} = \{\}\)/);
  assert.match(fire, /\.\.\.\(holder \? \{ holder \} : \{\}\),/, "the launch does not carry the holder");
});

test("the build consumer waits or gives the deposit back; the collector goes on and says so; the row's reason reaches the verdict", () => {
  const claim = fnW("claimBuildRow");
  // RE-ANCHORED 2026-09-05 (stage 3a): a claim refused for a newer deploy's
  // gate is the same waited-out answer as a busy site, with `gated` kept so
  // the sentence and the reason on the answer are its own.
  assert.match(claim, /if \(c\.error === "site-busy" \|\| c\.error === "deploy-gated"\) \{[\s\S]*?return \{ held: false, row: true, busy: true, gated, gaveUp: c\.gave_up === true, other: String\(c\.other \|\| ""\), deferrals: Number\(c\.deferrals\) \|\| 0 \};/,
    "a busy or gated claim is not its own answer");
  const build = fnW("runQueuedSiteBuild");
  const read = build.indexOf("raw = await obj.text(); job = readJob(JSON.parse(raw));");
  const del = build.indexOf("await env.SITES_BUCKET.delete(jobKey(id));");
  // RE-ANCHORED 2026-09-06 (stage 5b): the claim takes the launch's holder and
  // slug (null and "" from the Worker's own consumer); the order is the property.
  const rowAt = build.indexOf("const row = await claimBuildRow(env, id, rowOwner, takeOver, launchSlug);");
  const busy = build.indexOf("if (row.busy) {");
  const reverse = build.indexOf('await reverseCredits(env, job.uid, "build:" + id + ":deposit", row.gated ? "gated" : "busy", SITE_BUILD_FEE);');
  const back = build.indexOf("await env.SITES_BUCKET.put(jobKey(id), raw);");
  const resend = build.indexOf("await env.BUILD_QUEUE.send({ kind: JOB_KIND, id }, { delaySeconds: queueDelay(SITE_BUSY_DEFER_S) });");
  const run = build.indexOf("const res = await runSiteBuild(replayRequest(job), env,");
  assert.ok(read > 0 && del > read && rowAt > del && busy > rowAt && reverse > busy && back > reverse && resend > back && run > resend,
    "the build consumer's order is not: read and keep the raw object, delete, claim, on busy give back or put back and re-send, then run");
  assert.match(build, /if \(row\.gaveUp\) \{/);
  assert.match(build, /status: 409, type: "application\/json", uid: job\.uid,\s+body: JSON\.stringify\(\{ ok: false, stage: "queue", error: why, job: id, deferrals: row\.deferrals, refunded: back\.refunded, msg: row\.gated \? GATED_BUILD_MSG : BUSY_BUILD_MSG \}\),/,
    "the give-up's answer is not the busy sentence for the waiting request");
  assert.match(build, /if \(kept\) \{\s+try \{\s+await env\.BUILD_QUEUE\.send/, "a message is re-sent for an object that was not put back");
  const resume = fnW("runResumedSiteBuild");
  assert.match(resume, /if \(row\.busy\) console\.log\("build resume:", id, "the row says the site is busy with", row\.other, "— publishing anyway; the pointer decides"\);/,
    "the collector does not go on, said, when the site's lock refuses it");
  assert.match(fnW("buildRowStatus"), /rowVerdict\(\{ state: g\.state, slug: g\.slug, job: id, error: g\.error \}\)/, "the row's reason does not reach the verdict");
});

test("the spine reads the commit's answer and names a refused one; the poll carries `waiting`; the drain's claim and defer moved with the lock", () => {
  const spine = fnW("recompileAndPublish");
  assert.match(spine, /const committed = await editRpc\(env, "edit_committed", \{/, "the commit's answer is thrown away");
  assert.match(spine, /const commitWhy = committed && committed\.ok === true \? "" : String\(\(committed && committed\.error\) \|\| "rpc"\);\s+tm\("commit", commitWhy \? "fail" : "ok", commitWhy \? \{ why: commitWhy \} : undefined\);/,
    "a refused commit is not on the trace by its reason");
  const poll = W.slice(W.indexOf('if (url.pathname.startsWith("/api/site/edit/")) {'), W.indexOf('if (url.pathname.startsWith("/api/site/build/") && request.method === "GET")'));
  assert.match(poll, /waiting: Number\(row\.deferrals\) > 0 \? true : undefined,/, "the pending answer does not say a job is waiting");
  const drain = fnW("runSiteRebuild");
  assert.match(drain, /claim: async \(slug, sec\) => \{\s+const r = await editRpc\(env, "rebuild_claim", \{ p_slug: slug, p_sec: Math\.max\(10, Math\.min\(3600, Math\.round\(Number\(sec\) \|\| 600\)\)\) \}\);\s+if \(!r \|\| r\.ok !== true\) return false;\s+if \(r\.busy === true\) return "busy";\s+return r\.won === true;/,
    "the drain's claim is not the RPC, read as won / busy / lost");
  assert.doesNotMatch(drain, /site_rebuild\?slug=eq\.\$\{encodeURIComponent\(slug\)\}` \+\s+`&next_try_at=lte/, "the PATCH claim is still there beside the RPC");
  assert.match(drain, /next_try_at: new Date\(Date\.now\(\) \+ Number\(sec\) \* 1000\)\.toISOString\(\),\s+running_until: null,/, "a deferred row keeps its running mark");
});

test("the editable copy: four editing readers read through the repairing reader, every state copy ends with the marker, and the repair reads the pointer uncached", () => {
  // THE FOUR READERS THAT GO ON TO PUBLISH, each by its own line; and no
  // fifth bare read that publishes — the bare reader's other callers answer a
  // count, a listing or a delete and are named here so a new one is noticed.
  for (const line of [
    "let eSrc = await loadSiteSourceForEdit(env, ownerSlug);",
    "const aSrc = await loadSiteSourceForEdit(env, ownerSlug);",
    "priorPages: existing ? await loadSiteSourceForEdit(env, slug) : null,",
    "const pages = await loadSiteSourceForEdit(env, slug);",
  ]) assert.ok(W.includes(line), "an editing reader does not read through the repair: " + line);
  // CALL SITES, not the definition: the wrapper's own read, and the three
  // readers that answer a count, a listing or a delete and never publish.
  const bare = [...W.matchAll(/(?<!function )\bloadSiteSource\(env, [^)]*\)/g)].map((m) => m[0]);
  assert.equal(bare.length, 4, "a bare source read appeared or vanished — is it an editing reader? " + bare.join(" | "));
  const wrap = fnW("loadSiteSourceForEdit");
  assert.match(wrap, /try \{ await ensureEditableState\(env, slug\); \}\s+catch/, "the wrapper does not repair before it reads, or a failed check costs the read");
  assert.match(wrap, /return loadSiteSource\(env, slug\);/);
  // THE MARKER, LAST, ON EVERY COPY: the spine's, the build's, the restore's.
  const spine = fnW("recompileAndPublish");
  const marks = spine.indexOf("await saveLandmarks(env, slug, built.render && built.render.landmarks);");
  const head = spine.indexOf("await writeHead(buildDeps(env), slug, version);");
  assert.ok(marks > 0 && head > marks, "the spine's copy does not end with the marker");
  const buildPath = W.slice(W.indexOf("sourceStored = await saveSiteSource(env, slug, pages);"), W.indexOf("keep: (answer) => saveGenAnswer(env, slug, answer),"));
  assert.match(buildPath, /await saveSiteParts\(env, slug, partsBuilt\);\s+(?:\/\/[^\n]*\n\s*)*await writeHead\(buildDeps\(env\), slug, bVersion\);/, "the build's copy does not end with the marker");
  const restore = fnW("restoreVersion");
  const cfg = restore.indexOf("withConfig(cur.config, stateConfigOf(JSON.parse(b.config)))");
  const rh = restore.indexOf("await writeHead(deps, slug, id);");
  assert.ok(cfg > 0 && rh > cfg, "the restore's copy does not end with the marker");
  // THE REPAIR: the pointer read UNCACHED, the decision the module's, the
  // copy from the pointer's version into the two editable keys, the config
  // merged only on drift through the site's own patch, the cache kept.
  const fix = fnW("ensureEditableState");
  assert.match(fix, /pointer = await readPointer\(deps, slug\);/, "the repair reads the cached pointer — an older one would read as a copy that is ahead");
  assert.doesNotMatch(fix, /sitePointer\(/);
  assert.match(fix, /const need = repairNeeded\(\{ pointer, head \}\);/);
  assert.match(fix, /await repairEditable\(deps, \{ slug, version: pointer\.version, keys: \{ source: SOURCE_KEY\(slug\), parts: PARTS_KEY\(slug\) \}, mergeConfig \}\);/,
    "the repair does not copy into the editable keys from the pointer's version");
  assert.match(fix, /if \(sameJson\(repairConfigOf\(cur\.config\), want\)\) return false;/, "the config is written without drift");
  assert.match(fix, /const w = await patchSiteConfig\(env, slug, null, want\);/, "the config is not put back through the site's own patch");
  assert.doesNotMatch(fix, /langStrings/, "the repair names the translation cache");
  assert.match(fix, /buildPrefix\(slug, pointer\.version\) \+ STATE_DIR \+ "config\.json"/, "the config belt does not read the pointer's version");
});
