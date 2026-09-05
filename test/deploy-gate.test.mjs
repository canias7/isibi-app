// THE DEPLOY GATE, THE DRAIN, THE DOOR AND THE STALE SWEEP (stage 3a, 2026-09-05,
// owner: "ok go").
//
// A deploy rolls the Worker and the platform evicts the old isolates minutes
// later — run 17's queue invocation was cancelled nine minutes after a deploy
// with a customer's edit in flight. Now the deploy SETS A GATE (one row in
// private.platform_flags naming its sha, with an expiry) before anything
// rolls, passes the sha into the Worker as DEPLOY_ID, and DRAINS the live
// leases before `wrangler deploy`; a consumer names its deploy on every claim
// and is refused `deploy-gated` while a gate under another id stands — the
// isolate about to be evicted — counted and bounded exactly as a busy site; a
// claim that could not be read is deferred ONCE (a `tries` marker on the
// message); the look that collects a build asks the gate before touching its
// record; `/job/run` answers 503 while the container is stopping; and a
// queued row nobody picked up for ten minutes is sent again once by the sweep,
// then failed with the reason on it and a build's deposit given back.
//
// THE DATABASE HALF IS DRIVEN by scripts/edit-rpc-check.sql section 21 on the
// live database (28 checks, ALL 165 PASSED whole, rolled back), which this
// suite cannot reach. What this file guards is the RECORD of that (the
// migration, the snapshot equal to it, the check's order), the numbers both
// sides agree on, the workflow's three steps and the var, the deploy script
// DRIVEN with a fake fetch and clock, every consumer DRIVEN through the real
// queue handler, the stale sweep driven through the real export, and each
// Worker hop read where a read is honest.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hit, loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import {
  SITE_BUSY_DEFER_S, MAX_SITE_BUSY_DEFERRALS, LEASE_TTL_S, EDIT_JOB_KIND, EDIT_JOB_PREFIX, packEditJob, readEditMessage,
  DEPLOY_ID_RE, deployIdOf, unreadClaim, deferredClaim, CLAIM_RETRY_MAX, STALE_QUEUED_S,
} from "../builder/edit-job.mjs";
import { rowVerdict, BUSY_BUILD_MSG, GATED_BUILD_MSG, GATED_EDIT_MSG, STALE_BUILD_MSG, STALE_EDIT_MSG, FAILED_MSG, BUILD_OP } from "../builder/build-lease.mjs";
import { jobKey, resultKey, packJob, JOB_KIND, readMessage, readTries } from "../builder/build-job.mjs";
import { readResumeMessage, RESUME_KIND } from "../builder/build-resume.mjs";
import {
  readEnv, rpc, gateSet, drainWait, gateClear, main, DEFAULT_TTL_S, DRAIN_MAX_S, DRAIN_TICK_S, READ_FAILS_MAX, DEPLOY_ID_RE as SCRIPT_ID_RE,
} from "../.github/scripts/deploy-gate.mjs";

const DIR = new URL("../supabase/applied/", import.meta.url);
const FILE = fs.readdirSync(DIR).find((f) => /^\d{14}_deploy_gate_and_stale_sweep\.sql$/.test(f));
assert.ok(FILE, "the stage-3a migration is not in supabase/applied/");
const MIG = fs.readFileSync(new URL(FILE, DIR), "utf8");
const SNAP = fs.readFileSync(new URL("20260901222000_live_snapshot_edit_rpcs.sql", DIR), "utf8");
const CHECK = fs.readFileSync(new URL("../scripts/edit-rpc-check.sql", import.meta.url), "utf8");
const RAW = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const YML = fs.readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const SERVER = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
const HARNESS = fs.readFileSync(new URL("./integration/site-build.mjs", import.meta.url), "utf8");

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

/** One function's CREATE statement, header to closing dollar quote. */
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

const ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const ID2 = "b1b2c3d4e5f60718293a4b5c6d7e8f90";
const ID3 = "c1b2c3d4e5f60718293a4b5c6d7e8f90";
const ID4 = "d1b2c3d4e5f60718293a4b5c6d7e8f90";
const USER = { id: "11111111-2222-4333-8444-555555555555", email: "owner@example.test" };
const ENV_KEYS = { SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test" };
const SHA = "0123456789abcdef0123456789abcdef01234567";
const OLD = "fedcba9876543210fedcba9876543210fedcba98";
const SECRET = "0123456789abcdef0123456789abcdef";

/** Stub every fetch the Worker makes: GoTrue answers the owner, RPCs answer per name, the rest answers empty lists. */
function stubFetch(rpcAnswers, rpc) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json(USER);
    const m = u.match(/\/rest\/v1\/rpc\/(edit_\w+|rebuild_claim|credit_reverse|deploy_gate_\w+)/);
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

/** A bucket that remembers what it holds, and counts reads and deletes. */
function bucket(entries = {}) {
  const store = new Map(Object.entries(entries));
  const deleted = [];
  const gets = [];
  return {
    store, deleted, gets,
    async get(k) { gets.push(k); return store.has(k) ? { key: k, etag: "e-" + k, async text() { return store.get(k); }, async json() { return JSON.parse(store.get(k)); } } : null; },
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

// ── THE NUMBERS AND THE READERS ──────────────────────────────────────────────

test("the numbers: one cadence for every deferral, a retry once, a stale window a deferred message cannot reach, a gate that expires no later than a gated job gives up, a drain under the queue's fifteen minutes", () => {
  assert.equal(CLAIM_RETRY_MAX, 1, "a claim that cannot be read is asked again more, or less, than once");
  assert.ok(STALE_QUEUED_S >= 5 * SITE_BUSY_DEFER_S && STALE_QUEUED_S <= 1800, "the stale window is inside a deferral's reach, or past half an hour: " + STALE_QUEUED_S);
  assert.ok(DEFAULT_TTL_S <= MAX_SITE_BUSY_DEFERRALS * SITE_BUSY_DEFER_S, "a gate left standing outlives the wait a gated job is allowed");
  assert.ok(DEFAULT_TTL_S >= DRAIN_MAX_S + 600, "the gate could expire while the deploy it protects is still running");
  assert.ok(DRAIN_MAX_S < 900, "the drain waits past the queue's own fifteen minutes");
  assert.ok(DRAIN_TICK_S >= 5 && DRAIN_TICK_S <= 60 && READ_FAILS_MAX >= 2);
  assert.equal(SCRIPT_ID_RE.source, DEPLOY_ID_RE.source, "the script and the Worker read a deploy id two ways");
  // THE ONE CAP, for a busy site and a deploy's gate alike: the deferral body's
  // literal is the Worker's copy.
  const cap = /if deferred > (\d+) then/.exec(blankSql(fnBlock(MIG, "private.claim_deferred(")));
  assert.ok(cap, "the deferral body no longer gives up on a count");
  assert.equal(Number(cap[1]), MAX_SITE_BUSY_DEFERRALS, "the Worker's copy of the cap and the RPC's literal disagree");
});

test("a deploy id is the Worker's own or nothing; a claim answer is unreadable, deferred, or neither; the three messages carry `tries` and nothing else new", () => {
  assert.equal(deployIdOf({ DEPLOY_ID: SHA }), SHA);
  for (const bad of [undefined, "", "ab", "has space", ["x".repeat(8)], 7, "x".repeat(65), null]) assert.equal(deployIdOf({ DEPLOY_ID: bad }), "", JSON.stringify(bad));
  assert.equal(deployIdOf(null), "");
  for (const c of [null, undefined, { ok: false, error: "rpc" }, { ok: false, error: "rpc-shape" }]) assert.equal(unreadClaim(c), true, JSON.stringify(c));
  for (const c of [{ ok: false, error: "no-service-key" }, { ok: true, claimed: false, error: "leased" }, { ok: true, claimed: true }, { ok: false, claimed: false, error: "no-job" }]) assert.equal(unreadClaim(c), false, JSON.stringify(c));
  for (const c of [{ ok: true, claimed: false, error: "site-busy" }, { ok: true, claimed: false, error: "deploy-gated" }]) assert.equal(deferredClaim(c), true);
  for (const c of [null, { ok: true, claimed: true, error: "site-busy" }, { ok: true, claimed: false, error: "leased" }, { ok: false, error: "rpc" }]) assert.equal(deferredClaim(c), false, JSON.stringify(c));
  // ONE READER FOR THE COUNT: a small whole number rides, junk and absence do not.
  for (const [t, want] of [[0, 0], [1, 1], [9, 9], [10, undefined], [-1, undefined], ["1", undefined], [1.5, undefined], [undefined, undefined]]) assert.equal(readTries({ tries: t }), want, JSON.stringify(t));
  assert.deepEqual(readEditMessage({ kind: EDIT_JOB_KIND, id: ID }), { kind: EDIT_JOB_KIND, id: ID }, "a first delivery reads differently than before");
  assert.deepEqual(readEditMessage({ kind: EDIT_JOB_KIND, id: ID, tries: 1 }), { kind: EDIT_JOB_KIND, id: ID, tries: 1 });
  assert.deepEqual(readEditMessage({ kind: EDIT_JOB_KIND, id: ID, tries: "1" }), { kind: EDIT_JOB_KIND, id: ID }, "junk rode along");
  assert.deepEqual(readMessage({ kind: JOB_KIND, id: ID }), { id: ID });
  assert.deepEqual(readMessage({ kind: JOB_KIND, id: ID, tries: 2 }), { id: ID, tries: 2 });
  assert.deepEqual(readResumeMessage({ kind: RESUME_KIND, id: ID }), { id: ID });
  assert.deepEqual(readResumeMessage({ kind: RESUME_KIND, id: ID, tries: 1 }), { id: ID, tries: 1 });
});

test("a build row the claim failed under a deploy gate, or never picked up, answers its own sentence — never the build's, never the busy one", () => {
  const gated = rowVerdict({ state: "failed", slug: "fold-lane", job: ID, error: { kind: "deploy-gated", other: SHA } });
  assert.equal(gated.status, 410);
  assert.deepEqual(gated.body, { ok: false, failed: true, gated: true, stage: "queue", job: ID, msg: GATED_BUILD_MSG });
  const stale = rowVerdict({ state: "failed", slug: "", job: ID, error: { kind: "stale" } });
  assert.deepEqual(stale.body, { ok: false, failed: true, stale: true, stage: "queue", job: ID, msg: STALE_BUILD_MSG });
  assert.equal(rowVerdict({ state: "failed", job: ID, error: { kind: "site-busy" } }).body.msg, BUSY_BUILD_MSG);
  assert.equal(rowVerdict({ state: "failed", job: ID, error: { kind: "compile" } }).body.msg, FAILED_MSG);
  for (const m of [GATED_BUILD_MSG, GATED_EDIT_MSG, STALE_BUILD_MSG, STALE_EDIT_MSG]) assert.match(m, /nothing was charged/, "a sentence does not say the customer paid nothing");
});

// ── THE MIGRATION, THE SNAPSHOT AND THE CHECK ────────────────────────────────

test("the migration: the gate's row and its one comparison, one deferral body for both reasons, the claim asking the gate before the site's lock and re-created under its new signature with its grants, the three RPCs, the stale sweep's two looks", () => {
  const sql = blankSql(MIG);
  assert.match(sql, /create table if not exists private\.platform_flags \(\s+name text primary key,\s+deploy_id text,\s+started_at timestamp with time zone,\s+expires_at timestamp with time zone,/);
  assert.ok(sql.includes("revoke all on table private.platform_flags from public, anon, authenticated;"));
  const blocks = blankSql(fnBlock(MIG, "private.gate_blocks("));
  assert.match(blocks, /if p_deploy is null or p_deploy = '' then return null; end if;/, "a caller naming no deploy can be blocked");
  assert.match(blocks, /where f\.name = 'deploy' and f\.deploy_id is not null and f\.expires_at > now\(\);/, "an expired gate, or an empty one, blocks");
  assert.match(blocks, /if g is null or g = p_deploy then return null; end if;\s+return g;/, "the gate's own deploy is blocked, or a foreign one is not");
  const def = blankSql(fnBlock(MIG, "private.claim_deferred("));
  const count = def.indexOf("update public.edit_jobs set deferrals = deferrals + 1, phase = 'waiting', updated_at = now()");
  const cap = def.indexOf("if deferred > 45 then");
  const give = def.indexOf("res := public.edit_refund(p_id, 'failed', note, p_mint);");
  const reason = def.indexOf("set error = jsonb_build_object('kind', p_kind, 'phase', 'queued', 'other', p_other, 'deferrals', deferred),");
  assert.ok(count > 0 && cap > count && give > cap && reason > give, "the deferral is not: count, the cap, the refund, the reason on the row");
  assert.match(def, /note := case p_kind when 'site-busy' then 'the site was busy for the whole wait' else 'the platform was updating for the whole wait' end;/, "the two reasons do not say their own sentence");
  assert.match(def, /'error', p_kind, 'gave_up', true,/);
  assert.match(def, /'error', p_kind, 'gave_up', false,/);
  const claim = blankSql(fnBlock(MIG, "public.edit_claim("));
  assert.match(claim, /^CREATE OR REPLACE FUNCTION public\.edit_claim\(p_id text, p_owner text, p_ttl integer, p_mint text, p_deploy text DEFAULT NULL::text\)/, "the claim does not take the deploy id, defaulted");
  const own = claim.indexOf("if j.needs_review or j.state in ('done','failed','cancelled','lost')");
  const gate = claim.indexOf("other := private.gate_blocks(p_deploy);");
  const gated = claim.indexOf("if other is not null then return private.claim_deferred(p_id, 'deploy-gated', other, j.state, p_mint); end if;");
  const site = claim.indexOf("other := private.site_busy(j.slug, p_id);");
  const busy = claim.indexOf("if other is not null then return private.claim_deferred(p_id, 'site-busy', other, j.state, p_mint); end if;");
  const take = claim.indexOf("set lease_owner = p_owner,");
  assert.ok(own > 0 && gate > own && gated > gate && site > gated && busy > site && take > busy,
    "the claim's order is not: the row's own answers, the gate, the site's lock, the lease — each refusal through the one deferral body");
  // DROPPED AND RE-CREATED, with the grants re-issued for the new signature: a
  // CREATE OR REPLACE with a new parameter leaves the old overload beside it.
  const drop = sql.indexOf("drop function if exists public.edit_claim(text, text, integer, text);");
  const create = sql.indexOf("CREATE OR REPLACE FUNCTION public.edit_claim(");
  assert.ok(drop > 0 && create > drop, "the old four-argument claim is not dropped before the new one is created");
  assert.ok(sql.includes("revoke all on function public.edit_claim(text, text, integer, text, text) from public, anon, authenticated;"));
  assert.ok(sql.includes("grant execute on function public.edit_claim(text, text, integer, text, text) to service_role;"));
  const set = blankSql(fnBlock(MIG, "public.deploy_gate_set("));
  assert.match(set, /if p_deploy_id is null or p_deploy_id !~ '\^\[A-Za-z0-9\._-\]\{4,64\}\$' then raise exception 'bad deploy id'; end if;/);
  assert.match(set, /if p_ttl is null or p_ttl < 60 or p_ttl > 7200 then raise exception 'bad ttl'; end if;/);
  assert.match(set, /on conflict \(name\) do update\s+set deploy_id = excluded\.deploy_id, started_at = excluded\.started_at, expires_at = excluded\.expires_at, updated_at = now\(\);/, "the newest deploy does not overwrite");
  assert.match(set, /'previous', prev, 'previous_active', prev is not null and prev_until > now\(\)\);/, "what stood before is not answered");
  const clear = blankSql(fnBlock(MIG, "public.deploy_gate_clear("));
  assert.match(clear, /where name = 'deploy' and deploy_id = p_deploy_id;/, "a clear clears a gate that is not its own");
  assert.match(clear, /return jsonb_build_object\('ok', true, 'cleared', false, 'holder', holder\);/);
  const read = blankSql(fnBlock(MIG, "public.deploy_gate_read("));
  assert.match(read, /where state not in \('done','failed','cancelled','lost'\) and lease_expires_at > now\(\);/, "the live count is not the live leases");
  assert.match(read, /'blocks', private\.gate_blocks\(p_deploy\) is not null,/, "the reader does not answer through the one comparison");
  const stale = blankSql(fnBlock(MIG, "public.edit_sweep_stale("));
  assert.match(stale, /where state = 'queued' and lease_owner is null and needs_review = false\s+and billing not in \('finalized','refunded'\)\s+and updated_at < now\(\) - make_interval\(secs => p_after\)/, "the stale select is not: queued, no lease, untouched for the window");
  const second = stale.indexOf("if r.phase = 'stale' then");
  const fail = stale.indexOf("res := public.edit_refund(r.id, 'failed', 'never picked up', p_mint);");
  const mark = stale.indexOf("update public.edit_jobs set phase = 'stale', deferrals = deferrals + 1, updated_at = now()");
  assert.ok(second > 0 && fail > second && mark > fail, "the sweep does not fail a row marked on the look before, and mark the rest");
  assert.match(stale, /set error = jsonb_build_object\('kind', 'stale', 'phase', 'queued', 'deferrals', r\.deferrals\), updated_at = now\(\)\s+where id = r\.id and state = 'failed';/);
  assert.match(stale, /failed := failed \|\| jsonb_build_object\('id', r\.id, 'op', r\.op, 'uid', r\.uid, 'slug', r\.slug\);/, "a failed row does not say whose it is");
  for (const f of ["public.deploy_gate_set(text, integer, text)", "public.deploy_gate_clear(text, text)", "public.deploy_gate_read(text, text)", "public.edit_sweep_stale(integer, integer, text)"]) {
    assert.ok(sql.includes(`revoke all on function ${f} from public, anon, authenticated;`), f + " is not revoked from callers");
    assert.ok(sql.includes(`grant execute on function ${f} to service_role;`), f + " is not the service's");
  }
  for (const f of ["private.gate_blocks(text)", "private.claim_deferred(text, text, text, text, text)"]) {
    assert.ok(sql.includes(`revoke all on function ${f} from public, anon, authenticated;`), f + " is not revoked from callers");
    assert.ok(!sql.includes(`grant execute on function ${f}`), f + " is granted to a caller");
  }
});

test("the live snapshot carries the seven functions byte for byte as the migration applied them, and its header says so", () => {
  for (const q of ["public.edit_claim(", "private.gate_blocks(", "private.claim_deferred(", "public.deploy_gate_set(", "public.deploy_gate_clear(", "public.deploy_gate_read(", "public.edit_sweep_stale("]) {
    assert.equal(fnBlock(SNAP, q), fnBlock(MIG, q), "the snapshot's " + q + " differs from the migration");
  }
  assert.match(SNAP, /stage 3a, migration \d{14}_deploy_gate_and_stale_sweep\),\s*-- edit_claim REPLACED IN PLACE under a new signature \(p_deploy\)/, "the snapshot's header does not record the change");
});

test("the check drives it: the gate set, read three ways, an older deploy refused and counted, the new one and no id claiming, the same cap with its own reason, a stranger's clear leaving it, expiry, overwrite, the live count, the stale sweep's two looks, the grants", () => {
  const s21 = CHECK.indexOf("21. THE DEPLOY GATE AND THE STALE SWEEP (stage 3a)");
  const restore = CHECK.indexOf("update private.mint set key_hash = keep;");
  assert.ok(s21 > 0 && restore > s21, "section 21 is gone, or sits after the mint restore");
  const sec = CHECK.slice(s21, restore);
  const order = [
    "delete from private.platform_flags where name = 'deploy';",
    "public.edit_claim(j21, 'ownerAAAA', 90, k, 'sha-old-0001')",
    "'FAIL 90 (a claim naming a deploy could not claim with no gate set)",
    "public.deploy_gate_set('sha-new-0002', 2700, k)",
    "'FAIL 90c (the gate does not read as blocking an older deploy)",
    "'FAIL 90d (the gate blocks its own deploy)",
    "'FAIL 90e (a reader naming no deploy is blocked, or the gate reads inactive)",
    "'FAIL 91 (an older deploy claimed under a newer deploy''s gate, or the refusal was not counted)",
    "'FAIL 91b (the gated refusal was not counted on the row)",
    "'FAIL 91c (the gate''s own deploy could not claim through it)",
    "'FAIL 91d (a claim naming no deploy was gated)",
    "update public.edit_jobs set deferrals = 45 where id = j21;",
    "'FAIL 92 (the gated cap did not fail the row with its reason)",
    "'FAIL 92b (money moved on a gated give-up)",
    "public.deploy_gate_clear('sha-other-0003', k)",
    "'FAIL 93 (a clear under another id cleared the gate, or did not name the holder)",
    "'FAIL 93c (the gate''s own id could not clear it)",
    "'FAIL 94 (an expired gate still blocks)",
    "'FAIL 94b (the newest deploy did not overwrite, or misreads what it replaced)",
    "'FAIL 94d (an overwritten deploy''s clear released the newer gate)",
    "'FAIL 95 (the live-lease count does not follow the leases)",
    "public.edit_sweep_stale(600, 20, k)",
    "'FAIL 96 (a stale queued row was not handed back to be sent again)",
    "'FAIL 96b (a stale row was not marked and counted, or moved)",
    "'FAIL 96c (a row just sent again was picked again inside the window)",
    "'FAIL 97 (a row sent again and still untouched was not failed, or the answer does not say whose)",
    "'FAIL 97c (money moved on a stale failure)",
    "'FAIL 98 (a fresh queued row or a claimed row was swept as stale)",
    "'FAIL 99 (a gate RPC, the stale sweep or the claim is granted to a caller)",
    "ok_count := ok_count + 28;",
  ];
  let last = -1;
  for (const step of order) {
    const at = sec.indexOf(step);
    assert.ok(at > last, `section 21 is missing or reorders: ${step}`);
    last = at;
  }
  // THE MONEY IS READ around the give-up and the stale failure — a check that
  // never read the balance would pass a refund that paid.
  assert.match(sec, /select balance into b1 from public\.credits where user_id = u;\s+r := public\.edit_claim\(j21, 'ownerAAAA', 90, k, 'sha-old-0001'\);/);
  assert.match(sec, /if \(select balance from public\.credits where user_id = u\) <> b1 then raise exception 'FAIL 97c/);
  assert.match(CHECK, /\(stage 3a\): ALL 165 CHECKS PASSED/, "the header does not record the run");
});

// ── THE WORKFLOW: THREE STEPS AND A VAR ──────────────────────────────────────

test("deploy.yml: the gate is set before the images, drained before the deploy, cleared `if: always()` after it with the job's outcome; the deploy binds DEPLOY_ID as a var, never a secret; every gate step names the sha", () => {
  const steps = [...YML.matchAll(/^      - name: (.+)$/gm)].map((m) => m[1]);
  const at = (name) => { const i = steps.indexOf(name); assert.ok(i >= 0, "no step named " + name); return i; };
  const set = at("deploy gate (set)");
  const images = at("container images (built only when their inputs changed)");
  const drain = at("deploy gate (drain)");
  const deploy = at("Deploy with Wrangler");
  const clear = at("deploy gate (clear on failure)");
  assert.ok(set < images && images < drain && drain < deploy && deploy < clear, "the steps are not: set, images, drain, deploy, clear — got " + steps.join(" | "));
  const block = (name, next) => YML.slice(YML.indexOf("- name: " + name), next ? YML.indexOf("- name: " + next) : YML.length);
  for (const [name, verb, next] of [["deploy gate (set)", "set", "container images (built only when their inputs changed)"], ["deploy gate (drain)", "drain", "Deploy with Wrangler"], ["deploy gate (clear on failure)", "clear", "custom domains status (report only)"]]) {
    const b = block(name, next);
    assert.match(b, new RegExp("run: node \\.github/scripts/deploy-gate\\.mjs " + verb + "\\n"), name + " does not run the script's " + verb);
    assert.match(b, /SUPABASE_SERVICE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_KEY \}\}/, name + " has no service key");
    assert.match(b, /CREDITS_MINT_SECRET: \$\{\{ secrets\.CREDITS_MINT_SECRET \}\}/, name + " has no mint");
    assert.match(b, /DEPLOY_ID: \$\{\{ github\.sha \}\}/, name + " does not name the sha");
  }
  const clr = block("deploy gate (clear on failure)", "custom domains status (report only)");
  assert.match(clr, /if: always\(\)/, "the clear does not run on a failed or cancelled deploy");
  assert.match(clr, /DEPLOY_OUTCOME: \$\{\{ job\.status \}\}/, "the clear is not told the deploy's outcome");
  const dep = block("Deploy with Wrangler", "deploy gate (clear on failure)");
  assert.match(dep, /vars: \|\n            DEPLOY_ID\n/, "DEPLOY_ID is not bound as a var");
  assert.match(dep, /env:\n          DEPLOY_ID: \$\{\{ github\.sha \}\}\n/, "the var has no value");
  const secrets = dep.slice(dep.indexOf("secrets: |"), dep.indexOf("env:"));
  assert.ok(!/DEPLOY_ID/.test(secrets), "DEPLOY_ID is uploaded as a secret — after the deploy, which would leave the new code carrying the old sha");
  // The RUN lines, not every mention: the set step's own comment names the
  // script, which is the recorded "prose contains the thing it forbids".
  assert.equal((YML.match(/run: node \.github\/scripts\/deploy-gate\.mjs /g) || []).length, 3, "the script is run more or fewer than three times");
});

// ── THE SCRIPT, DRIVEN ───────────────────────────────────────────────────────

const CFG_ENV = { SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint", DEPLOY_ID: SHA };

/** A fetch that answers RPCs by name and records them. */
function fakeFetch(answers, calls) {
  return async (url, init) => {
    const fn = String(url).split("/rpc/")[1];
    const args = JSON.parse(init.body);
    calls.push({ fn, args, auth: init.headers.Authorization });
    const a = typeof answers[fn] === "function" ? answers[fn](args) : answers[fn];
    if (a === undefined) return { ok: false, status: 500, async json() { return null; } };
    if (a && a.__status) return { ok: false, status: a.__status, async json() { return null; } };
    return { ok: true, status: 200, async json() { return a; } };
  };
}

test("readEnv: the pieces named, a deploy id in its shape, the ttl and the drain bounded, the outcome lowercased", () => {
  const c = readEnv(CFG_ENV);
  assert.deepEqual(c.missing, []);
  assert.equal(c.deployId, SHA);
  assert.equal(c.ttl, DEFAULT_TTL_S);
  assert.equal(c.maxS, DRAIN_MAX_S);
  assert.equal(c.url, "https://ujrqdmmtcptvimazlhom.supabase.co");
  assert.deepEqual(readEnv({}).missing, ["SUPABASE_SERVICE_KEY", "CREDITS_MINT_SECRET", "DEPLOY_ID"]);
  assert.equal(readEnv({ ...CFG_ENV, DEPLOY_ID: "bad id" }).deployId, "");
  assert.equal(readEnv({ ...CFG_ENV, DEPLOY_GATE_TTL_S: "30" }).ttl, DEFAULT_TTL_S, "a ttl under a minute was taken");
  assert.equal(readEnv({ ...CFG_ENV, DEPLOY_GATE_TTL_S: "600" }).ttl, 600);
  assert.equal(readEnv({ ...CFG_ENV, DRAIN_MAX_S: "0" }).maxS, 0);
  assert.equal(readEnv({ ...CFG_ENV, DEPLOY_OUTCOME: "Success" }).outcome, "success");
  assert.equal(readEnv({ ...CFG_ENV, SUPABASE_URL: "https://x.test/" }).url, "https://x.test");
});

test("rpc: the mint rides the body and the key the headers; a refusal keeps only its status, an answer without ok is not ok, a throw is an error", async () => {
  const calls = [];
  const f = fakeFetch({ deploy_gate_set: { ok: true, deploy_id: SHA }, bad: { __status: 401 }, shape: { hello: 1 } }, calls);
  const good = await rpc("deploy_gate_set", { p_deploy_id: SHA }, { url: "https://x.test", key: "k", mint: "m", fetch: f });
  assert.equal(good.ok, true);
  assert.deepEqual(calls[0], { fn: "deploy_gate_set", args: { p_deploy_id: SHA, p_mint: "m" }, auth: "Bearer k" });
  const bad = await rpc("bad", {}, { url: "https://x.test", key: "k", mint: "m", fetch: f });
  assert.deepEqual(bad, { ok: false, status: 401, body: null });
  assert.equal((await rpc("shape", {}, { url: "https://x.test", key: "k", mint: "m", fetch: f })).ok, false);
  const threw = await rpc("x", {}, { url: "https://x.test", key: "k", mint: "m", fetch: async () => { throw new TypeError("down"); } });
  assert.equal(threw.ok, false);
  assert.equal(threw.status, 0);
  assert.equal(threw.error, "TypeError");
});

test("set: names this deploy for the ttl and says what it took over from; a missing piece or a refusal sets nothing and never throws", async () => {
  const calls = []; const log = [];
  const r = await gateSet(readEnv(CFG_ENV), { fetch: fakeFetch({ deploy_gate_set: { ok: true, deploy_id: SHA, expires_at: "2026-09-05T22:00:00Z", previous: OLD, previous_active: true } }, calls), log: (m) => log.push(m) });
  assert.deepEqual(r, { set: true, previous: OLD, previousActive: true });
  assert.deepEqual(calls.map((c) => [c.fn, c.args.p_deploy_id, c.args.p_ttl]), [["deploy_gate_set", SHA, DEFAULT_TTL_S]]);
  assert.match(log[0], /set for .* until 2026-09-05T22:00:00Z \(took over from .*, which was still live\)/);
  const missing = [];
  assert.deepEqual(await gateSet(readEnv({}), { fetch: fakeFetch({}, missing), log: () => {} }), { set: false, why: "missing" });
  assert.deepEqual(missing, [], "a step with no credentials reached for the database");
  const refused = await gateSet(readEnv(CFG_ENV), { fetch: fakeFetch({ deploy_gate_set: { __status: 500 } }, []), log: (m) => log.push(m) });
  assert.deepEqual(refused, { set: false, why: "rpc" });
  assert.match(log[log.length - 1], /NOT SET .* 500; this deploy rolls ungated/);
});

test("drain: waits for the live leases to reach zero, deploys REGARDLESS when the clock runs out, and after three unreadable looks; the read names no deploy", async () => {
  const mk = (lives, maxS = DRAIN_MAX_S) => {
    let t = 0; const calls = []; const log = []; let i = 0;
    const f = fakeFetch({ deploy_gate_read: () => { const live = lives[Math.min(i++, lives.length - 1)]; return live === null ? { __status: 503 } : { ok: true, live, rows: [{ slug: "fold-lane", state: "editing", left_s: 40 }] }; } }, calls);
    const cfg = readEnv({ ...CFG_ENV, DRAIN_MAX_S: String(maxS) });
    return { run: () => drainWait(cfg, { fetch: f, log: (m) => log.push(m), now: () => t, sleep: async (ms) => { t += ms; } }), calls, log, t: () => t };
  };
  const zero = mk([2, 1, 0]);
  assert.deepEqual(await zero.run(), { drained: true, why: "zero", waitedS: 2 * DRAIN_TICK_S, looks: 3 });
  assert.ok(zero.calls.every((c) => c.fn === "deploy_gate_read" && c.args.p_deploy === null), "the drain's read names a deploy, or is not the read");
  assert.match(zero.log[0], /2 live leases after 0s — fold-lane editing \(40s left\)/);
  const time = mk([1], 60);
  const out = await time.run();
  assert.equal(out.why, "time");
  assert.equal(out.drained, false);
  assert.ok(out.waitedS <= 60 && out.looks <= Math.ceil(60 / DRAIN_TICK_S) + 1, JSON.stringify(out));
  assert.match(time.log[time.log.length - 1], /deploying REGARDLESS/);
  const unread = mk([null, null, null, 0]);
  assert.deepEqual((await unread.run()).why, "unread");
  assert.equal(unread.calls.length, READ_FAILS_MAX, "the drain kept asking a database that would not answer");
  const flaky = mk([null, 1, null, 0]);
  assert.equal((await flaky.run()).why, "zero", "one unreadable look, answered on the next, was counted as three");
  assert.deepEqual(await drainWait(readEnv({ DEPLOY_ID: SHA }), { fetch: fakeFetch({}, []), log: () => {} }), { drained: false, why: "missing", waitedS: 0, looks: 0 });
});

test("clear: leaves the gate on success without touching the database; clears its own id after a failure or a cancellation; says so when the gate is somebody else's", async () => {
  const calls = []; const log = [];
  const ok = await gateClear(readEnv({ ...CFG_ENV, DEPLOY_OUTCOME: "success" }), { fetch: fakeFetch({}, calls), log: (m) => log.push(m) });
  assert.deepEqual(ok, { cleared: false, why: "success" });
  assert.deepEqual(calls, [], "a successful deploy cleared its gate — the old isolates would claim again while they are still being delivered to");
  for (const outcome of ["failure", "cancelled"]) {
    const c2 = [];
    const r = await gateClear(readEnv({ ...CFG_ENV, DEPLOY_OUTCOME: outcome }), { fetch: fakeFetch({ deploy_gate_clear: { ok: true, cleared: true } }, c2), log: (m) => log.push(m) });
    assert.deepEqual(r, { cleared: true, why: outcome });
    assert.deepEqual(c2.map((c) => [c.fn, c.args.p_deploy_id]), [["deploy_gate_clear", SHA]]);
  }
  const other = await gateClear(readEnv({ ...CFG_ENV, DEPLOY_OUTCOME: "failure" }), { fetch: fakeFetch({ deploy_gate_clear: { ok: true, cleared: false, holder: OLD } }, []), log: (m) => log.push(m) });
  assert.deepEqual(other, { cleared: false, why: "other" });
  assert.match(log[log.length - 1], /was not the gate's \(.* holds it\)/);
  assert.deepEqual(await gateClear(readEnv({ DEPLOY_OUTCOME: "failure" }), { fetch: fakeFetch({}, []), log: () => {} }), { cleared: false, why: "missing" });
  assert.deepEqual(await gateClear(readEnv({ ...CFG_ENV, DEPLOY_OUTCOME: "failure" }), { fetch: fakeFetch({ deploy_gate_clear: { __status: 500 } }, []), log: () => {} }), { cleared: false, why: "rpc" });
});

test("main: the three verbs, and an unknown one does nothing", async () => {
  const calls = [];
  const deps = { fetch: fakeFetch({ deploy_gate_set: { ok: true, deploy_id: SHA, expires_at: "x" }, deploy_gate_read: { ok: true, live: 0, rows: [] }, deploy_gate_clear: { ok: true, cleared: true } }, calls), log: () => {}, now: () => 0, sleep: async () => {} };
  assert.equal((await main(["set"], CFG_ENV, deps)).set, true);
  assert.equal((await main(["drain"], CFG_ENV, deps)).drained, true);
  assert.equal((await main(["clear"], { ...CFG_ENV, DEPLOY_OUTCOME: "failure" }, deps)).cleared, true);
  assert.deepEqual(calls.map((c) => c.fn), ["deploy_gate_set", "deploy_gate_read", "deploy_gate_clear"]);
  assert.deepEqual(await main(["reboot"], CFG_ENV, deps), { why: "verb" });
});

// ── DRIVEN: THE EDIT CONSUMER UNDER THE GATE ─────────────────────────────────

async function driveEdit(claimAnswer, { env = {}, rpcAnswers = {}, tries } = {}) {
  const b = bucket({ [EDIT_JOB_PREFIX + ID]: EDIT_JOB() });
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

test("the consumer names its deploy on the claim when it has one, and nothing when it has none", async () => {
  const named = await driveEdit({ ok: true, claimed: false, error: "leased", state: "routing" }, { env: { DEPLOY_ID: SHA } });
  assert.deepEqual(named.rpc[0], { fn: "edit_claim", args: { p_id: ID, p_owner: named.rpc[0].args.p_owner, p_ttl: LEASE_TTL_S, p_deploy: SHA } });
  const bare = await driveEdit({ ok: true, claimed: false, error: "leased", state: "routing" });
  assert.equal("p_deploy" in bare.rpc[0].args, false, "a Worker with no deploy id named one");
  const junk = await driveEdit({ ok: true, claimed: false, error: "leased", state: "routing" }, { env: { DEPLOY_ID: "not a sha" } });
  assert.equal("p_deploy" in junk.rpc[0].args, false, "a value that is not a deploy id was sent as one");
});

test("a claim refused for a newer deploy's gate re-sends the consumer's own message with the delay and runs nothing; the refusal past the cap stores the gated sentence", async () => {
  const r = await driveEdit({ ok: true, claimed: false, error: "deploy-gated", gave_up: false, other: SHA, deferrals: 3, state: "queued" }, { env: { DEPLOY_ID: OLD } });
  assert.equal(r.acked, 1);
  assert.deepEqual(r.fns, ["edit_claim"], "the consumer did more than claim under the gate");
  assert.deepEqual(r.q.sent, [{ msg: { kind: EDIT_JOB_KIND, id: ID }, opts: { delaySeconds: SITE_BUSY_DEFER_S } }], "the message was not re-sent with the delay");
  assert.equal(r.b.store.has(EDIT_JOB_PREFIX + ID), true, "the stored request was taken");
  const gave = await driveEdit({ ok: true, claimed: false, error: "deploy-gated", gave_up: true, other: SHA, deferrals: 46, state: "failed", refund: { ok: true, refunded: 0 } }, { env: { DEPLOY_ID: OLD } });
  assert.deepEqual(gave.fns, ["edit_claim", "edit_finalize"]);
  const fin = gave.rpc[1].args;
  assert.equal(fin.p_ok, false);
  assert.equal(fin.p_result.status, 409);
  assert.deepEqual(JSON.parse(fin.p_result.body), { ok: false, error: "deploy-gated", job: ID, deferrals: 46, msg: GATED_EDIT_MSG });
  assert.deepEqual(gave.q.sent, [], "a job the RPC gave up on was re-sent");
});

test("a claim that could not be read is sent again once, carrying `tries`; the second time it is left queued, said, and acked", async () => {
  for (const answer of [{ ok: false, error: "rpc", status: 503 }, { ok: false, error: "rpc-shape" }]) {
    const first = await driveEdit(answer, { env: { DEPLOY_ID: SHA } });
    assert.equal(first.acked, 1);
    assert.deepEqual(first.fns, ["edit_claim"]);
    assert.deepEqual(first.q.sent, [{ msg: { kind: EDIT_JOB_KIND, id: ID, tries: 1 }, opts: { delaySeconds: SITE_BUSY_DEFER_S } }], JSON.stringify(answer) + " was not deferred once");
    assert.equal(first.b.store.has(EDIT_JOB_PREFIX + ID), true, "the stored request was taken");
  }
  const second = await driveEdit({ ok: false, error: "rpc", status: 503 }, { env: { DEPLOY_ID: SHA }, tries: 1 });
  assert.equal(second.acked, 1);
  assert.deepEqual(second.fns, ["edit_claim"]);
  assert.deepEqual(second.q.sent, [], "a second unreadable claim was re-sent again — the retry is not once");
  assert.equal(second.b.store.has(EDIT_JOB_PREFIX + ID), true, "the request was deleted on a claim that never landed");
});

// ── DRIVEN: THE BUILD CONSUMER AND THE COLLECTOR UNDER THE GATE ──────────────

async function driveBuild(claimAnswer, { env = {}, tries, rpcAnswers = {} } = {}) {
  const b = bucket({ [jobKey(ID)]: JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: JSON.stringify({ brief: "a coffee shop", slug: "fold-lane" }), uid: USER.id, at: 1 })) });
  const q = queue();
  const rpc = [];
  const restore = stubFetch({
    edit_claim: claimAnswer, edit_beat: { ok: true, alive: true }, edit_refund: { ok: true, refunded: 0, billing: "external" },
    edit_finalize: { ok: true, billing: "external" }, edit_handoff: { ok: true },
    credit_reverse: { ok: true, refunded: 2, debited: 2, already: 0, repeat: false }, ...rpcAnswers,
  }, rpc);
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: JOB_KIND, id: ID, ...(tries === undefined ? {} : { tries }) }, ack() {} }] }, { ...ENV_KEYS, SITES_BUCKET: b, BUILD_QUEUE: q, ...env }, ctx);
    await Promise.allSettled(ctx.pending);
    const out = b.store.get(resultKey(ID));
    return { b, q, rpc, fns: rpc.map((x) => x.fn), out: out ? JSON.parse(out) : null };
  } finally { restore(); }
}

test("a build refused for a newer deploy's gate puts its object back and re-sends its message; past the cap the deposit comes back under its own reason and the answer is the gated sentence", async () => {
  const r = await driveBuild({ ok: true, claimed: false, error: "deploy-gated", gave_up: false, other: SHA, deferrals: 1, state: "queued" }, { env: { DEPLOY_ID: OLD } });
  assert.deepEqual(r.fns, ["edit_claim"], "the consumer did more than claim under the gate");
  assert.equal(r.rpc[0].args.p_deploy, OLD, "the build's claim did not name its deploy");
  assert.equal(r.b.store.has(jobKey(ID)), true, "the object was not put back");
  assert.deepEqual(r.q.sent, [{ msg: { kind: JOB_KIND, id: ID }, opts: { delaySeconds: SITE_BUSY_DEFER_S } }]);
  assert.equal(r.out, null, "a deferred build wrote an answer");
  const gave = await driveBuild({ ok: true, claimed: false, error: "deploy-gated", gave_up: true, other: SHA, deferrals: 46, state: "failed" }, { env: { DEPLOY_ID: OLD } });
  assert.deepEqual(gave.fns, ["edit_claim", "credit_reverse"]);
  assert.deepEqual(gave.rpc[1].args, { p_target: USER.id, p_ref: "build:" + ID + ":deposit", p_reason: "gated", p_amount: gave.rpc[1].args.p_amount });
  assert.ok(gave.rpc[1].args.p_amount > 0);
  assert.equal(gave.out.status, 409);
  assert.deepEqual(JSON.parse(gave.out.body), { ok: false, stage: "queue", error: "deploy-gated", job: ID, deferrals: 46, refunded: 2, msg: GATED_BUILD_MSG });
  assert.deepEqual(gave.q.sent, []);
});

test("a build whose claim could not be read is asked again once — the object back, the message carrying `tries` — and builds the second time", async () => {
  const first = await driveBuild({ ok: false, error: "rpc", status: 503 }, { env: { DEPLOY_ID: SHA } });
  assert.deepEqual(first.fns, ["edit_claim"]);
  assert.equal(first.b.store.has(jobKey(ID)), true, "the object was not put back");
  assert.deepEqual(first.q.sent, [{ msg: { kind: JOB_KIND, id: ID, tries: 1 }, opts: { delaySeconds: SITE_BUSY_DEFER_S } }]);
  assert.equal(first.out, null);
  const second = await driveBuild({ ok: false, error: "rpc", status: 503 }, { env: { DEPLOY_ID: SHA }, tries: 1 });
  assert.deepEqual(second.q.sent, [], "a second unreadable claim was deferred again");
  assert.equal(second.b.store.has(jobKey(ID)), false, "the build did not go on: the object is still there");
  assert.ok(second.out, "the build did not run to an answer");
});

async function driveResume({ env = {}, tries, gateAnswer } = {}) {
  const b = bucket({});
  const q = queue();
  const rpc = [];
  const restore = stubFetch({ ...(gateAnswer === undefined ? {} : { deploy_gate_read: gateAnswer }) }, rpc);
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: RESUME_KIND, id: ID, ...(tries === undefined ? {} : { tries }) }, ack() {} }] }, { ...ENV_KEYS, SITES_BUCKET: b, BUILD_QUEUE: q, ...env }, ctx);
    await Promise.allSettled(ctx.pending);
    return { b, q, rpc, fns: rpc.map((x) => x.fn) };
  } finally { restore(); }
}

test("the look that collects a build asks the gate before touching its record: blocked, it re-sends itself with the delay; unreadable, once; open or nameless, it goes on", async () => {
  const blocked = await driveResume({ env: { DEPLOY_ID: OLD }, gateAnswer: { ok: true, active: true, deploy_id: SHA, blocks: true, live: 1, rows: [] } });
  assert.deepEqual(blocked.fns, ["deploy_gate_read"]);
  assert.equal(blocked.rpc[0].args.p_deploy, OLD, "the look did not name its own deploy");
  assert.deepEqual(blocked.q.sent, [{ msg: { kind: RESUME_KIND, id: ID }, opts: { delaySeconds: SITE_BUSY_DEFER_S } }]);
  assert.deepEqual(blocked.b.gets, [], "a blocked look touched its record");
  const open = await driveResume({ env: { DEPLOY_ID: SHA }, gateAnswer: { ok: true, active: true, deploy_id: SHA, blocks: false, live: 1, rows: [] } });
  assert.deepEqual(open.q.sent, []);
  assert.ok(open.b.gets.length >= 1, "an open gate stopped the look from reading its record");
  const unread = await driveResume({ env: { DEPLOY_ID: SHA } });
  assert.deepEqual(unread.fns, ["deploy_gate_read"]);
  assert.deepEqual(unread.q.sent, [{ msg: { kind: RESUME_KIND, id: ID, tries: 1 }, opts: { delaySeconds: SITE_BUSY_DEFER_S } }], "an unreadable gate did not defer the look once");
  assert.deepEqual(unread.b.gets, []);
  const twice = await driveResume({ env: { DEPLOY_ID: SHA }, tries: 1 });
  assert.deepEqual(twice.q.sent, [], "a second unreadable gate deferred the look again");
  assert.ok(twice.b.gets.length >= 1, "the look did not go on the second time");
  const nameless = await driveResume({});
  assert.deepEqual(nameless.fns, [], "a Worker with no deploy id asked the gate");
  assert.ok(nameless.b.gets.length >= 1);
});

// ── DRIVEN: THE STALE SWEEP ──────────────────────────────────────────────────

test("the stale sweep sends a queued row's own message again, now; a failed edit gets the stale sentence stored, a failed build its deposit back and the sentence as its answer", async () => {
  const b = bucket({});
  const q = queue();
  const rpc = [];
  const restore = stubFetch({
    edit_sweep_stale: { ok: true, resend: [{ id: ID, op: "edit" }, { id: ID2, op: "build" }, { id: "", op: "edit" }], failed: [{ id: ID3, op: "addon", uid: USER.id, slug: "fold-lane" }, { id: ID4, op: BUILD_OP, uid: USER.id, slug: "build:" + ID4 }] },
    edit_finalize: { ok: true }, credit_reverse: { ok: true, refunded: 2, debited: 2, already: 0, repeat: false },
  }, rpc);
  try {
    const mod = await loadWorkerModule();
    await mod.runStaleEditJobs({ ...ENV_KEYS, SITES_BUCKET: b, BUILD_QUEUE: q });
    assert.deepEqual(q.sent, [{ msg: { kind: EDIT_JOB_KIND, id: ID }, opts: null }, { msg: { kind: JOB_KIND, id: ID2 }, opts: null }], "the rows were not sent again as their own messages, now");
    const fin = rpc.find((x) => x.fn === "edit_finalize");
    assert.ok(fin, "the failed edit's sentence was not stored");
    assert.equal(fin.args.p_id, ID3);
    assert.equal(fin.args.p_ok, false);
    assert.deepEqual(JSON.parse(fin.args.p_result.body), { ok: false, error: "stale", job: ID3, msg: STALE_EDIT_MSG });
    const rev = rpc.find((x) => x.fn === "credit_reverse");
    assert.ok(rev, "the failed build's deposit was not given back");
    assert.equal(rev.args.p_target, USER.id);
    assert.equal(rev.args.p_ref, "build:" + ID4 + ":deposit");
    assert.equal(rev.args.p_reason, "stale");
    const out = JSON.parse(b.store.get(resultKey(ID4)));
    assert.equal(out.status, 409);
    assert.equal(out.uid, USER.id);
    assert.deepEqual(JSON.parse(out.body), { ok: false, stage: "queue", error: "stale", job: ID4, refunded: 2, msg: STALE_BUILD_MSG });
    assert.equal(rpc.filter((x) => x.fn === "edit_sweep_stale").length, 1);
    assert.equal(rpc[0].args.p_after, STALE_QUEUED_S);
  } finally { restore(); }
  // NOTHING TO DO IS NOTHING SENT, and a sweep that cannot be read is silent.
  const q2 = queue(); const rpc2 = [];
  const restore2 = stubFetch({ edit_sweep_stale: { ok: true, resend: [], failed: [] } }, rpc2);
  try { const mod = await loadWorkerModule(); await mod.runStaleEditJobs({ ...ENV_KEYS, SITES_BUCKET: bucket({}), BUILD_QUEUE: q2 }); assert.deepEqual(q2.sent, []); } finally { restore2(); }
  const restore3 = stubFetch({}, []);
  try { const mod = await loadWorkerModule(); await mod.runStaleEditJobs({ ...ENV_KEYS, SITES_BUCKET: bucket({}), BUILD_QUEUE: queue() }); } finally { restore3(); }
});

// ── READ: THE WORKER'S HOPS, THE DOOR AND THE HARNESS ───────────────────────

test("the hops: every claim goes through claimArgs, the collector's gate precedes its record, the build's unread retry precedes the lease, the cron runs the stale sweep after the lost one, the imports carry the names", () => {
  const args = fnW("claimArgs");
  assert.match(args, /const deploy = deployIdOf\(env\);\s+return \{ p_id: id, p_owner: owner, p_ttl: LEASE_TTL_S, \.\.\.\(deploy \? \{ p_deploy: deploy \} : \{\}\) \};/, "the claim's arguments do not carry the deploy id only when there is one");
  assert.equal((W.match(/editRpc\(env, "edit_claim", claimArgs\(env, /g) || []).length, 3, "the three claims — the handler's, the build row's, the runner's fresh one — do not all go through claimArgs");
  assert.equal((W.match(/editRpc\(env, "edit_claim", \{/g) || []).length, 0, "a claim is spelled out beside claimArgs");
  const gate = fnW("deployGate");
  assert.match(gate, /if \(!mine\) return \{ blocked: false, unread: false, deploy: "" \};/, "a Worker with no deploy id asks the gate");
  assert.match(gate, /editRpc\(env, "deploy_gate_read", \{ p_deploy: mine \}\)/);
  assert.match(gate, /if \(!r \|\| r\.ok !== true\) return \{ blocked: false, unread: true, deploy: "" \};/, "a gate that cannot be read is read as open");
  const resume = fnW("runResumedSiteBuild");
  const ask = resume.indexOf("const gate = await deployGate(env);");
  const record = resume.indexOf("const obj = await env.SITES_BUCKET.get(resumeKey(id));");
  assert.ok(ask > 0 && record > ask, "the collector reads its record before asking the gate");
  assert.match(resume, /if \(gate\.blocked \|\| \(gate\.unread && tries < CLAIM_RETRY_MAX\)\) \{\s+const again = \{ \.\.\.packResumeMessage\(id\), \.\.\.\(gate\.unread \? \{ tries: tries \+ 1 \} : \{\}\) \};/, "a blocked or unreadable gate does not re-send the look, or an unreadable one is not bounded");
  const build = fnW("runQueuedSiteBuild");
  const busy = build.indexOf("if (row.busy) {");
  const unread = build.indexOf("if (row.unread && tries < CLAIM_RETRY_MAX) {");
  const lease = build.indexOf("const lease = row.held ? rowOwner : null;");
  assert.ok(busy > 0 && unread > busy && lease > unread, "the build's unread retry is not between the busy wait and the lease");
  assert.match(build, /await resendMessage\(env, \{ kind: JOB_KIND, id, tries: tries \+ 1 \},/);
  const handler = W.slice(W.indexOf("async queue(batch, env, ctx)"), W.indexOf("async function runQueuedSiteBuild("));
  assert.match(handler, /await runQueuedSiteBuild\(env, ctx, msg\.id, \{ tries: msg\.tries \}\);/, "the build's message does not carry its tries into the consumer");
  assert.match(handler, /await runResumedSiteBuild\(env, ctx, resume\.id, \{ tries: resume\.tries \}\);/, "the resume's message does not carry its tries into the look");
  const lost = fnW("runLostEditJobs");
  const sweep = lost.indexOf('editRpc(env, "edit_sweep_lost"');
  const stale = lost.indexOf("await runStaleEditJobs(env);");
  assert.ok(sweep > 0 && stale > sweep, "the stale sweep does not follow the lost sweep on the tick");
  assert.match(RAW, /deployIdOf, unreadClaim, deferredClaim, CLAIM_RETRY_MAX, STALE_QUEUED_S,\s+\} from "\.\/builder\/edit-job\.mjs";/);
  assert.match(RAW, /BUSY_BUILD_MSG, BUSY_EDIT_MSG, GATED_BUILD_MSG, GATED_EDIT_MSG, STALE_BUILD_MSG, STALE_EDIT_MSG \} from "\.\/builder\/build-lease\.mjs";/);
});

test("the container's door refuses first while stopping, before it reads the launch; the harness drives it under a hold", () => {
  const door = SERVER.slice(SERVER.indexOf('if (req.method === "POST" && req.url === "/job/run") {'), SERVER.indexOf('if (req.method === "GET" && req.url.startsWith("/job/")) {'));
  assert.ok(door.length > 200, "the job door is gone");
  const stopping = door.indexOf('if (_stopping) return send(res, 503, { ok: false, error: "stopping" });');
  const tooBig = door.indexOf("if (jTooBig) return send(res, 413,");
  const read = door.indexOf("launch = readLaunch(jBody);");
  assert.ok(stopping > 0 && tooBig > stopping && read > tooBig, "stopping is not refused before the size and the launch are read");
  assert.match(SERVER, /^let _stopping = false;/m);
  assert.match(HARNESS, /server\.kill\("SIGTERM"\);/, "the harness never sends SIGTERM");
  const hcase = HARNESS.slice(HARNESS.indexOf("STOPPING REFUSES A LAUNCH"), HARNESS.indexOf("} catch (e) {\n  failed++;"));
  assert.match(hcase, /\/hold\?ms=20000/, "the harness does not hold the service busy first");
  assert.match(hcase, /r\.status === 503 && j\.ok === false && j\.error === "stopping"/, "the harness does not read the 503 by name");
  assert.ok(HARNESS.indexOf("STOPPING REFUSES A LAUNCH") > HARNESS.lastIndexOf("render-faint"), "the stopping case is not last — it ends the service");
});

test("the poll routes: a build row failed under the gate or never picked up answers its own sentence through the row's reason", async () => {
  for (const [kind, msg, flag] of [["deploy-gated", GATED_BUILD_MSG, "gated"], ["stale", STALE_BUILD_MSG, "stale"]]) {
    const rpc = [];
    const restore = stubFetch({ edit_get: { ok: true, job: ID, slug: "", state: "failed", phase: null, cost: 0, billing: "external", needs_review: false, cancel: false, ms: 10, result: null, error: { kind, deferrals: 46 }, deferrals: 46 } }, rpc);
    try {
      const r = await hit("/api/site/build/" + ID, { headers: { Authorization: "Bearer some-token" }, env: { ...ENV_KEYS, SITES_BUCKET: bucket({}) } });
      assert.equal(r.status, 410, kind + ": " + r.text.slice(0, 200));
      assert.equal(r.json.msg, msg);
      assert.equal(r.json[flag], true);
    } finally { restore(); }
  }
});
