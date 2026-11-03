// PARKED (2026-11-03, park-old-way): the old-way half of test/addon-row.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// ONE MORE ENTRY IN A LIST THE SITE ALREADY STORES, through the add-on step
// (Test 11's capability, 2026-10-01).
//
// THE OWNER'S RULE IS "Add will always go in addon", and until this change no
// add-on kind could add a row to a table the site already has: the trace found
// a refusal or a hand-drawn card on the page while the list, the order form's
// choices and the Data panel stayed as they were. The `row` kind writes the
// entry to the table the pages already read, with the data step's own
// parameterised INSERT, and changes no page.
//
// EVERYTHING HERE GOES THROUGH THE REAL ROUTE, against a database that already
// HAS entries (`fixtures/rows-db.mjs`): the router's answer, the browser's own
// add-on request, the add-on route (inline and through the queue, with the job
// RPCs the live ledger runs), and the customer's screen from the browser's own
// composer. Every model answer is supplied; no model, container, credit or
// network is used. Whether a real router and a real picker answer this way is
// NOT shown here — that is the live test's to show.
//
// RED BEFORE THE FIX: on the code before `row` existed, the picker's answer is
// refused down to no kinds, the route answers `no-add`, and nothing is written —
// so every success case below fails there (the red check is recorded in
// `docs/history/2026-10-01-add-row.md`).
import { PICTOGRAPH } from "../../../test/fixtures/pictograph.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import vm from "node:vm";
import { createRequire } from "node:module";
import { loadWorker, loadWorkerModule, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { isDispatchUpload, dispatchOk } from "../../../test/fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import { ASK_TOOL } from "../../../builder/route-shared.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../../../builder/edit-job.mjs";
import { browserReply } from "../../../scripts/addon-sweep.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "../../../test/fixtures/rows-db.mjs";
import { addon } from "../../../test/fixtures/addon-route.mjs";
import { readDataChanges } from "../../../builder/site-apply.mjs";
import { resolveAccess, ACCESS_PRESETS } from "../../../site-access.mjs";
// THE PAGE'S OWN POLLER UNDER THE STAND-IN (2026-10-02): the held-part helpers
// the posts and the last sentence use (`heldWire`, `heldList`) are its real ones,
// and only the key and the outcome wording are made deterministic here.
const realEditPoll = createRequire(import.meta.url)("../../../public/edit-poll.js");
// THE NEW PIECES ARE IMPORTED WHERE THEY ARE USED, so this file loads on the
// code before them too: the red check runs every route case against the old
// route, and only the cases about the new pieces fail to find them.
const add = () => import("../../../builder/site-add.mjs");
const rowsModule = () => import("../../../builder/site-rows.mjs");

const USER = { id: "u-addon-row-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const CONN = "postgres://u:p@ep-rows.neon.tech/neondb";
const hex = (n) => randomBytes(n).toString("hex");
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

// ─────────────────────────────────────────────────────────────────────────────
// THE SITE: the bakery's stored pages and schema, and a database with entries
// ─────────────────────────────────────────────────────────────────────────────

const PAGES = ["index.tsx", "order.tsx", "starter.tsx", "visit.tsx", "gallery.tsx"].map((path) => ({
  path, source: readFileSync(new URL("../../../test/fixtures/run47/" + path.replace(/\.tsx$/, ".before.tsx"), import.meta.url), "utf8"),
}));
const ROUTES = ["/", "/order", "/starter", "/visit", "/gallery"];
// `loaves` the owner's display list, `orders` the visitors' submissions.
const SPEC = { tables: [
  { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" },
  { name: "orders", columns: [{ name: "customer_name", type: "text" }, { name: "loaf", type: "int" }], read: "none", write: "anyone" },
] };
const ORDER_COLUMNS = [{ name: "id", type: "integer" }, { name: "customer_name", type: "text" }, { name: "loaf", type: "integer" }, { name: "created_at", type: "timestamp with time zone" }];
const ORDERS = [{ id: 1, customer_name: "A. Visitor", loaf: 2, created_at: "2026-09-02 10:00:00" }];

/**
 * THE DATABASE, as the bakery holds it. `next` is the sequence's own position:
 * 12, not 7, as on a table that has lost entries — so a test that reads 7 back
 * would be reading a guess, not the database's answer.
 */
function bakeryDb(opts = {}) {
  return rowsDb({
    tables: {
      loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12, unique: opts.unique || [] },
      orders: { columns: ORDER_COLUMNS, rows: ORDERS },
    },
    meta: { schema: JSON.stringify(SPEC), ...(opts.meta || {}) },
    failWrite: opts.failWrite || null,
    hideMarker: opts.hideMarker || 0,
    noMeta: !!opts.noMeta,
    loseAnswer: opts.loseAnswer || 0,
    inFlight: opts.inFlight || 0,
    landOnClose: !!opts.landOnClose,
    garbleAnswer: opts.garbleAnswer || 0,
    failKeyReads: opts.failKeyReads || 0,
  });
}

const ASK = "Add one loaf to today's loaves: Rye & Caraway at £5.00, described as \"A light rye with toasted caraway.\"";
const ENTRY = { table: "loaves", values: { name: "Rye & Caraway", price: 5, description: "A light rye with toasted caraway." } };
const PICK_ROW = { kinds: ["row"] };

function bucket(slug) {
  const store = new Map();
  store.set("source/" + slug + "/pages.json", JSON.stringify(PAGES));
  store.set("source/" + slug + "/parts.json", JSON.stringify([]));
  store.set(CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fold Lane Bakery", theme: "broadsheet" }, css: "" }));
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    // AN OBJECT BACK, as R2 answers a put that landed (a conditional draft save reads it).
    async put(k, v) { store.set(k, String(v)); return { key: k }; },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE WIRE: the model per tool, the job RPCs as the live ledger answers them,
// the database, and one timeline of what happened in what order
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `edit_create` IS IDEMPOTENT ON (uid, slug, op, idem) and `edit_reserve` ON
 * (job, seq), as the live functions are (`supabase/applied/…live_snapshot…`):
 * a second create with the same key answers the first job as a duplicate, a
 * second reserve of the same sequence answers `repeat` and charges nothing.
 *
 * AND EACH JOB HAS ITS ROW (2026-10-01, the review of f6532d66), kept by the
 * rules the live functions keep: `edit_publish_mark` records the start of a
 * write only for the lease's holder; `edit_finalize` stores the reply first,
 * then finishes a job that published, or one that never began and answered
 * ok; `edit_refund` refuses a published job, parks one that began (needs
 * review, the money where it is) and gives a reserve back otherwise;
 * `edit_reconcile` settles only a job under review; `edit_create` refuses a
 * site with a job under review; and the reconcile reads the rows back by id
 * or by review, as `readEditRows` asks PostgREST.
 */
function wire({ db, answers, slug, reserveRefuses = false, usage = {}, markRefuses = 0, markLost = null, commitRefuses = false, exempt = false, mayLost = null }) {
  const real = globalThis.fetch;
  const seen = { timeline: [], models: [], debits: [], rpc: [], uploads: 0, jobs: new Map(), ledger: new Map(), done: new Set(), rows: new Map(), refunds: [], consumerDown: false };
  // THE PROTECTION'S FAILURES (2026-10-01, the review of 31741f6f): the first
  // `markRefuses` marks are refused outright; the first `markLost.n` answer a
  // 503 — after applying the mark when `markLost.applied`, as an RPC whose
  // commit landed and whose answer did not.
  let refuseMarks = markRefuses === true ? Infinity : Number(markRefuses) || 0;
  let loseMarks = markLost ? Number(markLost.n) || 1 : 0;
  // AND THE GATE'S (2026-10-01, the review of c3e310e6): the first `mayLost.n`
  // answers of `edit_may_publish` are a 503 — after granting when
  // `mayLost.applied`. Its refusals are the ledger's own, from the row.
  let loseMays = mayLost ? Number(mayLost.n) || 1 : 0;
  const TERMINAL = ["done", "failed", "cancelled", "lost"];
  const unavailable = () => new Response("unavailable", { status: 503 });
  const now = () => new Date().toISOString();
  const rowOf = (id, init = {}) => {
    if (!seen.rows.has(id)) {
      seen.rows.set(id, { id, uid: USER.id, slug, op: "addon", state: "queued", phase: null, billing: "none", cost: 0,
        needs_review: false, review_note: null, artifact_build: null, worker_status: null, publish_started_at: null,
        published_at: null, result: null, lease_owner: null, updated_at: now(), ...init });
    }
    return seen.rows.get(id);
  };
  // THE LOST-JOB SWEEP, by the live function's rules: a job no longer leased
  // (the test says which, `lease_expired`), not finished and not under review,
  // goes through `edit_refund(lost)`, which KEEPS `lease_owner` — refused when
  // it published (finalized as recovered), parked when its write began,
  // refunded otherwise. Also what a hook calls to make the sweep run while a
  // consumer is stalled.
  seen.sweepLost = () => {
    const out = { ok: true, lost: 0, review: 0, recovered: 0, exhausted: 0, stuck: 0, refunded: 0 };
    for (const r of seen.rows.values()) {
      if (!r.lease_expired || r.needs_review || ["done", "failed", "cancelled", "lost"].includes(r.state)) continue;
      if (r.published_at) {
        r.result = { status: 200, type: "application/json", body: JSON.stringify({ ok: true, recovered: true, job: r.id, cost: r.cost, build: r.artifact_build }) };
        r.state = "done"; if (r.billing === "reserved") r.billing = "finalized"; seen.done.add(r.id);
        out.recovered++; continue;
      }
      if (r.publish_started_at) { r.state = "lost"; r.needs_review = true; r.review_note = "lease expired"; out.review++; continue; }
      seen.done.add(r.id); r.state = "lost";
      if (r.billing === "reserved") { r.billing = "refunded"; seen.refunds.push(r.cost); out.refunded += r.cost; }
      out.lost++;
    }
    return out;
  };
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = url.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      seen.timeline.push("rpc:" + fn);
      switch (fn) {
        case "edit_create": {
          if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(args.p_idem || ""))) return json({ ok: false, error: "bad-idem" });
          const key = [args.p_uid, args.p_slug, args.p_op, args.p_idem].join("|");
          if (seen.jobs.has(key)) return json({ ok: true, job: seen.jobs.get(key), state: "queued", duplicate: true });
          // A SITE UNDER REVIEW TAKES NO NEW EDITS — the live gate.
          const blocked = [...seen.rows.values()].find((r) => r.slug === args.p_slug && r.needs_review);
          if (blocked) return json({ ok: false, error: "needs-review", job: blocked.id });
          seen.jobs.set(key, args.p_id);
          rowOf(args.p_id, { uid: args.p_uid, slug: args.p_slug, op: args.p_op });
          return json({ ok: true, job: args.p_id, state: "queued", duplicate: false });
        }
        // A JOB THAT HAS FINISHED IS NOT CLAIMED AGAIN — the live function's
        // `terminal` answer, and `settled` for one paid for or paid back — so a
        // second delivery of its message runs nothing. A job claimed again keeps
        // its state, as the live claim does; only a queued one becomes claimed.
        case "edit_claim": {
          const r = rowOf(args.p_id);
          if (r.needs_review) return json({ ok: true, claimed: false, state: r.state, error: "needs-review" });
          if (seen.done.has(args.p_id)) return json({ ok: true, claimed: false, state: "done", reason: "terminal" });
          if (r.billing === "finalized" || r.billing === "refunded") return json({ ok: true, claimed: false, state: r.state, error: "settled" });
          r.lease_owner = args.p_owner; r.lease_expired = false; if (r.state === "queued") r.state = "claimed"; r.updated_at = now();
          return json({ ok: true, claimed: true, state: "claimed", billing: r.billing, uid: r.uid, slug: r.slug, needs_review: false });
        }
        case "edit_beat": {
          const r = rowOf(args.p_id);
          if (args.p_phase) r.phase = args.p_phase;
          return json({ ok: true, alive: true, state: "routing", cancel: false });
        }
        // THE LIVE RESERVE: a finished job is refused; the same sequence again
        // charges nothing; a founder's job is `exempt` at cost 0, no debit.
        // `afterReserve` is a consumer that stalls once the reserve has landed
        // — whatever the test makes happen meanwhile happens here.
        case "edit_reserve": {
          if (reserveRefuses) return json({ ok: false, error: "insufficient", cost: 0 });
          const r = rowOf(args.p_id);
          if (TERMINAL.includes(r.state)) return json({ ok: false, error: "terminal", state: r.state });
          const ref = args.p_id + "#" + args.p_seq;
          if (seen.ledger.has(ref)) return json({ ok: true, charged: 0, cost: r.cost, billing: r.billing, repeat: true });
          let out;
          if (exempt) { r.billing = "exempt"; r.cost = 0; out = { ok: true, charged: 0, cost: 0, billing: "exempt" }; }
          else {
            seen.ledger.set(ref, Number(args.p_cost) || 0);
            r.cost += Number(args.p_cost) || 0; r.billing = "reserved";
            out = { ok: true, charged: Number(args.p_cost) || 0, cost: r.cost, billing: "reserved" };
          }
          if (typeof seen.afterReserve === "function") { const f = seen.afterReserve; seen.afterReserve = null; f(r); }
          return json(out);
        }
        case "edit_exempt": {
          const r = rowOf(args.p_id);
          if (r.billing === "none") r.billing = "exempt";
          return json({ ok: true, billing: r.billing, state: "routing" });
        }
        // THE GATE, AS THE LIVE FUNCTION KEEPS IT: one conditional update that
        // grants only the lease's holder, its lease live, no cancel asked, not
        // under review, not finished, and billed (`reserved` or `exempt`) — and
        // marks the start of the write in the same statement. Told why when not.
        case "edit_may_publish": {
          const r = rowOf(args.p_id);
          if (loseMays > 0 && !mayLost.applied) { loseMays--; return unavailable(); }
          const ok = r.lease_owner === args.p_owner && !r.lease_expired && !r.cancel_requested && !r.needs_review
            && !TERMINAL.includes(r.state) && (r.billing === "reserved" || r.billing === "exempt");
          if (!ok) {
            const error = r.cancel_requested ? "cancelled" : r.needs_review ? "needs-review" : r.lease_owner !== args.p_owner ? "lease-lost"
              : r.lease_expired ? "lease-expired" : r.billing === "none" ? "unbilled" : "terminal";
            return json({ ok: true, granted: false, state: r.state, error });
          }
          r.state = "publishing"; r.publish_started_at = r.publish_started_at || now(); r.updated_at = now();
          if (loseMays > 0) { loseMays--; return unavailable(); }
          return json({ ok: true, granted: true });
        }
        case "edit_phase_write": return json({ ok: true });
        // THE LIVE MARK matches the job and its holder, and nothing else — a
        // refunded job's holder is still on its row. `beforeMark` is a consumer
        // that stalls between its gate and its mark.
        case "edit_publish_mark": {
          const r = rowOf(args.p_id);
          if (typeof seen.beforeMark === "function") { const f = seen.beforeMark; seen.beforeMark = null; await f(r); }
          if (refuseMarks > 0) { refuseMarks--; return json({ ok: false }); }
          if (loseMarks > 0 && !markLost.applied) { loseMarks--; return unavailable(); }
          if (r.lease_owner !== args.p_owner) return json({ ok: false });
          if (args.p_artifact_build !== null && args.p_artifact_build !== undefined) r.artifact_build = args.p_artifact_build;
          r.publish_started_at = r.publish_started_at || now(); r.updated_at = now();
          if (loseMarks > 0) { loseMarks--; return unavailable(); }
          return json({ ok: true });
        }
        case "edit_committed": {
          const r = rowOf(args.p_id);
          // THE COMMIT WALL (stage 6): only the holder, its lease live, the job
          // not finished — as the live function asks.
          if (commitRefuses) return json({ ok: false, error: "lease-expired", state: r.state });
          if (TERMINAL.includes(r.state)) return json({ ok: false, error: "terminal", state: r.state });
          if (r.lease_owner !== args.p_owner) return json({ ok: false, error: "not-holder" });
          if (r.lease_expired) return json({ ok: false, error: "lease-expired", state: r.state });
          r.published_at = r.published_at || now();
          return json({ ok: true });
        }
        // A CONSUMER THAT CANNOT SETTLE: its reply is never stored and its
        // refund never lands, as when Supabase is out of its reach — or it is
        // gone, and the sweep is what finds the job.
        case "edit_finalize": {
          if (seen.consumerDown) return unavailable();
          const r = rowOf(args.p_id);
          if (args.p_result) r.result = args.p_result;
          if ((r.published_at || (!r.publish_started_at && args.p_ok)) && !["cancelled", "lost", "failed"].includes(r.state)) {
            r.state = "done"; if (r.billing === "reserved") r.billing = "finalized";
            seen.done.add(args.p_id);
            return json({ ok: true, billing: r.billing, cost: r.cost, published: !!r.published_at });
          }
          return json({ ok: false, state: r.state, error: r.published_at ? "terminal" : "not-published" });
        }
        case "edit_refund": {
          if (seen.consumerDown) return unavailable();
          const r = rowOf(args.p_id);
          if (r.published_at) return json({ ok: false, error: "published", state: r.state });
          if (r.state === "done") return json({ ok: false, error: "terminal", state: r.state });
          if (r.publish_started_at) {
            r.state = args.p_state; r.needs_review = true; r.review_note = args.p_note || "died during publish";
            return json({ ok: false, error: "needs-review", refunded: 0 });
          }
          seen.done.add(args.p_id);
          if (r.billing === "reserved") {
            const back = r.cost;
            r.billing = "refunded"; r.state = args.p_state; seen.refunds.push(back);
            return json({ ok: true, refunded: back });
          }
          r.state = args.p_state;
          return json({ ok: true, refunded: 0, billing: r.billing });
        }
        case "edit_reconcile": {
          const r = rowOf(args.p_id);
          if (!r.needs_review) return json({ ok: false, error: "not-in-review", state: r.state });
          r.review_note = args.p_note || r.review_note; r.needs_review = false;
          if (args.p_committed) {
            r.published_at = r.published_at || now(); r.state = "done";
            if (r.billing === "reserved") r.billing = "finalized";
            seen.done.add(args.p_id);
            return json({ ok: true, outcome: "kept", cost: r.cost });
          }
          const back = r.billing === "reserved" ? r.cost : 0;
          if (r.billing === "reserved") { r.billing = "refunded"; seen.refunds.push(back); }
          r.state = "failed"; seen.done.add(args.p_id);
          return json({ ok: true, outcome: "refunded", refunded: back });
        }
        // THE LOST-JOB SWEEP, by the live function's rules: a job no longer
        // leased (the test says which, `lease_expired`), not finished and not
        // under review, goes through `edit_refund(lost)` — refused when it
        // published (finalized as recovered), parked when its write began,
        // refunded otherwise.
        case "edit_sweep_lost": return json(seen.sweepLost());
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    // THE ROWS, READ BACK BY THE RECONCILE (`readEditRows`): by id, or every
    // row under review on a slug — PostgREST's own filters.
    if (url.includes("/rest/v1/edit_jobs?")) {
      const q = new URL(url).searchParams;
      const id = (q.get("id") || "").replace(/^eq\./, "");
      const review = q.get("needs_review") === "eq.true";
      const onSlug = (q.get("slug") || "").replace(/^eq\./, "");
      const rows = [...seen.rows.values()].filter((r) => (!id || r.id === id) && (!review || r.needs_review) && (!onSlug || r.slug === onSlug));
      return json(rows.map((r) => ({ ...r })));
    }
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/get_credits")) return json(50);
    if (url.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); seen.timeline.push("debit"); return json(Number(args.cost) || 0); }
    if (url.includes("/rest/v1/edit_traces")) return json([], 201);
    // A BLANK REFERENCE AND A REAL DATABASE — the demo sites' own state.
    if (url.includes("/rest/v1/site_backends")) {
      const m = String((init && init.method) || "GET").toUpperCase();
      if (m === "PATCH") return json([{ slug: "x", neon_db: "sitedb" }]);
      if (m === "POST") return json([], 201);
      return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    }
    if (url.includes("/rest/v1/site_project")) return json([{ uid: USER.id, neon_project: "proj-1", neon_branch: "br-1", neon_role: "owner", neon_conn: CONN }]);
    if (url.includes("/rest/v1/")) return json([]);
    if (url.includes("neon.tech/sql")) {
      const q = String(args.query || "");
      // A CONSUMER THAT STALLS WITH ITS ROW STATEMENT IN HAND: whatever the
      // test makes happen meanwhile happens before the statement is sent.
      if (q.startsWith("WITH r0") && typeof seen.beforeRowStatement === "function") { const f = seen.beforeRowStatement; seen.beforeRowStatement = null; f(); }
      seen.timeline.push("sql:" + q.slice(0, 40));
      const own = db.answer(q, Array.isArray(args.params) ? args.params : []);
      if (own) return own;
      return json({ command: "SELECT", rowCount: 0, rows: [], fields: [] });
    }
    if (url.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.models.push({ tool, args });
      seen.timeline.push("model:" + tool);
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      const a = typeof answers[tool] === "function" ? answers[tool](args) : answers[tool];
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: a }], usage: Object.hasOwn(usage, tool) ? usage[tool] : { input_tokens: 10, output_tokens: 5 } });
    }
    if (isDispatchUpload(url)) { seen.uploads++; return dispatchOk(); }
    return new Response("unavailable", { status: 503 });
  };
  return { seen, restore: () => { globalThis.fetch = real; } };
}

const baseEnv = (store, extra = {}) => ({
  SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key",
  SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...extra,
});

/** The add-on POST, as `siteAddon` sends it (picked model pinned, so the Anthropic shape answers). */
const post = (slug, body) => new Request("https://gofarther.dev/api/site/" + slug + "/addon", {
  method: "POST", headers: { "content-type": "application/json", Authorization: TOKEN }, body: JSON.stringify(body),
});

/** Run one stored job through the real queue consumer, as many times as asked. */
async function runJob(worker, env, id) {
  const ctx = makeCtx();
  await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
  await Promise.allSettled(ctx.pending || []);
}

/** The reply the consumer stored for a job, as the browser's poll reads it. */
function storedReply(seen, nth = -1) {
  const fins = seen.rpc.filter((r) => r.fn === "edit_finalize");
  assert.ok(fins.length, "the queued job never finalized: " + JSON.stringify(seen.rpc.map((r) => r.fn)));
  const fin = fins.at(nth);
  return { status: fin.args.p_result.status, body: JSON.parse(fin.args.p_result.body), ok: fin.args.p_ok };
}

/** The customer's screen, from the browser's own add-on composer. */
function screen(status, body) {
  const said = browserReply(body, status >= 200 && status < 300);
  assert.ok(said.ok, "the browser's own composer could not run: " + said.why);
  return said;
}

const writesOf = (db) => db.writes().map((w) => w.query);
const unchangedSix = (db) => assert.deepEqual(db.rows("loaves").slice(0, 6), BAKERY_LOAVES, "an existing entry moved");

// ─────────────────────────────────────────────────────────────────────────────
// THE BROWSER HOP, DRIVEN: `siteAddon` cut out of chat.js
// ─────────────────────────────────────────────────────────────────────────────

const CHAT = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cut = (head) => {
  const open = CHAT.indexOf("\nfunction " + head + "(");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(open > 0 && shut > open, head + "'s landmarks are gone from chat.js");
  return CHAT.slice(open, shut + 2);
};

/** What the browser POSTs for an `addon` routing answer — URL and body exactly as sent. */
function browserAddonPost(site, d, instruction) {
  const sent = [];
  const ctx = vm.createContext({
    EditPoll: { ...realEditPoll, newIdemKey: () => "idem-addon-row-" + hex(8) },
    buildPicker: "sonnet", browserTimeZone: () => "Europe/London",
    apiFetch: (url, init) => { sent.push({ url, init }); return new Promise(() => {}); },
  });
  vm.runInContext(cut("siteAddon"), ctx);
  ctx.siteAddon(site, instruction, "origin-1", () => {}, () => {}, d);
  assert.equal(sent.length, 1, "the browser made " + sent.length + " requests, not one");
  return { url: sent[0].url, body: JSON.parse(sent[0].init.body) };
}

/**
 * ONE MESSAGE THROUGH THE WHOLE CHAIN: the routing route answers `addon`, the
 * browser composes its add-on POST, the add-on route runs it — inline, or
 * filed and run by the queue consumer — and the browser's composer reads it.
 */
async function chain({ mode, db, answers, message = ASK, usage, draftFirst = false }) {
  const slug = "addon-row-" + mode + "-" + hex(4);
  const store = bucket(slug);
  // PUBLISHED, UNDER DRAFT-FIRST: a live pointer, so an entry is held.
  if (draftFirst) { store.store.set("current/" + slug + ".json", JSON.stringify({ version: "01790000000000-aaaaaa" })); store.store.set("source/" + slug + "/head.json", JSON.stringify({ version: "01790000000000-aaaaaa" })); }
  const w = wire({ db, slug, answers: { [ASK_TOOL.name]: { intent: "addon" }, ...answers }, usage });
  try {
    const worker = await loadWorker();
    const env = { ...baseEnv(store, mode === "job" ? { EDIT_ASYNC: "1", EDIT_ASYNC_CANARY: slug, BUILD_QUEUE: { send: async (m) => { w.seen.sent = (w.seen.sent || []).concat([m]); } } } : {}), ...(draftFirst ? { DRAFT_FIRST: "on" } : {}) };
    const rres = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST", headers: { "content-type": "application/json", Authorization: TOKEN },
      body: JSON.stringify({ message, site: { name: "Fold Lane Bakery", url: "https://" + slug + ".gofarther.app", pages: ROUTES, tables: ["loaves", "orders"] },
        picker: "sonnet", firstBuild: false, brief: message, qa: [], answering: false, attached: false, slug, hasSite: true }),
    }), env, makeCtx());
    const d = await rres.json();
    assert.equal(d.intent, "addon", "the routing route did not hand the browser an addon answer: " + JSON.stringify(d));
    const site = { slug, name: "Fold Lane Bakery", react: true, pages: ROUTES.map((p) => ({ path: p })), msgs: [] };
    const sent = browserAddonPost(site, d, message);
    assert.equal(sent.url, "/api/site/" + slug + "/addon", "the browser did not post to the add-on route");
    const res = await worker.fetch(post(slug, sent.body), env, makeCtx());
    let status = res.status;
    let body = await res.json().catch(() => null);
    if (mode === "job") {
      assert.equal(status, 202, "the add-on route did not file a job: " + JSON.stringify(body));
      await runJob(worker, env, body.job);
      ({ status, body } = storedReply(w.seen));
    }
    return { slug, store, d, sent, status, body, seen: w.seen, said: screen(status, body), env, worker };
  } finally { w.restore(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE ENTRY IS SAVED, WITH THE DATABASE'S OWN ID, AND NOTHING ELSE MOVES
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test(`an entry is added to a list that already has entries, with the database's id and no page work (${mode})`, async () => {
    const db = bakeryDb();
    const before = { pages: null, schema: db.meta("schema"), orders: db.rows("orders") };
    const r = await chain({ mode, db, answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
    before.pages = JSON.stringify(PAGES);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.ok, true);
    // THE DATABASE: exactly one new entry, after the six, with ITS id.
    const loaves = db.rows("loaves");
    assert.equal(loaves.length, 7, "not exactly one entry was added");
    unchangedSix(db);
    const added = loaves[6];
    assert.equal(added.id, 12, "the entry's id is not the one the database assigned");
    assert.deepEqual(added, { id: 12, name: "Rye & Caraway", description: "A light rye with toasted caraway.", price: 5, photo: null, created_at: "2026-10-01T03:00:00.000000+00:00" });
    // THE ANSWER IS WHAT WAS SAVED: the database's row, id and all.
    assert.deepEqual(r.body.kinds, ["row"]);
    assert.equal(r.body.rows.length, 1);
    assert.deepEqual(r.body.rows[0], { table: "loaves", id: 12, label: "Rye & Caraway", row: added });
    // WHAT THE CUSTOMER READS, from the browser's own composer.
    assert.equal(r.said.text, "Done — added “Rye & Caraway” to loaves (entry 12).");
    // NOTHING ELSE MOVED: the other list, the schema, the pages; no page call,
    // no compile, no publish.
    assert.deepEqual(db.rows("orders"), before.orders, "the visitors' list moved");
    assert.equal(db.meta("schema"), before.schema, "the stored schema was rewritten");
    assert.equal(r.store.store.get("source/" + r.slug + "/pages.json"), before.pages, "the stored pages changed");
    assert.ok(!r.seen.models.some((m) => m.tool === "write_pages"), "a page call was made");
    assert.equal(r.seen.uploads, 0, "something was published");
    assert.deepEqual(r.body.added, []); assert.deepEqual(r.body.changed, []);
    // ONE WRITE, AND IT IS THE ROW STEP'S: every value a bound parameter.
    const writes = writesOf(db);
    assert.equal(writes.length, 1, "more than one write: " + JSON.stringify(writes));
    assert.match(writes[0], /^WITH r0 AS \(INSERT INTO "loaves" \("name", "price", "description"\) VALUES \(\$1, \$2, \$3\) RETURNING \*\)/);
    assert.doesNotMatch(writes[0], /Rye|Caraway|toasted/, "a value was written into the SQL text instead of bound");
    // THE MODEL CALLS: the picker and the one row designer, nothing more.
    assert.deepEqual(r.seen.models.map((m) => m.tool).filter((t) => t !== ASK_TOOL.name), ["pick_adds", "add_to_site"]);
  });
}

/**
 * A FINISHED QUEUED JOB, and the two ways its request could meet the route again.
 *
 * THE MACHINERY'S OWN GUARDS COME FIRST. `edit_claim` takes only a job that has
 * not finished and holds no live lease, and the consumer deletes the stored
 * request the moment it has read it (`runQueuedSiteEdit`; the container runner
 * does the same through the gateway) — so a second delivery of a finished
 * job's message runs nothing, and a run that dies after its write leaves no
 * request to run again. `again()` is for the case those guards do not reach:
 * the same job's request run a second time with the job left open, as a run
 * that died before finishing would leave it. The `_meta` key is the last guard.
 */
async function finishedJob({ db, answers }) {
  const slug = "addon-row-replay-" + hex(4);
  const store = bucket(slug);
  const w = wire({ db, slug, answers });
  const worker = await loadWorker();
  const env = baseEnv(store);
  const id = hex(16);
  const request = () => JSON.stringify(packEditJob({
    url: "https://gofarther.dev/api/site/" + slug + "/addon",
    body: JSON.stringify({ instruction: ASK, picker: "sonnet", idem: "idem-replay-" + id, tz: "Europe/London" }),
    uid: USER.id, slug, secret: hex(16), at: Date.now(),
  }));
  store.store.set(EDIT_JOB_PREFIX + id, request());
  await runJob(worker, env, id);
  const again = async () => {
    // THE JOB LEFT OPEN, as a run that died before finishing would leave it:
    // its finalize never ran, so the reserve is still held and the write it
    // began at the gate is still under way; its lease ran out.
    const r = w.seen.rows.get(id);
    w.seen.done.delete(id);
    r.state = "publishing"; if (r.billing === "finalized") r.billing = "reserved"; r.lease_expired = true;
    store.store.set(EDIT_JOB_PREFIX + id, request());
    await runJob(worker, env, id);
  };
  return { slug, store, w, worker, env, id, again };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. WHAT IS REFUSED: nothing written, nothing charged, said by name
// ─────────────────────────────────────────────────────────────────────────────

async function refused(answer, opts = {}) {
  const db = opts.db || bakeryDb();
  const r = await chain({ mode: opts.mode || "sync", db, answers: { pick_adds: PICK_ROW, add_to_site: answer } });
  return { r, db };
}

const INVALID = [
  ["a list the site does not store", { row: [{ table: "cakes", values: { name: "Lemon drizzle" } }] }, "row-no-table", /doesn't store a list by that name/],
  ["the visitors' own list", { row: [{ table: "orders", values: { customer_name: "Somebody" } }] }, "row-not-list", /what visitors send in/],
  ["no column the list declares", { row: [{ table: "loaves", values: { flavour: "caraway", id: 4 } }] }, "row-no-values", /what that entry should say/],
  ["no values at all", { row: [{ table: "loaves", values: {} }] }, "row-no-values", /what that entry should say/],
  ["no list named", { row: [{ values: { name: "Rye" } }] }, "no-row-table", /which list that goes in/],
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. AN OUTCOME THE ROUTE CANNOT SEE (2026-10-01, the review of f6532d66)
// ─────────────────────────────────────────────────────────────────────────────
//
// THE REVIEWER'S REPRODUCTION is where these start: the entry and its key are
// COMMITTED, and the answer is lost on the way back (the driver throws, as it
// does for a lost response). On f6532d66 the step answered `row-write` —
// "nothing was added. Try again in a moment." — the consumer refunded the
// reserve, and the customer's next message saved the entry a second time.
//
// What each case pins: a write the key confirms is answered with what it saved
// and settled once (inline charged, queued kept); a write nobody can confirm is
// never called unsaved — queued, the job is put under review with the money
// held and the site paused, and the reconcile settles it from the key (closing
// an empty key first, so a write still on its way cannot land after a refund);
// inline, nothing is charged; a definite refusal by the database is still a
// refusal; and running the same request again saves and charges nothing more.

/**
 * ONE SITE KEPT OPEN across several messages and the reconcile's own doors:
 * the add-on route (inline, or filed and run by the real consumer), one
 * database, one ledger. The browser's own POST body; the reply a poll would
 * hand back is the job row's stored `result`.
 */
async function openSite({ db, mode = "job", answers = { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } }, markRefuses = 0, markLost = null, commitRefuses = false, exempt = false, mayLost = null, draftFirst = false }) {
  const slug = "addon-row-lost-" + mode + "-" + hex(4);
  const store = bucket(slug);
  // PUBLISHED, UNDER DRAFT-FIRST (audit A13-3): a live pointer, so an entry is
  // held, and that version's manifest (another job's), as a published site has.
  if (draftFirst) {
    store.store.set("current/" + slug + ".json", JSON.stringify({ version: "01790000000000-aaaaaa" }));
    store.store.set("source/" + slug + "/head.json", JSON.stringify({ version: "01790000000000-aaaaaa" }));
    store.store.set("builds/" + slug + "/01790000000000-aaaaaa/manifest.json", JSON.stringify({ job: "an-earlier-job", build: "b0", files: [{ path: "server.js" }] }));
  }
  const w = wire({ db, slug, answers, markRefuses, markLost, commitRefuses, exempt, mayLost });
  const worker = await loadWorker();
  const mod = await loadWorkerModule();
  const env = { ...baseEnv(store, mode === "job" ? { EDIT_ASYNC: "1", EDIT_ASYNC_CANARY: slug, BUILD_QUEUE: { send: async () => {} } } : {}), ...(draftFirst ? { DRAFT_FIRST: "on" } : {}) };
  const stored = (id) => {
    const r = w.seen.rows.get(id);
    assert.ok(r && r.result && typeof r.result.body === "string", "the job stored no reply");
    const body = JSON.parse(r.result.body);
    return { status: r.result.status, body, said: screen(r.result.status, body) };
  };
  // `extra` (2026-10-02, batch 2): more of the browser's own body, as a hand-over
  // posts it — the parts put off (`alsoAsked`). Absent, the body is as before.
  const send = async (instruction = ASK, idem = "idem-lost-" + hex(8), extra = {}) => {
    const res = await worker.fetch(post(slug, { instruction, picker: "sonnet", idem, tz: "Europe/London", ...extra }), env, makeCtx());
    const status = res.status;
    const body = await res.json().catch(() => null);
    if (mode !== "job" || status !== 202) return { status, body, said: screen(status, body) };
    await runJob(worker, env, body.job);
    // A CONSUMER THAT COULD NOT SETTLE stored nothing: the job is the sweep's.
    if (!(w.seen.rows.get(body.job) || {}).result) return { job: body.job, status: null, body: null, said: null };
    return { job: body.job, ...stored(body.job) };
  };
  const row = (id) => ({ ...w.seen.rows.get(id) });
  return { slug, store, w, seen: w.seen, worker, mod, env, send, row, stored, restore: () => w.restore() };
}

/** The statements sent after the `row` step's own, by text. */
const afterWrite = (db) => {
  const log = db.log().map((e) => e.query);
  const at = log.findIndex((q) => q.startsWith("WITH r0"));
  assert.ok(at >= 0, "the row step never wrote — this case tests nothing");
  return log.slice(at + 1);
};
const TERMINAL_STATES = ["done", "failed", "cancelled", "lost"];
const KEY_READ = /^SELECT v FROM _meta WHERE k = \$1$/;
const UNSAID = /nothing was added|try again|didn't accept|wasn't saved/i;

// ── WHAT WAS PUT OFF, SAID AGAIN WHEN THE REVIEW SETTLES (2026-10-02, the
//    whole-router audit's batch 2, W7) ──────────────────────────────────────
//
// The review stores its own reply over the step's, so the settled reply is the
// one a returning customer reads. It named a part put off only when it was a
// string — since a hand-over may put off several, a list was dropped — and its
// refund named none. The parts here are the browser's own `alsoAsked`, taken
// out of the message by the route before anything ran.
const LATER_TWO = ["make the header navy", "add a map of the shop"];
