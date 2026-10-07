// ONE MESSAGE, SEVERAL PARTS, THROUGH THE REAL WORKER (2026-10-03).
//
// The combined request flow is made of things that already exist — the routing
// route, the edit and add-on routes, the queue consumer, `edit_jobs`, the
// credit ledger, the site bucket and the two-minute sweep — so its tests run
// the real Worker against stand-ins that KEEP STATE the way the real ones do:
//
//   * `edit_jobs` as the SQL in supabase/applied/ defines it: the create's
//     idempotency on (uid, slug, op, idem_key), the claim's lease and the
//     site's lock (`site_busy`), the reserve's once-per-ref ledger row, the
//     publish gate, the commit, the finalize, the refund and its review
//     branch, the cancel, both sweeps and the reconcile's write;
//   * the credit ledger: `credit_debit` once per (ref, reason), `use_credits`
//     as a gate, the balance;
//   * R2 with etags, conditional puts and `list` by prefix;
//   * the queue as a list of messages a test delivers (`pump`), once or twice;
//   * a clock a test can move (`advance`), for leases, expiry and the sweeps;
//   * a crash: a named call that lands and then never answers (`hang`), so the
//     invocation that made it simply stops, as an evicted isolate does — no
//     catch, no finally — and the sweeps must recover what it left.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer is supplied by the test
// (`answers`, as `test/fixtures/live-ask.mjs` keys them): this shows what the
// code does with an answer, never what a real model answers.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import vm from "node:vm";
import { loadWorker, makeCtx } from "./worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk } from "./cf-containers.mjs";
import { CONFIG_KEY } from "../../site-config.mjs";
import { T, USER, TOKEN, SOURCE_KEY, PARTS_KEY, PAGES, ROUTES, OLD_DESC, CHAT, cut, userText, after } from "./live-ask.mjs";
import { TASK_STATES } from "../../builder/site-progress.mjs";

export { T, USER, TOKEN, SOURCE_KEY, ROUTES };
const realEditPoll = createRequire(import.meta.url)("../../public/edit-poll.js");
export const hex = (n = 16) => randomBytes(n).toString("hex");
export const newKey = () => "rq" + hex(10);
const IDEM_RE = /^[A-Za-z0-9_-]{16,64}$/;
const TERMINAL = ["done", "failed", "cancelled", "lost"];
const resp = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

// The tools whose supplied answer may be a list, one per call (live-ask's set).
const SEQUENCED = new Set(["route", T.pick, T.tweak, T.pages, T.adds]);

/**
 * A PLATFORM FOR ONE SITE. `answers` are the model's, by tool (live-ask's
 * keys). `balance` is the owner's credits; `founder` makes the reserve exempt.
 * Returns the state, the env, and the actions a test drives.
 */
// `db` (2026-10-03): a site database that remembers (`fixtures/rows-db.mjs`),
// reached the way the demo sites reach theirs — a blank link in
// `site_backends` and the project's own connection — for a part that writes a
// row. Without it the site has no database, as before.
const DB_CONN = "postgres://u:p@ep-rows.neon.tech/neondb";
// `tasksWith` (2026-10-06): the task-lines writer's own pace, faults or
// answer, as `progressWith` is the progress writer's.
// `progress` (2026-10-06): `PROGRESS_REPLIES` on, and `progressWith` the
// progress writer's own pace, faults or answer, as `replyWith` is the reply's.
export function platform({ slug, balance = 50, founder = false, answers = {}, owner = USER.id, replies = false, replyWith = null, pages = PAGES, db = null, progress = false, progressWith = null, tasksWith = null, provisions = false } = {}) {
  let clock = 0;
  const now = () => Date.now() + clock;
  // ── R2 ────────────────────────────────────────────────────────────────────
  const objects = new Map();
  let etagN = 0;
  const setObj = (k, v) => { objects.set(k, { body: typeof v === "string" ? v : v instanceof Uint8Array ? v : String(v), etag: "e" + (++etagN), at: now() }); };
  setObj(SOURCE_KEY(slug), JSON.stringify(pages));
  setObj(PARTS_KEY(slug), JSON.stringify([]));
  setObj(CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf", theme: "broadsheet", description: OLD_DESC }, css: "" }));
  const asObj = (k, o) => ({
    key: k, etag: o.etag, uploaded: new Date(o.at),
    text: async () => (o.body instanceof Uint8Array ? new TextDecoder().decode(o.body) : o.body),
    json: async () => JSON.parse(o.body instanceof Uint8Array ? new TextDecoder().decode(o.body) : o.body),
    arrayBuffer: async () => (o.body instanceof Uint8Array ? o.body : new TextEncoder().encode(o.body)).slice().buffer,
  });
  const bucket = {
    async get(k) {
      // A READ THAT FAILS (`failGet`): the store down for that one call.
      const g = getFaults.findIndex((x) => x.match(k));
      if (g >= 0) { getFaults.splice(g, 1); throw new Error("r2 unavailable"); }
      const o = objects.get(k); return o ? asObj(k, o) : null;
    },
    async head(k) { const o = objects.get(k); return o ? { key: k, etag: o.etag } : null; },
    async put(k, v, opts = {}) {
      // SOMETHING ELSE LANDS FIRST (`beforePut`): another tab's call between
      // this writer's read and its write, which then meets what that left.
      const bp = beforePuts.findIndex((x) => x.match(k));
      if (bp >= 0) { const x = beforePuts.splice(bp, 1)[0]; await x.then(k); }
      const cur = objects.get(k);
      const c = opts.onlyIf || {};
      if (c.etagMatches != null && (!cur || cur.etag !== String(c.etagMatches))) return null;
      if (c.etagDoesNotMatch != null && cur && (String(c.etagDoesNotMatch) === "*" || cur.etag === String(c.etagDoesNotMatch))) return null;
      const body = v instanceof ArrayBuffer ? new Uint8Array(v) : v instanceof Uint8Array ? v : String(v);
      // A WRITE THAT FAILS OUTRIGHT (`failPut`), or one that LANDS AND NEVER
      // ANSWERS (`hangPut`): the store down, or the writer evicted after it.
      const f = putFaults.findIndex((x) => x.match(k, body));
      if (f >= 0) {
        const x = putFaults.splice(f, 1)[0];
        if (x.kind === "fail") throw new Error("r2 unavailable");
        // A WRITE THAT LANDS AND WHOSE ANSWER IS LOST (`losePut`): committed,
        // and the writer told it failed. `then` runs in between — another
        // tab's call, say — before the writer hears.
        if (x.kind === "lose") {
          setObj(k, body);
          if (typeof x.then === "function") await x.then(k);
          throw new Error("r2 response lost");
        }
        setObj(k, body);
        hung.what = "put:" + k;
        die(null);
        hung.resolve(hung.what);
        return new Promise(() => {});
      }
      setObj(k, body);
      // EVERY JOB'S STORED REQUEST, KEPT FOR THE CASE: the consumer deletes the
      // object once it has read it, as it should.
      if (k.startsWith("jobs/edit/")) { try { filed.set(k.slice("jobs/edit/".length), JSON.parse(String(body))); } catch { /* not a job */ } }
      return { key: k, etag: objects.get(k).etag };
    },
    async delete(k) {
      for (const x of Array.isArray(k) ? k : [k]) {
        // SOMETHING ELSE LANDS FIRST (`beforeDelete`): another call between
        // this caller's read and its delete.
        const bd = beforeDeletes.findIndex((d) => d.match(x));
        if (bd >= 0) { const d = beforeDeletes.splice(bd, 1)[0]; await d.then(x); }
        objects.delete(x);
      }
    },
    // A PAGE AT A TIME, as R2 lists: `truncated` with a `cursor` while keys are
    // left, the cursor opaque to the caller (here, the last key it was given).
    async list({ prefix = "", limit = 1000, cursor } = {}) {
      const all = [...objects.keys()].filter((k) => k.startsWith(prefix) && (!cursor || k > cursor)).sort();
      const keys = all.slice(0, limit);
      const truncated = all.length > keys.length;
      return { objects: keys.map((k) => ({ key: k, etag: objects.get(k).etag })), truncated, ...(truncated ? { cursor: keys[keys.length - 1] } : {}) };
    },
  };
  // ── edit_jobs AND THE LEDGER ──────────────────────────────────────────────
  const jobs = new Map();
  const ledger = [];
  const credits = { balance };
  const queue = [];
  const sent = [];
  const rpcLog = [];
  const modelLog = [];
  const counts = {};
  const nextN = (k) => { counts[k] = (counts[k] || 0) + 1; return counts[k] - 1; };
  const hangs = [];
  const putFaults = [];
  const getFaults = [];
  // A READ OF THE JOB TABLE THAT FAILS (`failRead`, 2026-10-06): the service down for that one call.
  const readFaults = [];
  const beforePuts = [];
  const beforeDeletes = [];
  const rpcFaults = [];
  let sendHangs = 0;
  const replyLog = [];
  // EVERY PROGRESS CALL'S FACTS, as the writer was shown them (2026-10-06).
  const progressLog = [];
  const tasksLog = [];
  const filed = new Map();
  const afters = [];
  const hung = { promise: null, resolve: null, what: null };
  const resetHung = () => { hung.promise = new Promise((r) => { hung.resolve = r; }); hung.what = null; };
  resetHung();
  // A CRASHED INVOCATION STOPS WHOLE: its heartbeat timers are cleared and the
  // job it held renews nothing more, so its lease runs out as an evicted
  // isolate's does and the sweeps meet what it left.
  const timers = new Set();
  // EACH LIVE INTERVAL'S OWN CALL (`beatNow`): a job's heartbeat, run when a case says.
  const beatsOf = new Map();
  const dead = new Set();
  const die = (jobId) => { for (const t of timers) clearInterval(t); timers.clear(); beatsOf.clear(); if (jobId) dead.add(jobId); };
  const live = (j) => !TERMINAL.includes(j.state);
  const leased = (j) => j.lease_owner && j.lease_expires_at > now();
  const view = (j) => ({
    ok: true, job: j.id, slug: j.slug, state: j.state, phase: j.phase, cost: j.cost, billing: j.billing,
    needs_review: j.needs_review, cancel: j.cancel_requested_at !== null, ms: now() - j.created_at,
    result: j.result, error: j.error, deferrals: j.deferrals,
  });
  const ledgerRow = (uid, kind, ref, reason, delta) => { ledger.push({ uid, kind, ref, reason, delta, balance_after: credits.balance, at: now() }); };
  const refund = (j, state, note) => {
    if (j.published_at) return { ok: false, error: "published", state: j.state };
    if (j.state === "done") return { ok: false, error: "terminal", state: j.state };
    if (j.publish_started_at) { j.state = state; j.needs_review = true; j.review_note = note || "died during publish"; return { ok: false, error: "needs-review", refunded: 0 }; }
    if (j.billing === "reserved") {
      credits.balance += j.cost;
      if (!ledger.some((e) => e.ref === j.id && e.reason === "refund")) ledgerRow(j.uid, "edit", j.id, "refund", j.cost);
      const was = j.cost;
      j.billing = "refunded"; j.state = state;
      return { ok: true, refunded: was, balance: credits.balance };
    }
    j.state = state;
    return { ok: true, refunded: 0, billing: j.billing };
  };
  const siteBusy = (slugOf, self) => [...jobs.values()].find((o) => o.slug === slugOf && o.id !== self && live(o) && !o.needs_review && (leased(o) || o.state === "publishing"));
  const rpc = {
    edit_create(a) {
      const blocked = [...jobs.values()].find((o) => o.slug === a.p_slug && o.needs_review);
      if (blocked) return { ok: false, error: "needs-review", job: blocked.id };
      if (!IDEM_RE.test(String(a.p_idem || ""))) return { ok: false, error: "bad-idem" };
      const had = [...jobs.values()].find((o) => o.uid === a.p_uid && o.slug === a.p_slug && o.op === a.p_op && o.idem_key === a.p_idem);
      if (had) return { ok: true, job: had.id, state: had.state, duplicate: had.id !== a.p_id };
      const j = {
        id: a.p_id, uid: a.p_uid, slug: a.p_slug, op: a.p_op, idem_key: a.p_idem, state: "queued", phase: null,
        billing: a.p_op === "build" ? "external" : "none", cost: 0, needs_review: false, review_note: null,
        lease_owner: null, lease_expires_at: 0, cancel_requested_at: null, publish_started_at: null, published_at: null,
        artifact_build: null, result: null, error: null, deferrals: 0, sweep_tries: 0, created_at: now(), updated_at: now(), seqs: new Set(),
      };
      jobs.set(j.id, j);
      return { ok: true, job: j.id, state: j.state, duplicate: false };
    },
    edit_claim(a) {
      const j = jobs.get(a.p_id);
      if (!j) return { ok: false, claimed: false, error: "no-job" };
      if (j.needs_review || TERMINAL.includes(j.state) || ["finalized", "refunded"].includes(j.billing) || leased(j)) {
        return { ok: true, claimed: false, state: j.state, error: j.needs_review ? "needs-review" : TERMINAL.includes(j.state) ? "terminal" : ["finalized", "refunded"].includes(j.billing) ? "settled" : "leased" };
      }
      const other = siteBusy(j.slug, j.id);
      if (other) {
        j.deferrals++; j.phase = "waiting"; j.updated_at = now();
        if (j.deferrals > 45) { const res = refund(j, "failed", "the site was busy for the whole wait"); j.error = { kind: "site-busy", phase: "queued", other: other.id, deferrals: j.deferrals }; return { ok: true, claimed: false, error: "site-busy", gave_up: true, other: other.id, deferrals: j.deferrals, state: "failed", refund: res }; }
        return { ok: true, claimed: false, error: "site-busy", gave_up: false, other: other.id, deferrals: j.deferrals, state: j.state };
      }
      j.lease_owner = a.p_owner; j.lease_expires_at = now() + a.p_ttl * 1000;
      if (j.state === "queued") j.state = "claimed";
      j.updated_at = now();
      return { ok: true, claimed: true, state: j.state, billing: j.billing, uid: j.uid, slug: j.slug, needs_review: false, deferrals: j.deferrals };
    },
    edit_handoff(a) {
      const j = jobs.get(a.p_id);
      if (!j || j.lease_owner !== a.p_owner || !live(j) || j.needs_review) return { ok: false, error: j ? "not-holder" : "no-job" };
      if (a.p_next) j.lease_owner = a.p_next;
      j.lease_expires_at = now() + a.p_ttl * 1000;
      if (a.p_state) j.state = a.p_state;
      return { ok: true, state: j.state, owner: j.lease_owner, slug: j.slug, uid: j.uid };
    },
    edit_beat(a) {
      const j = jobs.get(a.p_id);
      if (!j || dead.has(j.id) || j.lease_owner !== a.p_owner || !live(j)) return { ok: false, alive: false };
      j.lease_expires_at = now() + a.p_ttl * 1000; if (a.p_phase) j.phase = a.p_phase; j.updated_at = now();
      return { ok: true, alive: true, state: j.state, cancel: j.cancel_requested_at !== null };
    },
    edit_reserve(a) {
      const j = jobs.get(a.p_id);
      if (!j) return { ok: false, error: "no-job" };
      if (TERMINAL.includes(j.state)) return { ok: false, error: "terminal", state: j.state };
      const ref = j.id + "#" + a.p_seq;
      if (ledger.some((e) => e.ref === ref && e.reason === "reserve")) return { ok: true, charged: 0, cost: j.cost, billing: j.billing, repeat: true };
      if (founder) { j.billing = "exempt"; j.cost = 0; if (["queued", "claimed"].includes(j.state)) j.state = "routing"; return { ok: true, charged: 0, cost: 0, billing: "exempt" }; }
      const cost = Number(a.p_cost);
      if (credits.balance < cost) return { ok: false, error: "insufficient", cost: j.cost };
      credits.balance -= cost;
      ledgerRow(j.uid, "edit", ref, "reserve", -cost);
      j.billing = "reserved"; j.cost += cost;
      if (["queued", "claimed"].includes(j.state)) j.state = "routing";
      return { ok: true, charged: cost, cost: j.cost, balance: credits.balance, billing: "reserved" };
    },
    edit_exempt(a) {
      const j = jobs.get(a.p_id);
      if (!j) return { ok: false, error: "no-job" };
      if (j.lease_owner === a.p_owner && j.lease_expires_at > now() && j.cancel_requested_at === null && !j.needs_review && live(j) && j.billing === "none") {
        j.billing = "exempt"; j.cost = 0; return { ok: true, billing: "exempt", state: j.state };
      }
      return { ok: false, state: j.state, billing: j.billing, error: TERMINAL.includes(j.state) ? "terminal" : j.cancel_requested_at ? "cancelled" : j.billing !== "none" ? "billed" : "refused" };
    },
    edit_may_publish(a) {
      const j = jobs.get(a.p_id);
      if (!j) return { ok: false, granted: false, error: "no-job" };
      if (j.lease_owner === a.p_owner && j.lease_expires_at > now() && j.cancel_requested_at === null && !j.needs_review && live(j) && ["reserved", "exempt"].includes(j.billing)) {
        j.state = "publishing"; j.publish_started_at = j.publish_started_at || now(); j.lease_expires_at = now() + a.p_ttl * 1000;
        return { ok: true, granted: true };
      }
      return { ok: true, granted: false, state: j.state, error: j.cancel_requested_at ? "cancelled" : j.needs_review ? "needs-review" : j.lease_owner !== a.p_owner ? "lease-lost" : j.lease_expires_at <= now() ? "lease-expired" : j.billing === "none" ? "unbilled" : "terminal" };
    },
    edit_publish_mark(a) {
      const j = jobs.get(a.p_id);
      if (!j || j.lease_owner !== a.p_owner) return { ok: false };
      j.publish_started_at = j.publish_started_at || now(); if (a.p_artifact_build) j.artifact_build = a.p_artifact_build;
      return { ok: true };
    },
    edit_committed(a) {
      const j = jobs.get(a.p_id);
      if (!j) return { ok: false, error: "no-job" };
      if (j.lease_owner === a.p_owner && j.lease_expires_at > now() && live(j)) { j.published_at = j.published_at || now(); if (a.p_build) j.artifact_build = a.p_build; return { ok: true, published: j.published_at }; }
      return { ok: false, state: j.state, error: TERMINAL.includes(j.state) ? "terminal" : j.lease_owner !== a.p_owner ? "not-holder" : "lease-expired" };
    },
    edit_phase_write() { return { ok: true }; },
    edit_finalize(a) {
      const j = jobs.get(a.p_id);
      if (!j) return { ok: false, error: "no-job" };
      if (a.p_result) j.result = a.p_result;
      if ((j.published_at || (!j.publish_started_at && a.p_ok)) && !["cancelled", "lost", "failed"].includes(j.state)) {
        j.state = "done"; if (j.billing === "reserved") j.billing = "finalized";
        return { ok: true, billing: j.billing, cost: j.cost, published: !!j.published_at };
      }
      return { ok: false, state: j.state, error: j.published_at ? "terminal" : "not-published" };
    },
    edit_refund(a) { const j = jobs.get(a.p_id); return j ? refund(j, a.p_state, a.p_note) : { ok: false, error: "no-job" }; },
    edit_reconcile(a) {
      const j = jobs.get(a.p_id);
      if (!j) return { ok: false, error: "no-job" };
      if (!j.needs_review) return { ok: false, error: "not-in-review", state: j.state };
      if (a.p_committed) { j.needs_review = false; j.published_at = j.published_at || now(); j.state = "done"; if (j.billing === "reserved") j.billing = "finalized"; return { ok: true, outcome: "kept", cost: j.cost }; }
      let back = 0;
      if (j.billing === "reserved") { credits.balance += j.cost; back = j.cost; ledgerRow(j.uid, "edit", j.id, "refund", j.cost); j.billing = "refunded"; }
      j.needs_review = false; j.state = "failed";
      return { ok: true, outcome: "refunded", refunded: back };
    },
    edit_get(a) { const j = jobs.get(a.p_id); return j && j.uid === a.p_uid ? view(j) : { ok: false, error: "no-job" }; },
    edit_cancel(a) {
      const j = jobs.get(a.p_id);
      if (!j || j.uid !== a.p_uid) return { ok: false, error: "no-job" };
      if (j.published_at) return { ok: false, error: "too-late", state: j.state };
      if (TERMINAL.includes(j.state)) return { ok: true, state: j.state, cancel: j.cancel_requested_at !== null };
      j.cancel_requested_at = j.cancel_requested_at || now();
      return { ok: true, state: j.state, cancel: true };
    },
    edit_sweep_lost(a) {
      const out = { ok: true, lost: 0, review: 0, recovered: 0, exhausted: 0, stuck: 0, refunded: 0 };
      for (const j of [...jobs.values()]) {
        if (!live(j) || j.needs_review || !j.lease_expires_at || !(j.lease_expires_at < now() - a.p_grace * 1000)) continue;
        if (j.sweep_tries >= 5) { j.needs_review = true; out.exhausted++; continue; }
        j.sweep_tries++;
        const res = refund(j, "lost", "lease expired");
        if (res.error === "published") {
          j.result = { status: 200, type: "application/json", body: JSON.stringify({ ok: true, recovered: true, job: j.id, cost: j.cost, build: j.artifact_build }) };
          j.state = "done"; if (j.billing === "reserved") j.billing = "finalized"; out.recovered++;
        } else if (res.error === "needs-review") out.review++;
        else if (res.ok) { out.lost++; out.refunded += res.refunded || 0; } else out.stuck++;
      }
      return out;
    },
    edit_sweep_stale(a) {
      const resend = [], failed = [];
      for (const j of [...jobs.values()]) {
        if (j.state !== "queued" || j.lease_owner || j.needs_review || ["finalized", "refunded"].includes(j.billing)) continue;
        if (!(j.updated_at < now() - a.p_after * 1000)) continue;
        if (j.phase === "stale") { const res = refund(j, "failed", "never picked up"); if (res.ok) { j.error = { kind: "stale", phase: "queued" }; failed.push({ id: j.id, op: j.op, uid: j.uid, slug: j.slug }); } }
        else { j.phase = "stale"; j.deferrals++; j.updated_at = now(); resend.push({ id: j.id, op: j.op }); }
      }
      return { ok: true, resend, failed };
    },
    deploy_gate_read() { return { ok: true, blocked: false }; },
  };
  // ── THE MODEL ─────────────────────────────────────────────────────────────
  // A FUNCTION'S ANSWER MAY BE A PROMISE (2026-10-06): a case can hold a step
  // mid-job — a designer that waits on the case — while it delivers something
  // else beside the job, as the real queue runs a progress task beside it.
  const answerFor = async (key, args) => {
    const a = answers[key];
    if (typeof a === "function") return a(args, nextN(key));
    if (SEQUENCED.has(key) && Array.isArray(a)) return a[nextN(key)];
    return a;
  };
  // THE ANSWER'S USAGE: ten in and five out unless a narration case hands its
  // own (`progressWith`/`tasksWith` answering `{ usage }`, 2026-10-07) — every
  // other call's usage, which money is priced from, stays as it was.
  const say = (tool, input, usage = null) => resp({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input }], usage: usage || { input_tokens: 10, output_tokens: 5 } });
  async function model(args, signal = null) {
    const tool = (args.tool_choice && args.tool_choice.name) || "";
    const props = (args.tools && args.tools[0] && args.tools[0].input_schema && args.tools[0].input_schema.properties) || {};
    modelLog.push({ tool, text: userText(args), props: Object.keys(props) });
    // THE REPLY WRITER, SUPPLIED: it answers with the facts it was given, each
    // as given, so a test can read what the customer is told — the facts are
    // the code's; the wording would be a model's.
    if (tool === "write_reply" && !Object.hasOwn(answers, "write_reply")) {
      const facts = [...userText(args).matchAll(/^\[([a-z0-9:-]+)\] (.*)$/gm)].map((m) => ({ id: m[1], text: m[2] }));
      // THE WRITER'S OWN PACE AND FAULTS (`replyWith`, 2026-10-04): a case may
      // hold the answer back (a slow model — `heldFor` ends it when the
      // caller's timer aborts the call, as the network would), or refuse it
      // (`{ status }`: the provider's error). Facts reach `replyLog` only when
      // an answer is given.
      if (typeof replyWith === "function") {
        const how = await replyWith({ n: nextN("write_reply"), facts, signal });
        if (how && Number.isInteger(how.status)) return new Response(how.body || "provider error", { status: how.status });
      }
      replyLog.push(facts);
      return say(tool, { reply: facts.map((f) => f.text).join(" "), covers: facts.map((f) => f.id) });
    }
    // THE PROGRESS WRITER, SUPPLIED (2026-10-06): it answers each fact in its
    // own words and its own state, so a test reads which facts a line covered —
    // the facts are the code's; the wording would be a model's. `progressWith`
    // may hold it (a slow model), refuse it (`{ status }`) or answer for it
    // (`{ answer }`: a misstated or contradictory update, say).
    if (tool === "write_progress" && !Object.hasOwn(answers, "write_progress")) {
      const text = userText(args);
      const facts = [...text.matchAll(/^\[(f\d+)\] \(([a-z]+)\) (.*)$/gm)].map((m) => ({ id: m[1], state: m[2], text: m[3] }));
      let usage = null;
      if (typeof progressWith === "function") {
        const how = await progressWith({ n: nextN("write_progress"), facts, text, signal });
        if (how && Number.isInteger(how.status)) return new Response(how.body || "provider error", { status: how.status });
        if (how && how.usage) usage = how.usage;
        if (how && how.answer) { progressLog.push(facts); return say(tool, how.answer, usage); }
      }
      progressLog.push(facts);
      return say(tool, { text: facts.map((f) => f.text).join(" "), says: facts.map((f) => ({ id: f.id, as: f.state })) }, usage);
    }
    // THE TASK-LINES WRITER, SUPPLIED (2026-10-06): each task's line in every
    // state, marked with its state so a test reads which one a card shows —
    // a supplied model, so the marks are the test's, never the product's.
    if (tool === "write_tasks" && !Object.hasOwn(answers, "write_tasks")) {
      const text = userText(args);
      const tasks = [...text.matchAll(/^\[(t\d+)\] (.*)$/gm)].map((m) => ({ id: m[1], words: m[2] }));
      let usage = null;
      if (typeof tasksWith === "function") {
        const how = await tasksWith({ n: nextN("write_tasks"), tasks, text, signal });
        if (how && Number.isInteger(how.status)) return new Response(how.body || "provider error", { status: how.status });
        if (how && how.usage) usage = how.usage;
        if (how && how.answer) { tasksLog.push(tasks); return say(tool, how.answer, usage); }
      }
      tasksLog.push(tasks);
      // IN EVERY STATE THE PRODUCT NAMES (`TASK_STATES`), read from it rather than listed twice.
      return say(tool, { tasks: tasks.map((t) => ({ id: t.id, ...Object.fromEntries(TASK_STATES.map((k) => [k, "(" + k + ") " + t.words])) })) }, usage);
    }
    if (tool === T.route) { const a = await answerFor("route", args); return a ? say(tool, a) : new Response("no stub for this routing call", { status: 503 }); }
    if (tool === T.lane) {
      const field = Object.keys(props)[0] || "";
      if (!Object.hasOwn(answers, "lane:" + field)) return new Response("no stub for lane " + field, { status: 503 });
      const a = answers["lane:" + field];
      const v = typeof a === "function" ? await a(args, nextN("lane:" + field)) : a;
      return say(tool, v && typeof v === "object" && Object.hasOwn(v, "question") && Object.keys(v).length === 1 ? v : { [field]: v });
    }
    if (tool === T.design) {
      const kind = Object.keys(props).find((k) => k !== "requirements" && k !== "question") || "";
      if (!Object.hasOwn(answers, "add:" + kind)) return new Response("no stub for the " + kind + " designer", { status: 503 });
      const a = answers["add:" + kind];
      return say(tool, typeof a === "function" ? await a(args, nextN("add:" + kind)) : a);
    }
    if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
    return say(tool, await answerFor(tool, args));
  }
  // NEON, FOR A SITE THAT PROVISIONS (`provisions`): every control-plane call,
  // the projects made, the two rows as claimed; `neonFaults` fail or hang the
  // next call a case names.
  const neon = { calls: [], projects: [], project: null, db: "" };
  const neonFaults = [];
  // ── THE WIRE ──────────────────────────────────────────────────────────────
  const real = globalThis.fetch;
  const fetchStub = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const m = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/);
    if (m) {
      const fn = m[1];
      // A CALL THAT NEVER LANDS (`failRpc`): the database down for that one call.
      const rf = rpcFaults.findIndex((x) => x.fn === fn && (x.when ? x.when(args) : true));
      if (rf >= 0) { rpcFaults.splice(rf, 1); return new Response("unavailable", { status: 503 }); }
      let out;
      if (Object.hasOwn(rpc, fn)) out = rpc[fn](args);
      else if (fn === "credit_debit") {
        const ref = String(args.p_ref || "");
        const prior = ledger.find((e) => e.ref === ref && e.reason === args.p_reason);
        if (founder) out = { ok: true, exempt: true, taken: 0, repeat: false };
        else if (prior) out = { ok: true, repeat: true, taken: 0, prior: -prior.delta, exempt: false, balance: credits.balance };
        else {
          const want = Number(args.p_amount);
          const took = credits.balance >= want ? want : args.p_partial ? Math.max(0, credits.balance) : 0;
          if (took <= 0) out = { ok: false, error: "insufficient", taken: 0, balance: credits.balance };
          else { credits.balance -= took; ledgerRow(USER.id, "build", ref, args.p_reason, -took); out = { ok: true, taken: took, balance: credits.balance, exempt: false, repeat: false, short: took < want }; }
        }
      } else if (fn === "get_credits") out = credits.balance;
      else if (fn === "use_credits") {
        const c = Number(args.cost) || 0;
        if (founder) out = credits.balance;
        else if (credits.balance >= c) { credits.balance -= c; ledgerRow(USER.id, "use", "use:" + ledger.length, "use", -c); out = credits.balance; }
        else out = -1;
      } else if (fn === "credit_back" || fn === "credit_reverse") out = { ok: true, refunded: 0 };
      else out = { ok: false, error: "no stub for " + fn };
      rpcLog.push({ fn, args, out });
      // SOMETHING ELSE HAPPENS AT THIS VERY MOMENT (a press from another tab):
      // after the call has landed, before its caller hears back.
      const a = afters.findIndex((x) => x.fn === fn && (x.when ? x.when(args, out) : true));
      if (a >= 0) { const x = afters.splice(a, 1)[0]; await x.then(args, out); }
      const h = hangs.findIndex((x) => x.fn === fn && (x.when ? x.when(args, out) : true));
      if (h >= 0) {
        hangs.splice(h, 1);
        hung.what = fn;
        die(typeof args.p_id === "string" ? args.p_id : null);
        hung.resolve(fn);
        // THE CALL LANDED, AND ITS CALLER NEVER HEARS: an evicted isolate.
        return new Promise(() => {});
      }
      return resp(out);
    }
    if (url.includes("/auth/v1/user")) return resp(USER);
    if (/\/rest\/v1\/edit_jobs\?/.test(url)) {
      const rf = readFaults.findIndex((x) => x.match(url));
      if (rf >= 0) { readFaults.splice(rf, 1); return new Response("unavailable", { status: 503 }); }
      const q = new URL(url).searchParams;
      let rows = [...jobs.values()];
      const id = q.get("id"); if (id && id.startsWith("eq.")) rows = rows.filter((j) => j.id === id.slice(3));
      const nr = q.get("needs_review"); if (nr === "eq.true") rows = rows.filter((j) => j.needs_review);
      // ITS ORDER AND ITS LIMIT, AS POSTGREST APPLIES THEM (2026-10-06): a
      // read that asks for the newest twenty gets the newest twenty.
      const ord = /^([a-z_]+)\.(asc|desc)$/.exec(q.get("order") || "");
      if (ord) rows.sort((a, b) => (a[ord[1]] > b[ord[1]] ? 1 : a[ord[1]] < b[ord[1]] ? -1 : 0) * (ord[2] === "desc" ? -1 : 1));
      const lim = Number(q.get("limit"));
      if (Number.isInteger(lim) && lim > 0) rows = rows.slice(0, lim);
      return resp(rows.map(({ seqs, ...r }) => ({ ...r, publish_started_at: r.publish_started_at ? new Date(r.publish_started_at).toISOString() : null, published_at: r.published_at ? new Date(r.published_at).toISOString() : null })));
    }
    if (url.includes("/rest/v1/edit_traces")) return new Response(null, { status: 201 });
    // ── A SITE WITH NO DATABASE YET (`provisions`, 2026-10-07) ───────────────
    // Neon's control plane in its own response shapes (the add-on fixture's
    // stand-in), each create a project of its own, so a case counts the
    // projects made; and the two slug-keyed rows claimed as PostgREST claims
    // them — the first claim records, a later one is ignored (`[]`).
    if (provisions && url.includes("console.neon.tech/api/v2")) {
      neon.calls.push(method + " " + (url.split("/api/v2")[1] || url));
      const nf = neonFaults.findIndex((x) => x.match(method, url));
      if (nf >= 0) { const x = neonFaults.splice(nf, 1)[0]; if (x.hang) { hung.what = "neon"; die(null); hung.resolve("neon"); return new Promise(() => {}); } return new Response("neon unavailable", { status: 503 }); }
      if (/\/projects$/.test(url) && method === "POST") {
        const id = "pr-" + (neon.projects.length + 1);
        neon.projects.push(id);
        return resp({ project: { id }, branch: { id: "br-" + id }, roles: [{ name: "owner" }], connection_uris: [{ connection_uri: DB_CONN }] }, 201);
      }
      if (/\/operations$/.test(url)) return resp({ operations: [] });
      if (/organizations$/.test(url)) return resp({ organizations: [] });
      return resp({ auth: { jwks_url: "https://x/jwks" }, data_api: { url: "https://x/data" } });
    }
    if (provisions && url.includes("/rest/v1/site_project")) {
      if (method === "POST") {
        const pf = neonFaults.findIndex((x) => x.match(method, url));
        if (pf >= 0) { neonFaults.splice(pf, 1); return new Response("unavailable", { status: 503 }); }
        if (neon.project) return resp([], 201);
        neon.project = { uid: args.uid, neon_project: args.neon_project, neon_branch: args.neon_branch, neon_role: args.neon_role, neon_conn: args.neon_conn };
        return resp([{ slug: args.slug }], 201);
      }
      return resp(neon.project ? [neon.project] : []);
    }
    if (provisions && url.includes("/rest/v1/site_backends")) {
      if (method === "POST") return resp([], 201);
      if (method === "PATCH") { if (typeof args.neon_db === "string") neon.db = args.neon_db; return resp([]); }
      return resp([{ uid: owner, brief: "", neon_db: neon.db }]);
    }
    if (url.includes("/rest/v1/site_backends")) return resp([{ uid: owner, brief: "", neon_db: "" }]);
    if (url.includes("/rest/v1/site_project")) return resp(db ? [{ uid: owner, neon_project: "proj-1", neon_branch: "br-1", neon_role: "owner", neon_conn: DB_CONN }] : []);
    if (url.includes("/rest/v1/site_aliases")) return resp([]);
    if (db && url.includes("neon.tech/sql")) {
      const own = db.answer(String(args.query || ""), Array.isArray(args.params) ? args.params : []);
      return own || resp({ command: "SELECT", rowCount: 0, rows: [], fields: [] });
    }
    if (url.includes("/rest/v1/credits")) return resp([{ balance: credits.balance }]);
    if (url.includes("/v1/messages")) return model(args, (init && init.signal) || (input && input.signal) || null);
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable: " + method + " " + url, { status: 503 });
  };
  const env = {
    SITES_BUCKET: bucket, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test",
    EDIT_ASYNC: "on", EDIT_ASYNC_EVERYONE: "on", REQUEST_FLOW: "on", ...(replies ? { MODEL_REPLIES: "on" } : {}), ...(progress ? { PROGRESS_REPLIES: "on" } : {}),
    BUILD_QUEUE: {
      async send(body, opts) {
        if (env.__dropSends > 0) { env.__dropSends--; throw new Error("queue unavailable"); }
        // WHEN IT WAS SENT, on the platform's clock, so a case can deliver it at its time (`pump`'s `due`).
        const m = { body, delaySeconds: (opts && opts.delaySeconds) || 0, at: now() };
        queue.push(m); sent.push(m);
        // A SEND THAT LANDS AND WHOSE SENDER NEVER HEARS (`hangSend`): evicted right after it.
        if (sendHangs > 0) { sendHangs--; hung.what = "send"; die(null); hung.resolve("send"); return new Promise(() => {}); }
      },
    },
    ...dispatchEnv(),
  };
  const realNow = Date.now;
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  // THE WIRE STAYS IN PLACE FROM THE FIRST CALL TO `close()`, so work a
  // crashed or finished invocation left running can only ever meet these
  // stand-ins — never the real network.
  let installed = false;
  const install = () => {
    if (installed) return;
    installed = true;
    globalThis.fetch = fetchStub; Date.now = () => realNow() + clock;
    globalThis.setInterval = (fn, ms, ...rest) => { const t = realSetInterval(fn, ms, ...rest); timers.add(t); if (typeof fn === "function") beatsOf.set(t, () => fn(...rest)); return t; };
    globalThis.clearInterval = (t) => { timers.delete(t); beatsOf.delete(t); return realClearInterval(t); };
  };
  const uninstall = () => {
    if (!installed) return;
    installed = false;
    globalThis.fetch = real; Date.now = realNow; globalThis.setInterval = realSetInterval; globalThis.clearInterval = realClearInterval;
  };
  // A CLOSED PLATFORM NEVER TAKES THE WIRE BACK (2026-10-07): a page a
  // finished case left following its last read called through `run` after
  // `close()`, put this platform's stand-ins back over the next case's, and
  // that case read the finished one's job table (progress-gaps' RACE 2, after
  // RACE 1). A call after `close()` is refused instead.
  let closed = false;
  /** Run `fn` with the wire and the clock in place. */
  async function run(fn) {
    if (closed) throw new Error("platform closed: a call made after its case ended");
    install();
    return fn();
  }
  const P = {
    slug, env, bucket, objects, jobs, ledger, credits, queue, sent, rpcLog, modelLog, replyLog, progressLog, tasksLog, hung, filed,
    now, run,
    /** Move the clock: leases, the question's day, the sweeps' windows. */
    advance(ms) { clock += ms; },
    /** Neon as a provisioning site saw it: its calls, the projects made, the rows claimed (`provisions`). */
    neon,
    /** The next Neon call (or `site_project` claim) `match(method, url)` accepts answers 503 — or, with `hang`, lands and is never answered. */
    failNeon(match, { hang = false } = {}) { neonFaults.push({ match, hang }); if (hang) resetHung(); },
    /** The next call to `fn` (or the first whose `when(args, out)` holds) lands and never answers. */
    hang(fn, when) { hangs.push({ fn, when }); resetHung(); },
    /** Run `then(args, out)` right after the next call to `fn` lands, before its caller hears. */
    after(fn, then, when) { afters.push({ fn, then, when }); },
    /** A job's stored request: `{ url, body }` with the body parsed. */
    bodyOf(jobId) { const o = filed.get(jobId); if (!o) return null; let body = null; try { body = JSON.parse(o.body); } catch { body = null; } return { url: o.url, body }; },
    /** A call to the job table's stand-in as a Worker makes it — a press's filing, in a case that races it with something else. */
    rpc(fn, args) { return rpc[fn](args); },
    /** A person settles a job under review, as `edit_reconcile` lets them. */
    reconcile(jobId, committed) { return rpc.edit_reconcile({ p_id: jobId, p_committed: committed, p_note: "settled by the case" }); },
    /** The next write to a key `match(key, body)` accepts lands and never answers. */
    hangPut(match) { putFaults.push({ kind: "hang", match }); resetHung(); },
    /** The next write to a key `match(key, body)` accepts fails outright. */
    failPut(match) { putFaults.push({ kind: "fail", match }); },
    /** The next write to a key `match(key, body)` accepts lands, runs `then(key)`, and throws: a committed write whose answer is lost. */
    losePut(match, then) { putFaults.push({ kind: "lose", match, then }); },
    /** The next read of a key `match(key)` accepts throws. */
    failGet(match) { getFaults.push({ match }); },
    /** The next read of the job table whose address `match(url)` accepts answers 503. */
    failRead(match) { readFaults.push({ match }); },
    /** Before the next write to a key `match(key)` accepts, run `then(key)`; the write then meets what it left. */
    beforePut(match, then) { beforePuts.push({ match, then }); },
    /** Before the next delete of a key `match(key)` accepts, run `then(key)`; the delete then goes ahead. */
    beforeDelete(match, then) { beforeDeletes.push({ match, then }); },
    /** The next call to `fn` (or the first whose `when(args)` holds) is refused before it lands. */
    failRpc(fn, when) { rpcFaults.push({ fn, when }); },
    /** The next queue send lands and its sender never hears. */
    hangSend() { sendHangs++; resetHung(); },
    /** Clear a crash: the next deliveries run normally. */
    recover() { resetHung(); },
    /** The end of a case: no timer of a crashed or finished invocation outlives it, and the real wire is back. */
    close() { closed = true; for (const t of timers) realClearInterval(t); timers.clear(); beatsOf.clear(); uninstall(); },
    /** Run every live interval once, now — a running job's heartbeat, which picks up a stop, as a long step would have had it. */
    async beatNow() { for (const f of [...beatsOf.values()]) { try { await f(); } catch { /* a heartbeat's own failure is the job's to read */ } } },
    /** Every job of a request, by its key, oldest first. */
    jobsOf(key) { return [...jobs.values()].filter((j) => typeof j.idem_key === "string" && j.idem_key.startsWith(key + "-p")).sort((a, b) => a.created_at - b.created_at); },
    /** What a job's stored answer said. */
    answerOf(j) { try { return JSON.parse(j.result.body); } catch { return null; } },
    record(key) { const o = objects.get("requests/" + slug + "/" + key + ".json"); return o ? JSON.parse(o.body) : null; },
    /** A job's progress record as the bucket holds it (2026-10-06). */
    progressOf(jobId) { const o = objects.get("jobs/" + jobId + ".progress.json"); return o ? JSON.parse(o.body) : null; },
    question() { const o = objects.get("source/" + slug + "/question.json"); return o ? JSON.parse(o.body) : null; },
    page(path) { return (JSON.parse(objects.get(SOURCE_KEY(slug)).body).find((p) => p.path === path) || {}).source; },
    pages() { return JSON.parse(objects.get(SOURCE_KEY(slug)).body).map((p) => p.path); },
    look() { return (JSON.parse(objects.get(CONFIG_KEY(slug)).body || "{}").look || {}); },
    /** Ledger rows that moved money for this owner: debits negative, refunds positive. */
    spent() { return -ledger.reduce((n, e) => n + e.delta, 0); },
    /**
     * THE FACTS BEHIND A REPLY THE PAGE WAS SERVED (2026-10-04): replies are
     * written in the background, so the last call the writer took need not be
     * the reply a read hands back — the stand-in's answer is its facts joined,
     * so the call whose answer is exactly this text is the one behind it.
     */
    factsOf(reply) {
      if (typeof reply !== "string") return null;
      for (let i = replyLog.length - 1; i >= 0; i--) if (replyLog[i].map((f) => f.text).join(" ") === reply) return replyLog[i];
      return null;
    },
  };
  return P;
}

/**
 * A MODEL THAT TAKES `ms` TO ANSWER (2026-10-04): resolves after `ms` of real
 * time, or rejects the moment the caller's `signal` aborts — a call cut by its
 * own timer ends then, as a fetch does, and takes no answer with it.
 */
export function heldFor(ms, signal) {
  return new Promise((ok, no) => {
    if (signal && signal.aborted) { no(signal.reason || new Error("aborted")); return; }
    const t = setTimeout(ok, ms);
    if (signal) signal.addEventListener("abort", () => { clearTimeout(t); no(signal.reason || new Error("aborted")); }, { once: true });
  });
}

/** The routing call as the browser makes it, with the message's key (`idem`). */
export async function sendMessage(P, { message, key = newKey(), images, ask, attached, tz = "Europe/London", recent, picker = "sonnet", site } = {}) {
  const worker = await loadWorker();
  return P.run(async () => {
    const ctx = makeCtx();
    const body = {
      message, site: site || { name: "Harbour Loaf", url: "https://" + P.slug + ".gofarther.app", pages: ROUTES, tables: [] },
      picker, firstBuild: false, brief: message, qa: [], answering: !!ask, attached: attached === undefined ? !!(images && images.length) : attached,
      slug: P.slug, hasSite: true, idem: key, tz, ...(recent ? { recent } : {}), ...(images ? { images } : {}), ...(ask ? { ask } : {}),
    };
    const go = (async () => {
      const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
        method: "POST", headers: { "content-type": "application/json", Authorization: TOKEN }, body: JSON.stringify(body),
      }), P.env, ctx);
      await Promise.allSettled(ctx.pending);
      return { status: res.status, body: await res.json().catch(() => null), key };
    })();
    // A CALL THAT CRASHED MID-WAY never answers: the browser saw nothing.
    return Promise.race([go, P.hung.promise.then((what) => ({ status: 0, body: null, key, hung: what }))]);
  });
}

/**
 * Deliver queued messages to the real consumer, one at a time, until none are
 * left (or `max`). A hung call ends that delivery. WITH `due` (2026-10-04),
 * only messages whose time has come on the platform's clock — sent at `at`,
 * with their `delaySeconds` — are delivered; the rest stay queued, as the real
 * queue holds a delayed message until its time.
 */
export async function pump(P, { max = 40, twice = false, due = false } = {}) {
  const worker = await loadWorker();
  let n = 0;
  const ready = (m) => !due || (m.at || 0) + (m.delaySeconds || 0) * 1000 <= P.now();
  while (n < max) {
    const at = P.queue.findIndex(ready);
    if (at < 0) break;
    const m = P.queue.splice(at, 1)[0];
    const deliveries = twice ? 2 : 1;
    for (let d = 0; d < deliveries; d++) {
      n++;
      await P.run(async () => {
        const ctx = makeCtx();
        const done = (async () => {
          await worker.queue({ messages: [{ body: m.body, ack() {}, retry() {} }] }, P.env, ctx);
          await Promise.allSettled(ctx.pending);
        })();
        const which = await Promise.race([done.then(() => "done"), P.hung.promise.then(() => "hung")]);
        if (which === "hung") { done.catch(() => {}); }
      });
      if (P.hung.what) return { hung: P.hung.what, delivered: n };
    }
  }
  return { delivered: n, left: P.queue.length };
}

/** One queued message, delivered to the real consumer and waited for; a crash ends it as `pump`'s does. */
export async function deliver(P, m) {
  const worker = await loadWorker();
  return P.run(async () => {
    const ctx = makeCtx();
    const done = (async () => {
      await worker.queue({ messages: [{ body: m.body, ack() {}, retry() {} }] }, P.env, ctx);
      await Promise.allSettled(ctx.pending);
    })();
    const which = await Promise.race([done.then(() => "done"), P.hung.promise.then(() => "hung")]);
    if (which === "hung") done.catch(() => {});
    return which;
  });
}

/**
 * THE QUEUE RUNS ITS MESSAGES SIDE BY SIDE (2026-10-04): every queued message
 * is delivered as `pump` does, except those `hold(m)` picks, which are started
 * and left running beside the rest — a slow reply on the real queue, which
 * `max_concurrency` runs beside the next part's job. Returns the started
 * deliveries, for the case to wait on.
 */
export async function pumpBeside(P, hold, { max = 60 } = {}) {
  const running = [];
  for (let n = 0; n < max && P.queue.length; n++) {
    const m = P.queue.shift();
    if (hold(m)) { running.push(deliver(P, m)); continue; }
    await deliver(P, m);
    if (P.hung.what) break;
  }
  return running;
}

/** The two-minute cron, as the platform fires it: the sweeps, then the request sweep. */
export async function tick(P) {
  const worker = await loadWorker();
  return P.run(async () => {
    const ctx = makeCtx();
    const go = (async () => {
      await worker.scheduled({ cron: "*/2 * * * *", scheduledTime: P.now() }, P.env, ctx);
      for (let i = 0; i < 5 && ctx.pending.length; i++) { const p = ctx.pending.splice(0); await Promise.allSettled(p); }
      return {};
    })();
    return Promise.race([go, P.hung.promise.then((what) => ({ hung: what }))]);
  });
}

/**
 * A READ WHOSE REPLY IS WRITTEN IN THE BACKGROUND (2026-10-04), as the page
 * makes it: read; while the answer says its reply is still being written
 * (`replyState: "pending"`), let the queue deliver what was asked for and read
 * again — the page polls the same way. `rounds` bounds it; the last read is
 * returned whatever it says.
 */
export async function readWritten(P, path, { rounds = 3 } = {}) {
  let v = await call(P, "GET", path);
  for (let i = 0; i < rounds && v.body && v.body.replyState === "pending"; i++) {
    await pump(P);
    v = await call(P, "GET", path);
  }
  return v;
}

/** An owner route call (the request routes, the question route, a job poll); `auth` replaces the owner's sign-in (a job's gateway token). */
export async function call(P, method, path, body, auth = TOKEN) {
  const worker = await loadWorker();
  return P.run(async () => {
    const ctx = makeCtx();
    const go = (async () => {
      const res = await worker.fetch(new Request("https://gofarther.dev" + path, {
        method, headers: { "content-type": "application/json", Authorization: auth }, body: body === undefined ? undefined : JSON.stringify(body),
      }), P.env, ctx);
      await Promise.allSettled(ctx.pending);
      return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
    })();
    return Promise.race([go, P.hung.promise.then((what) => ({ status: 0, body: null, hung: what }))]);
  });
}

/** Run every queued job and the steps after them until the request ends or nothing moves (`due`: as `pump`'s). */
export async function settle(P, key, { rounds = 12, due = false } = {}) {
  for (let i = 0; i < rounds; i++) {
    const r = await pump(P, { due });
    if (r.hung) return { hung: r.hung, rec: P.record(key) };
    const rec = P.record(key);
    if (!rec || rec.ended || (!P.queue.length && rec.state !== "running")) return { rec };
    if (!P.queue.length) { const t = await tick(P); if (t && t.hung) return { hung: t.hung, rec: P.record(key) }; }
  }
  return { rec: P.record(key) };
}

/**
 * THE BROWSER'S OWN POST FOR THE SAME DECISION — `siteEdit` or `siteAddon`, cut
 * out of public/chat.js and run with a stand-in `apiFetch` — so a part's
 * stored job body can be compared field for field with what the page sends.
 */
export function browserBody(site, d, instruction, imgs = []) {
  const sentPosts = [];
  const ctx = vm.createContext({
    editBlocked: new Set(), editInFlight: new Map(), editIdem: new Map(),
    EditPoll: { ...realEditPoll, newIdemKey: () => "idem-from-the-page-000", outcomeMessage: (s) => "outcome:" + s },
    buildPicker: "sonnet", browserTimeZone: () => "Europe/London",
    apiFetch: (url, init) => { sentPosts.push({ url, init }); return new Promise(() => {}); },
  });
  vm.runInContext([cut("editAsk"), cut("editAskDone"), cut("siteEdit"), cut("siteAddon")].join("\n"), ctx);
  if (d.intent === "addon") ctx.siteAddon(site, instruction, "origin-1", () => {}, () => {}, d, imgs);
  else ctx.siteEdit(site, d, instruction, "origin-1", () => {}, () => {}, imgs, false);
  assert.equal(sentPosts.length, 1, "the page made " + sentPosts.length + " requests, not one");
  return { url: sentPosts[0].url, body: JSON.parse(sentPosts[0].init.body) };
}

export { CHAT, after };
