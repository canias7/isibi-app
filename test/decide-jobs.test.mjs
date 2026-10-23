// THE OWNER'S CHOSEN OPTIONS FOR FIVE JOB FINDINGS (2026-10-23), driven:
//   S7-4 (#243)  a checked reader waits out a dead holder's turn, then repairs;
//   A08-6 (#108) a draining or full container sends the edit back to the queue;
//   A08-7 (#109) the image a fired job runs on is recorded on its run mark;
//   S1-7 (#260)  a paused part's checkpoint that could not be staged files
//                nothing yet, and a refusal is said as one.
// (#107/#261's realistic side-by-side case is DH10 in draft-handoff.test.mjs.)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import {
  EDIT_JOB_KIND, EDIT_JOB_PREFIX, packEditJob, readEditMessage, fireOutcome,
  FIRE_DEFER_MAX, FIRE_DEFER_HOLD_S, SITE_BUSY_DEFER_S, NO_CONTAINER_EDIT_MSG, STAGE_WAIT_MAX,
  firedImageOf, runMarkKey,
} from "../builder/edit-job.mjs";
import { turnLooksDead, TURN_STALE_MS, TURN_TTL_MS } from "../builder/publish-turn.mjs";
import { APP_ZONE } from "../site-domains.mjs";
import { recordKey } from "../builder/request.mjs";

blockNetwork();

const ROOT = new URL("..", import.meta.url);
const BUILD_SERVER = readFileSync(new URL("builder/build-server.mjs", ROOT), "utf8");
const ID = "0123456789abcdef0123456789abcdef";
const SECRET = "fedcba9876543210fedcba9876543210";
const UID = "22175f41-6fbf-49d7-b039-a65078a0141c";
const SLUG = "fretwork-1";

// ── the consumer's fork, driven through the real queue handler ──────────────

function fakeBucket(initial = {}, { failGet = null } = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(k) {
      if (failGet && failGet(k)) throw new Error("the store failed");
      const v = store.get(k); return v === undefined ? null : { key: k, body: v, size: v.length, etag: "e", async text() { return v; }, async json() { return JSON.parse(v); } };
    },
    async put(k, v) { store.set(k, typeof v === "string" ? v : Buffer.from(v).toString("utf8")); return { key: k, etag: "e", size: 1 }; },
    async delete(k) { for (const x of Array.isArray(k) ? k : [k]) store.delete(x); },
    async head(k) { return store.has(k) ? { key: k, size: 1 } : null; },
    async list() { return { objects: [], truncated: false }; },
  };
}
function fakeNamespace(answer) {
  const calls = [];
  return {
    calls,
    idFromName: (n) => ({ name: n }),
    get: (id) => ({ async fetch(req) { calls.push({ lane: id.name, url: req.url, body: await req.text() }); return answer(); } }),
  };
}
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const jobObject = (body = "{}") => JSON.stringify(packEditJob({ url: "https://" + APP_ZONE + "/api/site/edit", body, uid: UID, slug: SLUG, secret: SECRET, at: Date.now() }));

async function drive({ answer, body = { kind: EDIT_JOB_KIND, id: ID }, queue = true, handoff = null, objects = {}, failGet = null, env = {} }) {
  const worker = await loadWorker();
  const bucket = fakeBucket({ [EDIT_JOB_PREFIX + ID]: jobObject(), ...objects }, { failGet });
  const ns = fakeNamespace(answer);
  const rpcs = [];
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    let b = {};
    try { b = JSON.parse(String((init && init.body) || "{}")); } catch { b = {}; }
    rpcs.push({ u, body: b });
    if (/rpc\/edit_claim$/.test(u)) return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: UID, slug: SLUG, needs_review: false, deferrals: 0 });
    if (/rpc\/edit_handoff$/.test(u)) return json(handoff ? handoff(b) : { ok: true, state: "claimed", owner: b.p_next || b.p_owner, uid: UID, slug: SLUG });
    return json({ claimed: false, error: "test" });
  };
  try {
    await worker.queue({ messages: [{ body, ack() {} }] },
      { SITES_BUCKET: bucket, SITE_BUILD_CONTAINER: ns, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint", SITE_SECRETS_KEY: "platform-secret", JOB_RUNNER_CANARY: SLUG,
        ...(queue ? { BUILD_QUEUE: { async send(msg, opts) { sent.push({ msg, opts }); } } } : {}), ...env }, makeCtx());
  } finally { globalThis.fetch = realFetch; }
  const named = (n) => rpcs.filter((r) => new RegExp("rpc/" + n + "$").test(r.u));
  return { bucket, ns, rpcs, sent, named };
}
const STOPPING = () => json({ ok: false, error: "stopping" }, 503);
const FULL = () => json({ ok: false, error: "too many jobs on this container" }, 429);

test("A08-6 A DRAINING CONTAINER (503 stopping) AND A FULL ONE (429) SEND THE EDIT BACK TO THE QUEUE A MINUTE OUT — asked once, nothing finalized, the lease kept under its name past the delay, the message carrying that name and the count", async () => {
  for (const [label, answer] of [["503 stopping", STOPPING], ["429", FULL]]) {
    const { ns, sent, named } = await drive({ answer });
    assert.equal(ns.calls.length, 1, label + ": the container was asked " + ns.calls.length + " times");
    assert.equal(named("edit_finalize").length, 0, label + ": the job was failed at once");
    assert.equal(sent.length, 1, label + ": the job was not sent back to the queue");
    const claimOwner = named("edit_claim")[0].body.p_owner;
    assert.deepEqual(sent[0].msg, { kind: EDIT_JOB_KIND, id: ID, holder: claimOwner, fireWaits: 1 }, label + ": the message does not carry the lease's name and the count");
    assert.ok(sent[0].opts.delaySeconds >= 30 && sent[0].opts.delaySeconds <= 120, label + ": not about a minute out: " + sent[0].opts.delaySeconds);
    const rel = named("edit_handoff");
    assert.equal(rel.length, 1, label + ": the lease was not kept for the wait");
    assert.equal(rel[0].body.p_owner, claimOwner);
    assert.equal(rel[0].body.p_next, null, label + ": the lease was moved rather than kept");
    assert.equal(rel[0].body.p_ttl, FIRE_DEFER_HOLD_S);
    assert.ok(FIRE_DEFER_HOLD_S > sent[0].opts.delaySeconds, "the kept lease lapses before the message comes back");
  }
});

test("A08-6 THE DEFERRED DELIVERY TAKES ITS LEASE OVER BY NAME — no fresh claim, the fire names the same holder; past FIRE_DEFER_MAX it fails no-container as before", async () => {
  const holder = "c_abcd1234";
  const ok = await drive({ answer: () => json({ ok: true, id: ID, pid: 7 }), body: { kind: EDIT_JOB_KIND, id: ID, holder, fireWaits: 3 } });
  assert.equal(ok.named("edit_claim").length, 0, "a deferred delivery claimed afresh");
  const take = ok.named("edit_handoff")[0];
  assert.ok(take && take.body.p_owner === holder && take.body.p_next === holder, "the lease was not taken over by its name");
  assert.equal(JSON.parse(ok.ns.calls[0].body).holder, holder, "the fire does not name the kept lease");
  // A LEASE THAT MOVED IS A FRESH CLAIM.
  const moved = await drive({ answer: () => json({ ok: true, id: ID, pid: 7 }), body: { kind: EDIT_JOB_KIND, id: ID, holder, fireWaits: 3 }, handoff: () => ({ ok: false, error: "not-holder" }) });
  assert.equal(moved.named("edit_claim").length, 1, "a moved lease was not claimed afresh");
  // THE BOUND.
  const spent = await drive({ answer: STOPPING, body: { kind: EDIT_JOB_KIND, id: ID, holder, fireWaits: FIRE_DEFER_MAX } });
  assert.equal(spent.sent.length, 0, "the job was deferred past its bound");
  const fin = spent.named("edit_finalize");
  assert.equal(fin.length, 1, "past the bound the job was not failed");
  const reply = JSON.parse(String(fin[0].body.p_result.body));
  assert.equal(reply.error, "no-container");
  assert.equal(reply.msg, NO_CONTAINER_EDIT_MSG);
  // THE BOUND COVERS THE 13-MINUTE DRAIN.
  assert.ok(FIRE_DEFER_MAX * SITE_BUSY_DEFER_S >= 13 * 60, "the deferrals do not cover the drain: " + FIRE_DEFER_MAX + " × " + SITE_BUSY_DEFER_S);
  // A QUEUE THAT CANNOT TAKE IT AGAIN FAILS AS BEFORE.
  const noQueue = await drive({ answer: STOPPING, queue: false });
  assert.equal(noQueue.named("edit_finalize").length, 1, "a deferral that could not be sent left the job hanging");
});

test("A08-6 fireOutcome and readEditMessage: only `stopping` and 429 defer; the message's own fields are read strictly", () => {
  assert.equal(fireOutcome({ fired: false, why: 'answered 503: {"ok":false,"error":"stopping"}' }), "defer");
  assert.equal(fireOutcome({ fired: false, why: "answered 429: {}" }), "defer");
  assert.equal(fireOutcome({ fired: false, why: "answered 503: busy" }), "retry");
  assert.equal(fireOutcome({ fired: false, why: "answered 500: stopping" }), "retry");
  assert.deepEqual(readEditMessage({ kind: EDIT_JOB_KIND, id: ID, holder: "c_abcd1234", fireWaits: 2, stageWaits: 1 }), { kind: EDIT_JOB_KIND, id: ID, holder: "c_abcd1234", fireWaits: 2, stageWaits: 1 });
  assert.deepEqual(readEditMessage({ kind: EDIT_JOB_KIND, id: ID, holder: "no spaces allowed", fireWaits: "2", stageWaits: 0 }), { kind: EDIT_JOB_KIND, id: ID });
});

test("A08-7 THE IMAGE A FIRED JOB RUNS ON IS RECORDED ON ITS RUN MARK — the container names it in its answer; an answer naming none is `unknown`, never a value", async () => {
  assert.match(BUILD_SERVER, /send\(res, 200, \{ ok: true, id: launch\.id, pid: started\.pid, image: IMAGE_ID \|\| "unstamped" \}\)/, "the build service does not name its image when it takes a job");
  const named = await drive({ answer: () => json({ ok: true, id: ID, pid: 7, image: "0123456789abcdef" }) });
  const mark = named.bucket.store.get(runMarkKey("edit", ID));
  assert.ok(mark, "no run mark was written");
  assert.equal(JSON.parse(mark).image, "0123456789abcdef");
  assert.equal(JSON.parse(mark).id, ID);
  const none = await drive({ answer: () => json({ ok: true, id: ID, pid: 7 }) });
  assert.equal(JSON.parse(none.bucket.store.get(runMarkKey("edit", ID))).image, "unknown");
  assert.equal(firedImageOf({ image: "unstamped" }), "unstamped");
  assert.equal(firedImageOf({ image: ["0123456789abcdef"] }), "unknown");
  assert.equal(firedImageOf(null), "unknown");
  assert.equal(runMarkKey("edit", ID), "jobs/edit/" + ID + ".ran.json");
  assert.equal(runMarkKey("build", ID), "jobs/" + ID + ".ran.json");
});

// ── S1-7: a checkpoint the Worker could not stage ───────────────────────────

const KEY = "rqdecidejobs0000000001";
const PAUSED = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const REQ = (heldCount) => ({
  v: 0, key: KEY, uid: UID, slug: SLUG, message: "add a questions section", parts: [{ n: 0, words: "add a questions section", needs: [], jobs: [{ kind: "run", id: PAUSED, end: { act: "clarify", held: heldCount } }] }], files: [], context: [],
});
async function requestObjects() {
  const { newRequest } = await import("../builder/request.mjs");
  const rec = newRequest({ key: KEY, uid: UID, slug: SLUG, message: "add a questions section" });
  const want = { ...rec, parts: REQ(1).parts };
  return { [recordKey(SLUG, KEY)]: JSON.stringify(want) };
}
const requestBody = JSON.stringify({ request: { key: KEY, part: 0, original: "add a questions section" } });
const CHECKPOINT = JSON.stringify({ v: 1, complete: true, count: 1, requirements: [{ need: "Each answer opens and closes", status: "unsupported", id: "r1" }], asked: "" });

test("S1-7 A PAUSED PART'S CHECKPOINT THAT COULD NOT BE STAGED FILES NOTHING YET — the store fails the read: nothing is fired, the job goes back on the queue a minute out with its lease kept; readable, it is staged and fired; past STAGE_WAIT_MAX it runs and answers for itself", async () => {
  const objects = { ...(await requestObjects()), [EDIT_JOB_PREFIX + ID]: jobObject(requestBody) };
  const heldKey = "jobs/prepared/" + PAUSED + ".held.json";
  const fired = () => json({ ok: true, id: ID, pid: 7 });
  const down = await drive({ answer: fired, objects: { ...objects, [heldKey]: CHECKPOINT }, failGet: (k) => k === heldKey });
  assert.equal(down.ns.calls.length, 0, "the job was fired with its checkpoint not staged");
  assert.equal(down.sent.length, 1, "the job was not sent back to the queue");
  assert.equal(down.sent[0].msg.stageWaits, 1);
  assert.ok(down.sent[0].msg.holder, "the deferral does not keep its lease's name");
  assert.equal(down.named("edit_finalize").length, 0);
  // READABLE: staged for the job, and fired.
  const up = await drive({ answer: fired, objects: { ...objects, [heldKey]: CHECKPOINT } });
  assert.equal(up.ns.calls.length, 1, "a staged checkpoint's job was not fired");
  assert.ok(up.bucket.store.get("jobs/prepared/" + ID + ".held-in.json"), "the checkpoint was not staged");
  // THE BOUND: past it, the job runs and its own read answers.
  const spent = await drive({ answer: fired, body: { kind: EDIT_JOB_KIND, id: ID, holder: "c_abcd1234", stageWaits: STAGE_WAIT_MAX }, objects: { ...objects, [heldKey]: CHECKPOINT }, failGet: (k) => k === heldKey });
  assert.equal(spent.ns.calls.length, 1, "past the bound the job was held back still");
  // A CHECKPOINT KNOWN MISSING IS NOT WAITED FOR: no retry can bring it back.
  const missing = await drive({ answer: fired, objects });
  assert.equal(missing.sent.length, 0, "a missing checkpoint was waited for");
});

// ── S7-4: a dead holder's turn ──────────────────────────────────────────────

const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>Follow us on TikTok at @oldloaf</p></section>");
const ROUTE_VISIT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

test("S7-4 A CHECKED READER WAITS OUT A DEAD HOLDER'S TURN, THEN REPAIRS UNDER IT — the editable copy is behind (no head marker) and the turn is held by a job that stopped renewing: without the wait it is read as current (`turn-held`); with it, the reader waits for the turn to lapse and repairs; a live holder, or the caller's own turn, is never waited for", { timeout: 30000 }, async () => {
  const { siteTurn } = await loadWorkerModule();
  const compiler = installCompiler();
  const slug = "dj-s74-" + Math.random().toString(16).slice(2, 8);
  const P = platform({
    slug, pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], beside: true,
    answers: { route: [ROUTE_VISIT], [T.text]: async (args) => ({ edits: [{ id: lineId(args, "visit.tsx", "Follow us on TikTok at @oldloaf"), to: "Follow us on TikTok at @harbourloaf" }] }) },
  });
  const TURN = "publish-turn/" + slug + ".json";
  const HEAD = "source/" + slug + "/head.json";
  const dead = (untilMs) => JSON.stringify({ v: 1, owner: "job:dead:c_deadbeef", job: "dead", at: Date.now() - 2 * TURN_STALE_MS, until: Date.now() + untilMs, gen: Date.now() });
  try {
    const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourloaf." });
    await settle(P, r.key);
    assert.ok(P.readObj("current/" + slug + ".json"), "the first publish did not land");
    // THE COPY BEHIND, UNDER A DEAD HOLDER'S TURN.
    P.objects.delete(HEAD);
    P.writeObj(TURN, dead(60_000));
    const old = await siteTurn.ensureEditableState(P.env, slug);
    assert.equal(old.why, "turn-held", "the case does not reproduce the finding: " + JSON.stringify(old));
    assert.equal(P.readObj(HEAD), null);
    // WAITED OUT: the turn lapses, the reader takes it and repairs.
    P.writeObj(TURN, dead(300));
    const t0 = Date.now();
    const st = await siteTurn.ensureEditableState(P.env, slug, { waitDead: true });
    assert.ok(Date.now() - t0 >= 250, "the reader did not wait for the dead turn to lapse");
    assert.equal(st.ok, true, JSON.stringify(st));
    assert.notEqual(st.why, "turn-held", "the copy was read as current under a dead holder's turn");
    assert.ok(P.readObj(HEAD), "the repair did not write the head marker");
    const after = JSON.parse(P.readObj(TURN));
    assert.ok(after.owner.startsWith("repair:") && after.until === 0, "the reader did not repair under its own turn and give it back: " + JSON.stringify(after));
    // A LIVE HOLDER IS LEFT TO ITSELF.
    P.objects.delete(HEAD);
    P.writeObj(TURN, JSON.stringify({ v: 1, owner: "job:live:c_live0001", job: "live", at: Date.now(), until: Date.now() + TURN_TTL_MS, gen: Date.now() }));
    const t1 = Date.now();
    const live = await siteTurn.ensureEditableState(P.env, slug, { waitDead: true });
    assert.equal(live.why, "turn-held");
    assert.ok(Date.now() - t1 < 2000, "a live holder was waited for");
    // THE CALLER'S OWN TURN, HOWEVER OLD, IS NEVER WAITED FOR.
    P.writeObj(TURN, dead(60_000));
    const t2 = Date.now();
    const mine = await siteTurn.ensureEditableState(P.env, slug, { waitDead: true, mine: "job:dead:c_deadbeef" });
    assert.equal(mine.why, "turn-held");
    assert.ok(Date.now() - t2 < 2000, "the caller waited for its own turn");
    P.objects.delete(TURN);
  } finally { await P.settle(); P.close(); compiler.uninstall(); }
});

test("S7-4 turnLooksDead: a turn whose holder stopped renewing past TURN_STALE_MS and has not lapsed; anything it cannot read is not dead", () => {
  const now = 1_000_000_000;
  assert.equal(turnLooksDead({ at: now - TURN_STALE_MS, until: now + 1000 }, now), true);
  assert.equal(turnLooksDead({ at: now - TURN_STALE_MS + 1, until: now + 1000 }, now), false);
  assert.equal(turnLooksDead({ at: now - 10 * TURN_STALE_MS, until: now }, now), false, "a lapsed turn is free, not dead");
  assert.equal(turnLooksDead({ until: now + 1000 }, now), false);
  assert.equal(turnLooksDead(null, now), false);
  // THE THRESHOLD SITS BETWEEN A LIVE HOLDER'S RENEWALS (30 s, Publish 60 s) AND THE LEASE (90 s).
  assert.ok(TURN_STALE_MS > 60_000 && TURN_STALE_MS <= 90_000, "TURN_STALE_MS " + TURN_STALE_MS);
});
