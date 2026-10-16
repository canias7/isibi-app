// A LOST BUILD THAT SAVED A DRAFT IS NOT A PUBLISHED SITE (2026-10-16, Codex's
// review of `fd951ba3`).
//
// Codex drove stageBuild → claimBuildFence → activateBuild(asDraft:
// saveAsDraft) → reconcileLostBuilds and found two cases:
//   - stopped before the completion marker, the saved draft stayed
//     `unknown` / `publish-in-flight` on every recovery pass;
//   - stopped after it, recovery said `published` and told the customer the
//     site went live, though the pointer was absent and the version existed
//     only as a draft.
// The Build path wrote `markPublished` after any successful activation, a
// draft save included, and recovery could not tell the two apart.
//
//   BDR1  stopped before the marker: settled `saved` from this job's own
//         revision of the version it staged — kept (nothing reversed), the
//         stored answer a draft (published false, its revision), the pointer
//         absent; repeated passes change nothing.
//   BDR2  stopped after the NEW marker (`markSaved`): `saved`, never
//         published; the marker carries no `published`.
//   BDR3  a marker the EARLIER code wrote after a draft save (`published`
//         without `live`): read against the draft — `saved`; with the draft
//         unreadable, unknown; a real earlier publication (no revision of
//         this job, the pointer on it) stays published.
//   BDR4  an unrelated draft proves nothing: another job's revision, or this
//         job's id on a version it never staged.
//   BDR5  missing or unreadable evidence stays recoverable: the draft record
//         unreadable, a held journal missing — unknown, pending, nothing
//         refunded — then settled once the evidence reads.
//   BDR6  a genuine failure before saving (a newer draft refuses the save as
//         older): not published, refunded once across repeated passes.
//   BDR7  a newer draft after this job's save: still this job's `saved`.
//   BDR8  `markPublished` writes `live: true`; `markSaved` never overwrites a
//         publication, and neither overwrites the other.
//   BDR9  the readers: settlement facts, the answer's known settlement, the
//         reply's note and the request's rewrite part say a saved draft.
import test from "node:test";
import assert from "node:assert/strict";
import { buildBucket, BUILD_USER } from "./fixtures/build-route.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { resultKey, readResult, settlementFacts, knownSettlement, packResult, jobMetaKey, packJobMeta } from "../builder/build-job.mjs";
import { lostBuildVerdict, lostBuildMessage, savedOfJob } from "../builder/build-lease.mjs";
import { stageBuild, activateBuild } from "../site-builds.mjs";
import { saveAsDraft, DRAFT_KEY, HELD_KEY, newHold } from "../site-draft.mjs";

const SLUG = "harbour-loaf";
const V2 = "01791429280760-09n7s1";
const V3 = "01791429290000-zz3new";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
let seq = 0;
const newId = () => (++seq).toString(16).padStart(3, "0") + "d7a1c3e5f60718293a4b5c6d7e8f9";

function depsOf(b) {
  return {
    get: (k) => b.get(k),
    put: (k, v, ct, onlyIf) => b.put(k, v, onlyIf ? { onlyIf } : undefined),
    remove: (k) => b.delete(k),
    list: async (prefix) => (await b.list({ prefix })).objects,
  };
}
const STATE = { pages: "[]", parts: "[]", config: "{}", sidecar: "{}", kit: "[]" };
async function stage(b, id, version = V2) {
  const st = await stageBuild(depsOf(b), { slug: SLUG, version, files: { "index.html": { t: "x" } }, state: STATE, manifest: { job: id, at: Date.parse("2026-10-08T11:05:00Z") } });
  assert.ok(st && st.ok !== false);
}
/** The Build path up to the save: staged, the fence claimed as publish, activated as a draft. */
async function saveDraft(b, id, { version = V2, held = null } = {}) {
  const { claimBuildFence } = await loadWorkerModule();
  // THE JOB'S PROTOCOL RECORD, as the real consumer keeps it: filed fenced.
  b.store.set(jobMetaKey(id), JSON.stringify(packJobMeta({ fenced: true })));
  await stage(b, id, version);
  assert.equal((await claimBuildFence({ SITES_BUCKET: b }, id, "publish")).owner, "publish");
  const act = await activateBuild(depsOf(b), { slug: SLUG, version, job: id, expectEtag: null, asDraft: saveAsDraft, held, putWorker: async () => ({ ok: true }) });
  return act;
}
function ledger() {
  const back = new Map();
  const calls = [];
  return {
    calls,
    answer: (a) => {
      calls.push(a.p_ref);
      const key = a.p_ref + "|" + a.p_reason;
      if (back.has(key)) return { ok: true, refunded: 0, debited: 2, already: back.get(key), repeat: true };
      back.set(key, 2);
      return { ok: true, refunded: 2, already: 0, debited: 2, repeat: false };
    },
  };
}
async function tick(b, id, led, { now = Date.parse("2026-10-08T12:00:00Z") } = {}) {
  const { reconcileLostBuilds } = await loadWorkerModule();
  const row = { id, uid: BUILD_USER.id, slug: SLUG, op: "build", state: "lost", created_at: "2026-10-08T11:00:00Z", updated_at: "2026-10-08T11:10:00Z" };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (/\/rest\/v1\/rpc\/credit_reverse/.test(u)) return json(led.answer(JSON.parse(String((init && init.body) || "{}"))));
    if (u.includes("/rest/v1/edit_jobs")) return json([row]);
    return json([]);
  };
  try { return await reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", SITES_BUCKET: b }, { now }); }
  finally { globalThis.fetch = real; }
}
function answerOf(b, id) {
  const raw = b.store.get(resultKey(id));
  if (!raw) return null;
  const r = readResult(JSON.parse(raw));
  return { status: r.status, body: JSON.parse(r.body) };
}
const pending = (b, id) => b.store.has("recovery/pending/" + id);
const markOf = (b, id) => { const t = b.store.get("jobs/" + id + ".lost.json"); return t ? JSON.parse(t) : null; };
const fenceOf = (b, id) => JSON.parse(b.store.get("jobs/" + id + ".fence.json"));
const draftOf = (b) => JSON.parse(b.store.get(DRAFT_KEY(SLUG)));
/** A saved draft, settled as one: kept, a draft answer, nothing live. */
function settledSaved(b, id, led, { revision }) {
  const a = answerOf(b, id);
  assert.ok(a, "no answer was stored for a saved build");
  assert.equal(a.body.ok, true);
  assert.equal(a.body.page, "app");
  assert.deepEqual([a.body.draft && a.body.draft.published, a.body.draft && a.body.draft.revision, a.body.draft && a.body.draft.version], [false, revision, V2], JSON.stringify(a.body.draft));
  assert.deepEqual([a.body.checks.published, a.body.checks.draft, a.body.checks.revision], [false, true, revision]);
  assert.doesNotMatch(a.body.msg, /go live|went live|did go live/i, "a saved draft was told as a live site: " + a.body.msg);
  assert.match(a.body.msg, /saved as your site's draft/);
  assert.equal(markOf(b, id).outcome, "saved");
  assert.equal(markOf(b, id).revision, revision);
  assert.deepEqual(led.calls, [], "a saved build was refunded");
  assert.equal(b.store.has("current/" + SLUG + ".json"), false, "the live pointer exists — something published");
  assert.equal(pending(b, id), false);
}

test("BDR1 CODEX'S FIRST CASE — stopped after the draft save and BEFORE the completion marker: settled `saved` from this job's own revision; kept, a draft answer, nothing live; repeated passes change nothing", async () => {
  const id = newId();
  const b = buildBucket();
  const act = await saveDraft(b, id);
  assert.equal(act.ok, true);
  assert.equal(act.draft, true);
  // THE STOP: no marker written.
  assert.equal(fenceOf(b, id).saved, undefined);
  assert.equal(fenceOf(b, id).published, undefined);
  const led = ledger();
  const first = await tick(b, id, led);
  assert.equal(first.saved, 1, JSON.stringify(first));
  settledSaved(b, id, led, { revision: 1 });
  assert.equal(markOf(b, id).why, "draft-revision");
  const answer = b.store.get(resultKey(id));
  for (let i = 0; i < 3; i++) await tick(b, id, led);
  assert.equal(b.store.get(resultKey(id)), answer, "a repeated pass rewrote the answer");
  assert.deepEqual(led.calls, []);
});

test("BDR2 CODEX'S SECOND CASE, WITH THE NEW MARKER — stopped after `markSaved`: `saved`, never published; the marker records the save and no publication", async () => {
  const id = newId();
  const b = buildBucket();
  const { markSaved } = await loadWorkerModule();
  const act = await saveDraft(b, id);
  await markSaved({ SITES_BUCKET: b }, id, { version: V2, revision: act.revision });
  const f = fenceOf(b, id);
  assert.deepEqual([f.saved, f.revision, f.published, f.live], [V2, 1, undefined, undefined]);
  const led = ledger();
  await tick(b, id, led);
  settledSaved(b, id, led, { revision: 1 });
  assert.equal(markOf(b, id).why, "save-recorded");
});

test("BDR3 A MARKER THE EARLIER CODE WROTE AFTER A DRAFT SAVE — `published` without `live` is read against the draft: this job's revision of that version → `saved`; the draft unreadable → unknown and pending; a real earlier publication (no revision of this job) stays published", async () => {
  // CODEX'S SECOND CASE EXACTLY: the earlier code's `markPublished` after a draft save.
  {
    const id = newId();
    const b = buildBucket();
    await saveDraft(b, id);
    await b.put("jobs/" + id + ".fence.json", JSON.stringify({ by: "publish", published: V2, at: "2026-10-08T11:06:00Z" }));
    const led = ledger();
    await tick(b, id, led);
    settledSaved(b, id, led, { revision: 1 });
    assert.equal(markOf(b, id).why, "legacy-marker-draft");
  }
  // THE SAME MARKER, THE DRAFT UNREADABLE: never published, never refunded.
  {
    const id = newId();
    const b = buildBucket();
    await saveDraft(b, id);
    await b.put("jobs/" + id + ".fence.json", JSON.stringify({ by: "publish", published: V2 }));
    const good = b.store.get(DRAFT_KEY(SLUG));
    b.store.set(DRAFT_KEY(SLUG), "{not json");
    const led = ledger();
    await tick(b, id, led);
    assert.equal(answerOf(b, id), null, "an answer was stored without evidence");
    assert.equal(markOf(b, id), null);
    assert.equal(pending(b, id), true);
    assert.deepEqual(led.calls, []);
    b.store.set(DRAFT_KEY(SLUG), good);
    await tick(b, id, led);
    settledSaved(b, id, led, { revision: 1 });
  }
  // A REAL EARLIER PUBLICATION: no draft at all, the pointer on the job.
  {
    const id = newId();
    const b = buildBucket();
    const { claimBuildFence } = await loadWorkerModule();
    await stage(b, id);
    await claimBuildFence({ SITES_BUCKET: b }, id, "publish");
    assert.equal((await activateBuild(depsOf(b), { slug: SLUG, version: V2, job: id, expectEtag: null, putWorker: async () => ({ ok: true }) })).ok, true);
    await b.put("jobs/" + id + ".fence.json", JSON.stringify({ by: "publish", published: V2 }));
    const led = ledger();
    await tick(b, id, led);
    const a = answerOf(b, id);
    assert.equal(markOf(b, id).outcome, "published");
    assert.equal(a.body.draft, undefined);
    assert.match(a.body.msg, /did go live/);
    assert.deepEqual(led.calls, []);
  }
});

test("BDR4 AN UNRELATED DRAFT PROVES NOTHING — another job's revision of another version, or this job's id on a version it never staged: the claimed build stays unknown (`publish-in-flight`), nothing refunded or answered", async () => {
  for (const kind of ["other-job", "unstaged-version"]) {
    const id = newId();
    const b = buildBucket();
    const other = newId();
    // ANOTHER JOB'S SAVE, a real one.
    await saveDraft(b, other, { version: V3 });
    // THIS JOB: staged and claimed, nothing saved.
    const { claimBuildFence } = await loadWorkerModule();
    await stage(b, id);
    await claimBuildFence({ SITES_BUCKET: b }, id, "publish");
    if (kind === "unstaged-version") {
      const d = draftOf(b);
      d.revs.push({ n: 2, version: "01791429299999-nostag", at: "x", job: id });
      b.store.set(DRAFT_KEY(SLUG), JSON.stringify(d));
    }
    const led = ledger();
    for (let i = 0; i < 2; i++) await tick(b, id, led);
    assert.equal(answerOf(b, id), null, kind + ": an unrelated draft settled this build");
    assert.equal(markOf(b, id), null);
    assert.equal(pending(b, id), true);
    assert.deepEqual(led.calls, []);
  }
});

test("BDR5 MISSING OR UNREADABLE EVIDENCE STAYS RECOVERABLE — the draft unreadable, then a held journal missing: unknown and pending, nothing refunded or answered; each settles `saved` once the evidence reads", async () => {
  // THE DRAFT RECORD UNREADABLE, NO MARKER.
  {
    const id = newId();
    const b = buildBucket();
    await saveDraft(b, id);
    const good = b.store.get(DRAFT_KEY(SLUG));
    b.store.set(DRAFT_KEY(SLUG), "{broken");
    const led = ledger();
    await tick(b, id, led);
    assert.equal(answerOf(b, id), null);
    assert.equal(pending(b, id), true);
    b.store.set(DRAFT_KEY(SLUG), good);
    await tick(b, id, led);
    settledSaved(b, id, led, { revision: 1 });
  }
  // A HELD JOURNAL MISSING.
  {
    const id = newId();
    const b = buildBucket();
    // A BUILD'S HELD CHANGES ARRIVE AS A REFERENCE (`{ id, ops }`, carried by its resume).
    const held = { id: newHold(depsOf(b), SLUG).id, ops: [{ kind: "schema", spec: { tables: [] } }] };
    const act = await saveDraft(b, id, { held });
    assert.equal(act.ok, true, JSON.stringify(act));
    const rev = draftOf(b).revs.find((r) => r.job === id);
    assert.ok(rev && rev.held, "the build's held change was not saved with its revision");
    const journal = b.store.get(HELD_KEY(SLUG, rev.held));
    b.store.delete(HELD_KEY(SLUG, rev.held));
    const led = ledger();
    await tick(b, id, led);
    assert.equal(answerOf(b, id), null, "a held save was settled without its journal");
    assert.equal(pending(b, id), true);
    assert.deepEqual(led.calls, []);
    b.store.set(HELD_KEY(SLUG, rev.held), journal);
    await tick(b, id, led);
    settledSaved(b, id, led, { revision: 1 });
  }
});

test("BDR6 A GENUINE FAILURE BEFORE SAVING — a newer draft refuses the save as older, the publish records its failure: not published, refunded once however many passes", async () => {
  const id = newId();
  const b = buildBucket();
  const { markPublishFailed } = await loadWorkerModule();
  // ANOTHER JOB'S NEWER DRAFT, SAVED FIRST.
  await saveDraft(b, newId(), { version: V3 });
  const act = await saveDraft(b, id, { version: V2 });
  assert.equal(act.ok, false, "a save behind a newer draft was accepted");
  await markPublishFailed({ SITES_BUCKET: b }, id);
  const led = ledger();
  for (let i = 0; i < 3; i++) await tick(b, id, led);
  assert.equal(markOf(b, id).outcome, "not-published");
  assert.equal(answerOf(b, id).body.ok, false);
  assert.ok(led.calls.length > 0, "a build that never saved was not refunded");
  const reversed = led.calls.length;
  await tick(b, id, led);
  assert.equal(led.calls.length, reversed, "a later pass reversed again");
  assert.equal(draftOf(b).revs.some((r) => r.job === id), false);
});

test("BDR7 A NEWER DRAFT AFTER THIS JOB'S SAVE — another job saves on top; this build is still `saved` as its own revision, and the newer one stays selected", async () => {
  const id = newId();
  const b = buildBucket();
  await saveDraft(b, id, { version: V2 });
  await saveDraft(b, newId(), { version: V3 });
  assert.equal(draftOf(b).version, V3);
  const led = ledger();
  await tick(b, id, led);
  settledSaved(b, id, led, { revision: 1 });
  assert.equal(draftOf(b).version, V3, "recovery changed the selected draft");
});

test("BDR8 THE MARKERS — `markPublished` writes `live: true`; `markSaved` never overwrites a publication or a failure, and `markPublished` never overwrites a save", async () => {
  const { claimBuildFence, markPublished, markSaved, markPublishFailed } = await loadWorkerModule();
  const env = (b) => ({ SITES_BUCKET: b });
  {
    const id = newId(); const b = buildBucket();
    await claimBuildFence(env(b), id, "publish");
    await markPublished(env(b), id, V2);
    assert.deepEqual([fenceOf(b, id).published, fenceOf(b, id).live], [V2, true]);
    await markSaved(env(b), id, { version: V3, revision: 2 });
    assert.equal(fenceOf(b, id).saved, undefined);
    const c = await claimBuildFence(env(b), id, "recovery");
    assert.equal(c.live, true);
  }
  {
    const id = newId(); const b = buildBucket();
    await claimBuildFence(env(b), id, "publish");
    await markSaved(env(b), id, { version: V2, revision: 3, held: "h-1" });
    await markPublished(env(b), id, V2);
    await markPublishFailed(env(b), id);
    const f = fenceOf(b, id);
    assert.deepEqual([f.saved, f.revision, f.held, f.published, f.failed], [V2, 3, "h-1", undefined, undefined]);
    const c = await claimBuildFence(env(b), id, "recovery");
    assert.deepEqual([c.saved, c.revision, c.held, c.published], [V2, 3, "h-1", ""]);
  }
  {
    const id = newId(); const b = buildBucket();
    await claimBuildFence(env(b), id, "publish");
    await markPublishFailed(env(b), id);
    await markSaved(env(b), id, { version: V2, revision: 1 });
    assert.equal(fenceOf(b, id).saved, undefined, "a save was recorded over a recorded failure");
  }
});

test("BDR9 THE READERS — the verdict offline, the settlement facts, the answer's known settlement, the message and the reply's note all say a saved draft; the published ones are unchanged", async () => {
  const id = "a".repeat(32);
  const row = { id, slug: SLUG, created_at: "2026-10-08T11:00:00Z" };
  const builds = [{ id: V2, job: id, at: 1 }];
  const rev = { n: 4, version: V2, at: "x", job: id };
  const read = (revs) => ({ state: "read", record: { version: revs[revs.length - 1].version, rev: revs[revs.length - 1].n, revs } });
  const fence = { owner: "publish", failed: false, published: "" };
  assert.deepEqual(lostBuildVerdict({ row, pointer: null, builds, fence, fencedJob: true, draft: read([rev]) }), { outcome: "saved", why: "draft-revision", version: V2, revision: 4 });
  // NO DRAFT AT ALL: the earlier verdicts stand.
  assert.equal(lostBuildVerdict({ row, pointer: null, builds, fence, fencedJob: true, draft: { state: "none" } }).why, "publish-in-flight");
  // RECOVERY HOLDS THE FENCE: the publish never claimed, so no save can be its.
  assert.equal(lostBuildVerdict({ row, pointer: null, builds, fence: { owner: "recovery" }, fencedJob: true, draft: read([rev]) }).outcome, "not-published");
  // TRIMMED PAST THE JOB: unknown.
  const many = Array.from({ length: 60 }, (_, i) => ({ n: i + 5, version: "0179142929" + String(i).padStart(4, "0") + "-xxxxxx", at: "x", job: "z".repeat(32) }));
  assert.deepEqual(savedOfJob(read(many), id, builds), { state: "unknown", why: "draft-trimmed" });
  assert.deepEqual(lostBuildVerdict({ row, pointer: null, builds, fence: { owner: "publish", published: V2 }, fencedJob: true, draft: read(many) }), { outcome: "unknown", why: "legacy-marker-draft-trimmed" });
  // VERSIONS UNREAD: unknown, never saved.
  assert.equal(savedOfJob(read([rev]), id, null).state, "unknown");
  // A NEW PUBLICATION MARKER IS PUBLISHED WHATEVER THE DRAFT SAYS.
  assert.equal(lostBuildVerdict({ row, pointer: null, builds, fence: { owner: "publish", published: V2, live: true }, draft: read([rev]) }).outcome, "published");
  // SETTLEMENT FACTS.
  assert.deepEqual(settlementFacts({ outcome: "saved", why: "w", version: V2, revision: 4, returned: 0 }), { recovered: true, outcome: "saved", why: "w", refunded: 0, short: false, version: V2, revision: 4 });
  assert.deepEqual(settlementFacts({ outcome: "published", why: "w" }), { recovered: true, outcome: "published", why: "w", refunded: 0, short: false });
  // KNOWN SETTLEMENT FROM A STORED RECOVERY ANSWER.
  const stored = (body) => packResult({ status: 200, type: "application/json", uid: BUILD_USER.id, body: JSON.stringify(body) });
  assert.equal(knownSettlement(stored({ ok: true, lost: true, recovered: true, page: "app", draft: { published: false, version: V2, revision: 4 } })).outcome, "saved");
  assert.equal(knownSettlement(stored({ ok: true, lost: true, recovered: true, page: "app" })).outcome, "published");
  // THE MESSAGE.
  assert.match(lostBuildMessage({ outcome: "saved", slug: SLUG, revision: 4 }), /saved as your site's draft \(revision 4\).*Your live site hasn't changed; press Publish/);
  assert.doesNotMatch(lostBuildMessage({ outcome: "saved", slug: SLUG, revision: 4 }), /go live|did go live/);
  // THE REPLY'S NOTE.
  const { buildReplyFacts } = await import("../builder/site-reply.mjs");
  const said = (st) => buildReplyFacts({ settlement: st }).facts.map((f) => f.text).join(" | ");
  const savedNote = said(settlementFacts({ outcome: "saved", version: V2, revision: 4 }));
  assert.match(savedNote, /saved as the site's draft \(revision 4\); the live site is unchanged until the owner presses Publish/);
  assert.doesNotMatch(savedNote, /did go live/);
  assert.match(said(settlementFacts({ outcome: "published" })), /did go live/);
});
