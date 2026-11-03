// PARKED (2026-11-03, park-old-way): the old-way half of test/build-evidence-reads.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { buildBucket, BUILD_USER } from "../../../test/fixtures/build-route.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";
import { resultKey, readResult, jobMetaKey, packJobMeta } from "../../../builder/build-job.mjs";
import { reconcileVerdict } from "../../../builder/site-reconcile.mjs";
import { stageBuild, activateBuild, listBuilds, listBuildsRead, readManifest } from "../../../site-builds.mjs";
import { saveAsDraft, DRAFT_KEY } from "../../../site-draft.mjs";
import { platform, sendMessage, pump, tick as flowTick, call, settle, T } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { page as pageSrc } from "../../../test/fixtures/live-ask.mjs";

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
