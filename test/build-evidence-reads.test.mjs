// UNREADABLE EVIDENCE IS NEVER PROOF OF ABSENCE OR OF PUBLICATION (2026-10-16,
// Codex's review of `305c9425`).
//
// `listBuilds` caught each manifest's read or parse failure and left that
// version out; `savedOfJob` then found no listed manifest for this job's
// draft revision and answered "none"; and `lostBuildVerdict` read "none"
// beside a marker the earlier code wrote (`published`, no `live`) as
// publication. Codex: stageBuild → claimBuildFence → activateBuild(asDraft:
// saveAsDraft), the old-format marker, one failed read of that version's
// manifest.json — recovery recorded `published`, dropped the pending entry
// and told the customer the site went live; two healthy passes kept it.
//
// The contract now: a manifest is read for what it proves (`readManifest`:
// read, absent, unreadable), a listing says what it could not read
// (`listBuildsRead`'s `unread`), and every reader deciding from absence waits
// while anything is unread.
//
//   BER1  Codex's reproduction: one failed read of the version's manifest →
//         unknown, pending, no answer, nothing refunded; the next healthy
//         pass settles `saved`, told as a draft, nothing live.
//   BER2  the manifest malformed, then repaired; BER3 missing, then restored:
//         unknown until it reads, then `saved`.
//   BER4  a partial listing for a job from before the fence: an unreadable
//         manifest blocks "not published" (no refund) until it reads.
//   BER5  controls — a genuine earlier publication (no revision of this job),
//         a saved draft read cleanly, a new-format marker, an unrelated
//         revision — all as before, with an unrelated manifest unreadable
//         where it cannot matter.
//   BER6  the readers themselves: `readManifest`'s three states and
//         `listBuildsRead`'s `unread`; `listBuilds` (the versions panel) is
//         unchanged.
//   BER7  the Edit reconcile (the same reader): a job stopped after its draft
//         record, its version's manifest unreadable at the reconcile — left
//         unknown, never refunded `never-staged`; the next pass keeps it as a
//         saved draft, billed once.
//   BER8  the owner's source-by-job route (the same reader): an unreadable
//         manifest is 503, never "no stored version was staged by that job".
import test from "node:test";
import assert from "node:assert/strict";
import { buildBucket, BUILD_USER } from "./fixtures/build-route.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { resultKey, readResult, jobMetaKey, packJobMeta } from "../builder/build-job.mjs";
import { reconcileVerdict } from "../builder/site-reconcile.mjs";
import { stageBuild, activateBuild, listBuilds, listBuildsRead, readManifest } from "../site-builds.mjs";
import { saveAsDraft, DRAFT_KEY } from "../site-draft.mjs";
import { platform, sendMessage, pump, tick as flowTick, call, settle, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";

const SLUG = "harbour-loaf";
const V2 = "01791429280760-09n7s1";
const V3 = "01791429290000-zz3new";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
let seq = 0;
const newId = () => (++seq).toString(16).padStart(3, "0") + "e9b2c4d6f60718293a4b5c6d7e8f9";
const manifestKey = (v, slug = SLUG) => "builds/" + slug + "/" + v + "/manifest.json";

function depsOf(b) {
  return {
    get: (k) => b.get(k),
    put: (k, v, ct, onlyIf) => b.put(k, v, onlyIf ? { onlyIf } : undefined),
    remove: (k) => b.delete(k),
    list: async (prefix) => (await b.list({ prefix })).objects,
  };
}
/** A store whose reads of chosen keys fail, a set number of times each — the storage boundary. */
function faulty(b) {
  const fails = new Map();
  const get = b.get.bind(b);
  b.get = async (k) => { const n = fails.get(k) || 0; if (n > 0) { fails.set(k, n - 1); throw new Error("r2 unavailable"); } return get(k); };
  return { failGet: (k, times = 1) => fails.set(k, (fails.get(k) || 0) + times) };
}
const STATE = { pages: "[]", parts: "[]", config: "{}", sidecar: "{}", kit: "[]" };
async function stage(b, id, version = V2) {
  const st = await stageBuild(depsOf(b), { slug: SLUG, version, files: { "index.html": { t: "x" } }, state: STATE, manifest: { job: id, at: Date.parse("2026-10-08T11:05:00Z") } });
  assert.ok(st && st.ok !== false);
}
async function saveDraft(b, id, version = V2) {
  const { claimBuildFence } = await loadWorkerModule();
  b.store.set(jobMetaKey(id), JSON.stringify(packJobMeta({ fenced: true })));
  await stage(b, id, version);
  assert.equal((await claimBuildFence({ SITES_BUCKET: b }, id, "publish")).owner, "publish");
  const act = await activateBuild(depsOf(b), { slug: SLUG, version, job: id, expectEtag: null, asDraft: saveAsDraft, putWorker: async () => ({ ok: true }) });
  assert.equal(act.ok, true);
  return act;
}
const legacyMarker = (b, id, v = V2) => b.store.set("jobs/" + id + ".fence.json", JSON.stringify({ by: "publish", published: v, at: "2026-10-08T11:06:00Z" }));
function ledger() {
  const back = new Map(); const calls = [];
  return { calls, answer: (a) => { calls.push(a.p_ref); const key = a.p_ref + "|" + a.p_reason; if (back.has(key)) return { ok: true, refunded: 0, debited: 2, already: back.get(key), repeat: true }; back.set(key, 2); return { ok: true, refunded: 2, already: 0, debited: 2, repeat: false }; } };
}
async function tick(b, id, led, { created = "2026-10-08T11:00:00Z" } = {}) {
  const { reconcileLostBuilds } = await loadWorkerModule();
  const row = { id, uid: BUILD_USER.id, slug: SLUG, op: "build", state: "lost", created_at: created, updated_at: "2026-10-08T11:10:00Z" };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (/\/rest\/v1\/rpc\/credit_reverse/.test(u)) return json(led.answer(JSON.parse(String((init && init.body) || "{}"))));
    if (u.includes("/rest/v1/edit_jobs")) return json([row]);
    return json([]);
  };
  try { return await reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", SITES_BUCKET: b }, { now: Date.parse("2026-10-08T12:00:00Z") }); }
  finally { globalThis.fetch = real; }
}
const answerOf = (b, id) => { const raw = b.store.get(resultKey(id)); return raw ? JSON.parse(readResult(JSON.parse(raw)).body) : null; };
const markOf = (b, id) => { const t = b.store.get("jobs/" + id + ".lost.json"); return t ? JSON.parse(t) : null; };
const pending = (b, id) => b.store.has("recovery/pending/" + id);
function stillOpen(b, id, led, what) {
  assert.equal(answerOf(b, id), null, what + ": an answer was stored without its evidence: " + JSON.stringify(answerOf(b, id)));
  assert.equal(markOf(b, id), null, what + ": a settlement was recorded without its evidence");
  assert.equal(pending(b, id), true, what + ": the pending recovery was dropped");
  assert.deepEqual(led.calls, [], what + ": something was refunded");
}
function settledSaved(b, id, led, what) {
  const a = answerOf(b, id);
  assert.ok(a, what + ": not settled");
  assert.deepEqual([a.ok, a.page, a.draft && a.draft.published, a.draft && a.draft.revision], [true, "app", false, 1], what + ": " + JSON.stringify(a).slice(0, 300));
  assert.doesNotMatch(String(a.msg), /did go live|went live/, what + ": told as live");
  assert.equal(markOf(b, id).outcome, "saved");
  assert.deepEqual(led.calls, [], what + ": a saved build was refunded");
  assert.equal(b.store.has("current/" + SLUG + ".json"), false, what + ": something is live");
  assert.equal(pending(b, id), false);
}

test("BER1 CODEX'S REPRODUCTION — a draft save, the earlier code's `published` marker, ONE failed read of that version's manifest: unknown, pending, no answer, nothing refunded; the next healthy pass settles `saved` (a draft, nothing live), and later passes keep it", async () => {
  const id = newId();
  const b = buildBucket();
  const f = faulty(b);
  await saveDraft(b, id);
  legacyMarker(b, id);
  // ONE FAILURE: the listing's read and the exact read each meet it once.
  f.failGet(manifestKey(V2), 2);
  const led = ledger();
  const first = await tick(b, id, led);
  assert.equal(first.published, 0, "an unreadable manifest became proof of publication: " + JSON.stringify(first));
  stillOpen(b, id, led, "the failing pass");
  await tick(b, id, led);
  settledSaved(b, id, led, "the healthy pass");
  const stored = b.store.get(resultKey(id));
  await tick(b, id, led);
  assert.equal(b.store.get(resultKey(id)), stored);
});

test("BER2/BER3 MALFORMED, THEN MISSING, MANIFESTS — each leaves the build unknown and pending, never published or refunded; repaired or restored, it settles `saved`", async () => {
  for (const kind of ["malformed", "missing", "no-files"]) {
    const id = newId();
    const b = buildBucket();
    await saveDraft(b, id);
    legacyMarker(b, id);
    const good = b.store.get(manifestKey(V2));
    if (kind === "malformed") b.store.set(manifestKey(V2), "{not json");
    if (kind === "missing") b.store.delete(manifestKey(V2));
    if (kind === "no-files") b.store.set(manifestKey(V2), JSON.stringify({ ...JSON.parse(good), files: [] }));
    const led = ledger();
    await tick(b, id, led);
    stillOpen(b, id, led, kind);
    await tick(b, id, led);
    stillOpen(b, id, led, kind + " (again)");
    b.store.set(manifestKey(V2), good);
    await tick(b, id, led);
    settledSaved(b, id, led, kind + " restored");
  }
});

test("BER4 A PARTIAL LISTING FOR A JOB FROM BEFORE THE FENCE — its own version's manifest unreadable while another job's version is live: never `not-published` (no refund) while it is unread; all readable and nothing of it, it is refunded once (control)", async () => {
  const { claimBuildFence } = await loadWorkerModule();
  // THE OLDER JOB: no protocol record, its version staged; another job live.
  const id = newId();
  const b = buildBucket();
  const f = faulty(b);
  await stage(b, id, V2);
  const other = newId();
  await stage(b, other, V3);
  await claimBuildFence({ SITES_BUCKET: b }, other, "publish");
  assert.equal((await activateBuild(depsOf(b), { slug: SLUG, version: V3, job: other, expectEtag: null, putWorker: async () => ({ ok: true }) })).ok, true);
  f.failGet(manifestKey(V2), 1);
  const led = ledger();
  await tick(b, id, led, { created: "2026-10-08T10:00:00Z" });
  stillOpen(b, id, led, "a partial listing");
  // CONTROL: a job with no version at all, every manifest read — refunded.
  const none = newId();
  const led2 = ledger();
  await tick(b, none, led2, { created: "2026-10-08T12:30:00Z" });
  assert.equal(markOf(b, none) && markOf(b, none).outcome, "not-published", "the control was not decided: " + JSON.stringify(markOf(b, none)));
  assert.ok(led2.calls.length > 0);
});

test("BER5 CONTROLS — a genuine earlier publication stays published; a cleanly read saved draft and a new-format marker settle as before; an unrelated revision proves nothing; an unrelated version's unreadable manifest does not block a decision this job's own evidence makes", async () => {
  const { claimBuildFence, markSaved, markPublished } = await loadWorkerModule();
  // GENUINE EARLIER PUBLICATION: no draft, the earlier marker.
  {
    const id = newId(); const b = buildBucket();
    await stage(b, id);
    await claimBuildFence({ SITES_BUCKET: b }, id, "publish");
    assert.equal((await activateBuild(depsOf(b), { slug: SLUG, version: V2, job: id, expectEtag: null, putWorker: async () => ({ ok: true }) })).ok, true);
    legacyMarker(b, id);
    const led = ledger();
    await tick(b, id, led);
    assert.equal(markOf(b, id).outcome, "published");
    assert.deepEqual(led.calls, []);
  }
  // A SAVED DRAFT READ CLEANLY, WITH AN UNRELATED VERSION'S MANIFEST UNREADABLE.
  {
    const id = newId(); const b = buildBucket(); const f = faulty(b);
    await saveDraft(b, id);
    await stage(b, newId(), V3);
    f.failGet(manifestKey(V3), 5);
    const led = ledger();
    await tick(b, id, led);
    settledSaved(b, id, led, "a clean saved draft beside an unreadable unrelated manifest");
  }
  // NEW-FORMAT MARKERS: saved and live.
  {
    const id = newId(); const b = buildBucket();
    const act = await saveDraft(b, id);
    await markSaved({ SITES_BUCKET: b }, id, { version: V2, revision: act.revision });
    const led = ledger();
    await tick(b, id, led);
    settledSaved(b, id, led, "markSaved");
  }
  {
    const id = newId(); const b = buildBucket();
    await stage(b, id);
    await claimBuildFence({ SITES_BUCKET: b }, id, "publish");
    await activateBuild(depsOf(b), { slug: SLUG, version: V2, job: id, expectEtag: null, putWorker: async () => ({ ok: true }) });
    await markPublished({ SITES_BUCKET: b }, id, V2);
    const led = ledger();
    await tick(b, id, led);
    assert.equal(markOf(b, id).outcome, "published");
  }
  // AN UNRELATED REVISION: another job's save; this job claimed and saved nothing.
  {
    const id = newId(); const b = buildBucket();
    await saveDraft(b, newId(), V3);
    await stage(b, id);
    await claimBuildFence({ SITES_BUCKET: b }, id, "publish");
    const led = ledger();
    await tick(b, id, led);
    assert.equal(markOf(b, id), null);
    assert.equal(pending(b, id), true);
  }
});

test("BER6 THE READERS — `readManifest` says read, absent or unreadable (a failed read, bad JSON, no files); `listBuildsRead` names what it could not read and leaves out a staging that never finished; `listBuilds` (the versions panel) answers the same versions as before", async () => {
  const b = buildBucket();
  const f = faulty(b);
  const id = newId();
  await stage(b, id, V2);
  await stage(b, newId(), V3);
  const deps = depsOf(b);
  assert.equal((await readManifest(deps, SLUG, V2)).state, "read");
  assert.equal((await readManifest(deps, SLUG, "01791429299999-absent")).state, "absent");
  f.failGet(manifestKey(V2), 1);
  assert.deepEqual(await readManifest(deps, SLUG, V2), { state: "unreadable", why: "read-failed" });
  const good = b.store.get(manifestKey(V2));
  b.store.set(manifestKey(V2), "{x");
  assert.deepEqual(await readManifest(deps, SLUG, V2), { state: "unreadable", why: "malformed" });
  b.store.set(manifestKey(V2), JSON.stringify({ files: [] }));
  assert.deepEqual(await readManifest(deps, SLUG, V2), { state: "unreadable", why: "malformed" });
  b.store.set(manifestKey(V2), good);
  // A STAGING THAT NEVER FINISHED: objects, no manifest.
  b.store.set("builds/" + SLUG + "/01791429295555-unfin1/index.html", "x");
  f.failGet(manifestKey(V3), 1);
  const r = await listBuildsRead(deps, SLUG);
  assert.deepEqual(r.builds.map((x) => x.id), [V2]);
  assert.deepEqual(r.unread, [V3]);
  assert.deepEqual((await listBuilds(deps, SLUG)).map((x) => x.id).sort(), [V2, V3].sort(), "the versions panel's listing changed");
});

test("BER7a THE EDIT RECONCILE'S VERDICT — not found while a manifest is unread is unknown; not found with everything read is never-staged (control)", () => {
  assert.equal(reconcileVerdict({ job: { id: "j" }, pointer: null, live: null, builds: [], buildsUnread: ["v1"], mine: null }).kind, "builds-partly-unread");
  assert.equal(reconcileVerdict({ job: { id: "j" }, pointer: null, live: null, builds: [], buildsUnread: [], mine: null }).kind, "never-staged");
});

test("BER7 THE EDIT RECONCILE, THE SAME READER — a text edit stopped after its draft record, its version's manifest unreadable at the reconcile: left unknown, never refunded `never-staged`; the next pass keeps it as a saved draft, billed once", async () => {
  // THE LIFECYCLE (the offline verdict is BER7a).
  const compiler = installCompiler();
  const FROM = "Follow us on TikTok at @oldloaf";
  const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + FROM + "</p></section>");
  const said = (args) => String(args.messages[0].content);
  const P = platform({
    slug: "ber-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: pageSrc("/", "<h1>Harbour Loaf</h1>") }, { path: "visit.tsx", source: VISIT }], liveScripts: true, balance: 400,
    answers: {
      route: { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] },
      [T.text]: (args) => {
        const at = said(args).split("\n").find((l) => l.includes("[visit.tsx] ") && l.includes("TikTok"));
        return { edits: [{ id: Number(String(at || "-1.").split(".")[0]), to: said(args).includes(FROM) ? "Follow us on TikTok at @harbourloaf" : "Follow us on TikTok at @harbourbakes" }] };
      },
    },
  });
  try {
    const r0 = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourloaf." });
    await settle(P, r0.key, { rounds: 20 });
    P.env.DRAFT_FIRST = "on";
    P.hangPut((k) => k === DRAFT_KEY(P.slug));
    const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourbakes." });
    let hung = null;
    for (let i = 0; i < 10 && !hung; i++) { const x = await pump(P); if (x && x.hung) hung = x.hung; }
    assert.ok(hung, "the edit never reached its draft record");
    const job = P.jobsOf(r.key).find((j) => j.op === "edit");
    const d = JSON.parse(String(P.readObj(DRAFT_KEY(P.slug))).replace(/\n[ \t]+$/, ""));
    const mine = d.revs.find((x) => x.job === job.id);
    assert.ok(mine);
    // THE RECONCILE'S FIRST PASS MEETS FAILED READS OF THIS JOB'S MANIFEST —
    // the listing's and the exact one (since the ninth batch's exact reads).
    P.failGetFrom((k) => k === manifestKey(mine.version, P.slug), { skip: 0, count: 2 });
    P.recover();
    const refundOf = () => P.ledger.filter((e) => e.ref === job.id && e.reason === "refund").length;
    let unknownSeen = false;
    for (let i = 0; i < 12; i++) {
      P.advance(4 * 60 * 1000);
      await flowTick(P); await pump(P);
      const j = P.jobs.get(job.id);
      if (j.needs_review) unknownSeen = true;
      assert.equal(refundOf(), 0, "a job whose version's manifest was unreadable was refunded");
      if (j.state === "done") break;
    }
    const j = P.jobs.get(job.id);
    assert.ok(unknownSeen, "the job never waited in review — this case tests nothing");
    assert.equal(j.state, "done", "the job was not kept once its manifest read: " + j.state);
    assert.equal(JSON.parse(j.result.body).reconciled, "draft-saved");
    assert.equal(j.billing, "finalized");
    assert.equal(refundOf(), 0);
  } finally { await P.settle(); P.close(); compiler.uninstall(); }
});

test("BER8 THE OWNER'S SOURCE-BY-JOB ROUTE, THE SAME READER — a version whose manifest cannot be read answers 503, never \"no stored version of this site was staged by that job\"; read again, the job's version is found", async () => {
  const compiler = installCompiler();
  const P = platform({ slug: "ber8-" + Math.random().toString(16).slice(2, 8), liveScripts: true, balance: 400,
    answers: { route: { intent: "edit", layer: "look" }, [T.pick]: { fields: ["description"] }, "lane:description": "Overnight sourdough." } });
  try {
    const r0 = await sendMessage(P, { message: "Change the site description to say we bake overnight sourdough" });
    await settle(P, r0.key, { rounds: 20 });
    const job = P.jobsOf(r0.key).find((j) => j.op === "edit");
    assert.ok(job && job.state === "done", "the edit did not publish");
    const live = JSON.parse(String(P.readObj("current/" + P.slug + ".json")).replace(/\n[ \t]+$/, "")).version;
    const path = "/api/site/source?slug=" + P.slug + "&job=" + job.id;
    P.failGetFrom((k) => k === manifestKey(live, P.slug), { skip: 0, count: 1 });
    const bad = await call(P, "GET", path);
    assert.equal(bad.status, 503, JSON.stringify(bad.body));
    assert.doesNotMatch(String(bad.body.error), /no stored version/);
    const ok = await call(P, "GET", path);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.version, live);
  } finally { await P.settle(); P.close(); compiler.uninstall(); }
});

test("BER9 A REVISION NAMING THIS JOB ON A VERSION ANOTHER JOB STAGED — the exact manifest, read cleanly, names the other job: it proves nothing for this one (`publish-in-flight`, unknown); the same revision with the manifest naming this job is `saved` (control)", async () => {
  const { lostBuildVerdict } = await import("../builder/build-lease.mjs");
  const id = "a".repeat(32), other = "b".repeat(32);
  const row = { id, slug: SLUG, created_at: "2026-10-08T11:00:00Z" };
  const draft = { state: "read", record: { version: V2, rev: 1, revs: [{ n: 1, version: V2, at: "x", job: id }] } };
  const fence = { owner: "publish", failed: false, published: "" };
  const theirs = lostBuildVerdict({ row, pointer: null, builds: [], fence, fencedJob: true, draft, manifests: { [V2]: { state: "read", manifest: { job: other, files: ["x"] } } } });
  assert.deepEqual(theirs, { outcome: "unknown", why: "publish-in-flight" });
  const ours = lostBuildVerdict({ row, pointer: null, builds: [], fence, fencedJob: true, draft, manifests: { [V2]: { state: "read", manifest: { job: id, files: ["x"] } } } });
  assert.deepEqual(ours, { outcome: "saved", why: "draft-revision", version: V2, revision: 1 });
});
