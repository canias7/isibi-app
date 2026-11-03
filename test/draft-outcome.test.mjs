// A SAVE THAT LANDED, SETTLED BY WHAT LANDED (2026-10-16, Codex's review of
// `74cbce6b`).
//
// Codex's reproduction: on a published site with DRAFT_FIRST on, a text
// edit's draft-record write succeeded and its answer was lost. The selected
// draft held the new text and the live site was unchanged — yet the request
// and part ended failed, the job failed and refunded, and the preview's claim
// stayed. The job's own outcome is now settled from the job's own records:
// its revision in the draft record (this job's id, its version, its held
// journal), never "some draft exists".
//
//   DOR1  the answer lost, inline: the save goes on as saved — committed and
//         billed once, the preview up, no claim left; the answer and the
//         part say draft revision N, not published; nothing live; every
//         message delivered twice changes nothing.
//   DOR2  the job stops for good after its record lands (before its commit):
//         the review reconcile finds its own revision — kept `draft-saved`,
//         billed once, never refunded; the part is done as a saved draft and
//         the request's facts say so; a second reconcile and a duplicate
//         delivery change nothing; Publish of that revision makes it live.
//   DOR3  the job stops for good after its commit: the lost-job sweep's bare
//         `recovered` is read against the draft record — the part is told
//         saved as draft revision N, not "made the change".
//   DOR4  failure before the write: nothing of the job is in the draft — the
//         job is refunded and its part is not done.
//   DOR5  a newer draft arrives while the answer is lost: built on this job's
//         revision, the save is proven and the newer draft stays selected;
//         replaced without it, nothing is proven — refused and refunded,
//         never settled kept.
//   DOR6  held backend changes: a data edit sealed under draft-first whose
//         record answer is lost is proven by its own held revision — billed
//         once, the journal there once, no row written before Publish.
//   DOR6b an add-on's page and held table, stopped for good after its record:
//         kept by its own revision and journal, billed once; Publish creates
//         the table once, and nothing before it.
//   DOR7  a dependent part waits: the first part stops for good after its
//         record; the second does not run until the first is proven saved,
//         and a step that needs it is told it saved draft revision N.
//   DOR8  the verdict and the readers, offline: unreadable, trimmed and
//         journal-less evidence stays unknown; another job's revision or an
//         old version in the history proves nothing; the answer readers keep
//         saved, preview pending, failed and published apart.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, pump, tick, call, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { DRAFT_KEY, HELD_KEY, savedRevision, revisionsTrimmed } from "../site-draft.mjs";
import { reconcileVerdict, reconcileReply } from "../builder/site-reconcile.mjs";
import { readRun, partOf, planParts, newRequest, nextStep, noteJobId, requestView } from "../builder/request.mjs";
import { editReplyFacts, addonReplyFacts } from "../builder/site-reply.mjs";
import { checksOf, readChecks, checkFacts, savedDraftOf, DRAFT_SAID, DRAFT_PENDING_SAID } from "../builder/check-evidence.mjs";

blockNetwork();

const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_1 = "Follow us on TikTok at @harbourloaf";
const TT_2 = "Follow us on TikTok at @harbourbakes";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const ROUTE_TEXT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const said = (args) => String(args.messages[0].content);
// THE ROUTER'S OWN MESSAGE (router-b1): the route stubs below choose by the
// customer's words, never by the site inventory now shown above them.
const message = (args) => { const c = said(args); const at = c.indexOf("THEIR MESSAGE\n"); return at >= 0 ? c.slice(at) : c; };
const lineOf = (args, file, from) => {
  const at = said(args).split("\n").find((l) => l.includes("[" + file + "] ") && (l.includes(TT_FROM) || l.includes(TT_1) || l.includes(TT_2) || l.includes(from)));
  return Number(String(at || "-1.").split(".")[0]);
};
// THE FIRST EDIT PUBLISHES @harbourloaf; EVERY LATER ONE ASKS FOR @harbourbakes.
const textNext = (args) => ({ edits: [{ id: lineOf(args, "visit.tsx", "TikTok"), to: said(args).includes(TT_FROM) ? TT_1 : TT_2 }] });

/** A published bakery, then the switch on. */
async function bakery({ answers = {}, db = null } = {}) {
  const compiler = installCompiler();
  const P = platform({
    slug: "dor-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }],
    db, liveScripts: true, balance: 400,
    answers: { route: ROUTE_TEXT, [T.text]: textNext, ...answers },
  });
  const r0 = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourloaf." });
  await settle(P, r0.key, { rounds: 20 });
  const v0 = live(P);
  assert.ok(v0, "the first edit published nothing");
  P.env.DRAFT_FIRST = "on";
  return { P, v0, done: async () => { await P.settle(); P.close(); compiler.uninstall(); } };
}
const live = (P) => { const t = P.readObj("current/" + P.slug + ".json"); return t ? JSON.parse(bare(t)).version : null; };
const draftOf = (P) => { const t = P.readObj(DRAFT_KEY(P.slug)); return t ? JSON.parse(bare(t)) : null; };
const claims = (P) => P.objectKeys("preview-claims/" + P.slug + "/");
const editJobs = (P, key) => P.jobsOf(key).filter((j) => j.op === "edit");
const reserved = (P, id) => -P.ledger.filter((e) => e.ref.startsWith(id + "#") && e.reason === "reserve").reduce((a, e) => a + e.delta, 0);
const refunded = (P, id) => P.ledger.filter((e) => e.ref === id && e.reason === "refund").reduce((a, e) => a + e.delta, 0);
const bodyOf = (j) => JSON.parse(j.result.body);
const visitNow = (P) => String(P.page("visit.tsx") || "");
async function drive(P, key, { twice = false, rounds = 30 } = {}) {
  for (let i = 0; i < rounds; i++) {
    const r = await pump(P, { twice });
    if (r && r.hung) return { hung: r.hung, rec: P.record(key) };
    const rec = P.record(key);
    if (rec && rec.ended) return { rec };
    if (!P.queue.length) await tick(P);
  }
  return { rec: P.record(key) };
}
/** Past the lease and the sweep's grace, then the cron until the request ends. */
async function afterStop(P, key, { rounds = 12 } = {}) {
  P.recover();
  for (let i = 0; i < rounds; i++) {
    P.advance(4 * 60 * 1000);
    await tick(P);
    await pump(P);
    const rec = P.record(key);
    if (rec && rec.ended) return rec;
  }
  return P.record(key);
}

test("DOR3c THE BUILD PATH REFUSES THE SAME, before its activation (audit A07-4; read from the source, the Build's stage dep)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const stage = src.indexOf('if (!staged || staged.ok !== true) throw new Error("the build could not be staged: "');
  assert.ok(stage > 0, "the Build's stage landmark moved");
  const act = src.indexOf("const act = await activateBuild(buildDeps(env), {", stage);
  assert.ok(act > stage, "the Build's activation landmark moved");
  assert.match(src.slice(stage, act), /if \(draftFirst\(env\) && staged\.worker !== true\) throw new Error\(/, "a Build staged without its script is saved as the draft");
});

test("DOR8 THE VERDICT AND THE READERS — unreadable, trimmed and journal-less evidence stays unknown; another job's revision or an old version in the history proves nothing; saved, preview pending, failed and published stay apart", () => {
  const rev = (n, extra = {}) => ({ n, version: "0179000000000" + n + "-aaaaaa", at: "x", job: "job-a", ...extra });
  // THE JOB'S OWN STAGED VERSION (`mine`) WHEN IT STAGED CODE; NONE FOR HELD-ONLY.
  const verdictOf = (draft, journals = {}, mine = null) => reconcileVerdict({ job: { id: "job-a" }, draft, journals, pointer: null, live: null, builds: [], mine });
  // THE JOB'S OWN REVISION OF ITS OWN VERSION: kept.
  const kept = verdictOf({ state: "read", record: { version: rev(1).version, rev: 1, revs: [rev(1)] } }, {}, { version: rev(1).version });
  assert.deepEqual([kept.verdict, kept.kind], ["kept", "draft-saved"], JSON.stringify(kept));
  // UNREADABLE: unknown.
  assert.equal(verdictOf({ state: "unreadable" }).verdict, "unknown");
  // THE JOB'S REVISION OF ANOTHER VERSION: not this save.
  assert.notEqual(verdictOf({ state: "read", record: { version: rev(2).version, rev: 1, revs: [{ ...rev(2) }] } }, {}, { version: rev(1).version }).kind, "draft-saved");
  // HELD WITHOUT ITS JOURNAL READ: unknown; with it: kept.
  const held = { state: "read", record: { version: rev(1).version, rev: 1, revs: [rev(1, { held: "h1" })] } };
  assert.equal(verdictOf(held, { h1: undefined }).verdict, "unknown");
  assert.equal(verdictOf(held, { h1: false }).verdict, "unknown");
  assert.equal(verdictOf(held, { h1: true }).verdict, "kept");
  // ANOTHER JOB'S REVISION, AN OLD VERSION IN THE HISTORY: proves nothing.
  const other = verdictOf({ state: "read", record: { version: "v9", rev: 1, revs: [{ ...rev(1), job: "job-b" }], history: [{ version: rev(1).version, job: "job-a" }] } });
  assert.notEqual(other.kind, "draft-saved", JSON.stringify(other));
  // TRIMMED PAST THE JOB: unknown, never refunded.
  const many = Array.from({ length: 60 }, (_, i) => ({ ...rev(i + 5), job: "job-z" }));
  const trimmed = verdictOf({ state: "read", record: { version: many[59].version, rev: 64, revs: many } }, {}, { version: rev(1).version });
  assert.deepEqual([trimmed.verdict, trimmed.kind], ["unknown", "draft-trimmed"], JSON.stringify(trimmed));
  assert.equal(revisionsTrimmed({ revs: many }), true);
  assert.equal(revisionsTrimmed({ revs: [rev(1)] }), false);
  // savedRevision: by job, by version, by held id — and nothing for nothing.
  const rec = { revs: [rev(1), { ...rev(2), job: "job-b", held: "h2" }] };
  assert.equal(savedRevision(rec, { job: "job-a" }).n, 1);
  assert.equal(savedRevision(rec, { job: "job-a", version: rev(2).version }), null);
  assert.equal(savedRevision(rec, { held: "h2" }).n, 2);
  assert.equal(savedRevision(rec, {}), null);
  assert.equal(savedRevision(null, { job: "job-a" }), null);

  // THE REPLY OF A KEPT DRAFT, AND THE READERS OF IT.
  const out = { verdict: "kept", kind: "draft-saved", why: "w", revision: 3, version: "01790000000003-aaaaaa", selected: true, preview: "pending" };
  const reply = reconcileReply(out, { id: "job-a", cost: 2 });
  const body = JSON.parse(reply.body);
  assert.deepEqual(body.draft, { published: false, version: out.version, revision: 3, selected: true, preview: "pending" });
  const run = readRun({ status: 200, body });
  assert.deepEqual(run, { act: "recovered", draft: { revision: 3, version: out.version, preview: "pending" } });
  // A PUBLISHED RECOVERY STAYS ONE.
  assert.deepEqual(readRun({ status: 200, body: { ok: true, recovered: true, reconciled: "published" } }), { act: "recovered" });
  // A MALFORMED DRAFT IS NOT READ AS SAVED.
  assert.equal(savedDraftOf({ published: true, version: "v", revision: 1 }), null);
  assert.equal(savedDraftOf({ published: false, version: "v", revision: 0 }), null);
  assert.equal(savedDraftOf({ published: false, version: "v", revision: "1" }), null);
  assert.equal(savedDraftOf({ published: false, version: "a b", revision: 1 }), null);
  // THE REPLY FACTS.
  for (const f of [editReplyFacts, addonReplyFacts]) {
    const got = f(body);
    assert.equal(got.skip, null);
    const text = got.facts.map((x) => x.text).join(" | ");
    assert.match(text, /draft revision 3/);
    assert.match(text, /still being brought up to date/);
    assert.doesNotMatch(text, /Published:/);
    assert.equal(f({ ok: true, recovered: true, reconciled: "published" }).skip, "recovered");
  }
  // THE CHECKS: saved ready, saved pending, published, and failed apart.
  const ready = checkFacts(readChecks(checksOf({ version: "v1", draft: true, revision: 4, preview: "ready" }))).map((x) => x.text).join(" ");
  const pending = checkFacts(readChecks(checksOf({ version: "v1", draft: true, revision: 4, preview: "pending" }))).map((x) => x.text).join(" ");
  const pub = checkFacts(readChecks(checksOf({ version: "v1", published: true, revision: 4, preview: "pending" }))).map((x) => x.text).join(" ");
  assert.match(ready, /Saved as draft revision 4: the change is in the site's draft and its preview/);
  assert.match(pending, /Saved as draft revision 4:.*still being brought up to date/);
  assert.match(pub, /^.*Published:/);
  assert.doesNotMatch(pub, /revision|draft/i, "a published answer was told as a draft");
  assert.equal(readChecks({ compiled: true, browser: { ran: false }, published: true, revision: 2 }), null, "a revision on a published answer was read");
  assert.equal(readChecks({ compiled: true, browser: { ran: false }, published: false, draft: true, preview: "soon" }), null);
  // A FIRST BUILD SAVED AS A DRAFT IS NOT TOLD AS PUBLISHED (`buildChecks`).
  return loadWorkerModule().then(({ buildChecks }) => {
    const asDraft = buildChecks({ page: "app", version: "v2", render: null, draft: { version: "v2", published: false, revision: 1, previewUploaded: false, previewPending: true } });
    assert.deepEqual([asDraft.published, asDraft.draft, asDraft.revision, asDraft.preview], [false, true, 1, "pending"], JSON.stringify(asDraft));
    const ready = buildChecks({ page: "app", version: "v2", render: null, draft: { revision: 2, previewUploaded: true } });
    assert.equal(ready.preview, "ready");
    assert.equal(buildChecks({ page: "app", version: "v2", render: null }).published, true, "a live build is not told as published");
    assert.equal(buildChecks({ page: "start" }), null);
  });
});

test("DOR8b THE DRAFT SENTENCES", () => {
  // A LEGACY DRAFT ANSWER (no revision, no preview) KEEPS ITS SENTENCE.
  assert.ok(checkFacts(readChecks(checksOf({ version: "v1", draft: true }))).some((x) => x.text === DRAFT_SAID));
  assert.ok(DRAFT_PENDING_SAID.includes("Publish"));
});

// ── DOR9 A PUBLISHED ANSWER IS NEVER TOLD AS A DRAFT (2026-10-17, the M4 gap) ─
// The mutation sweep of `5491e124` left `answerDraft`'s `published === false`
// test unproven: no case handed the request a finished job whose answer
// carries a revision but is not an unpublished draft. A job's answer is
// stored data (`edit_jobs.result`), read back by `nextStep` from the
// database, so the reader alone decides what the card says. Driven through
// the real `nextStep` and read through the real `requestView`.
const DOR9_MSG = "Change the opening line on the Visit page to 'Come early, the sourdough goes fast'.";
const DOR9_KEY = "rq-" + "d".repeat(29);
const DOR9_JOB = "9".repeat(32);
const dor9Row = (body) => ({ ok: true, state: "done", billing: "charged", needs_review: false, result: { status: 200, body: JSON.stringify(body) } });
function dor9Settled(body) {
  const planned = planParts(DOR9_MSG, { intent: "edit", layer: "text" });
  assert.equal(planned.ok, true, JSON.stringify(planned));
  const rec = newRequest({ key: DOR9_KEY, uid: "u1", slug: "fold-lane", message: DOR9_MSG, picker: "sonnet", tz: "Europe/London", accepted: { intent: "edit", layer: "text" }, parts: planned.parts });
  const first = nextStep(rec, {}, Date.now());
  assert.ok(first.file && first.file.key, "the part was never filed: this case tests nothing");
  const filed = noteJobId(first.record, first.file.key, DOR9_JOB);
  const out = nextStep(filed, { [DOR9_JOB]: dor9Row(body) }, Date.now()).record;
  return { part: out.parts[0], view: JSON.parse(JSON.stringify(requestView(out))).parts[0] };
}
const DOR9_V = "01790000000000-dor9aa";

test("DOR9 A PUBLISHED ANSWER IS NEVER TOLD AS A DRAFT — a finished job whose answer carries a revision is a saved draft only when it says `published: false`; `published: true`, no publication field, a non-boolean, and a revision that is not a positive integer each end done with no draft on the part or the card; a recovered answer is held to the same", () => {
  // THE VALID CASE FIRST (the observer is alive): a saved, unpublished revision.
  const saved = dor9Settled({ ok: true, draft: { version: DOR9_V, published: false, revision: 7, previewUploaded: true, previewPending: false } });
  assert.equal(saved.part.status, "done", JSON.stringify(saved.part));
  assert.deepEqual(saved.part.outcome.draft, { revision: 7, version: DOR9_V, preview: "ready" });
  assert.deepEqual(saved.view.draft, { revision: 7, preview: "ready" }, JSON.stringify(saved.view));
  // EVERY ANSWER THAT IS NOT AN UNPUBLISHED DRAFT: done, and never a draft.
  const notDraft = {
    "published: true": { version: DOR9_V, published: true, revision: 7, previewUploaded: true },
    "no publication evidence": { version: DOR9_V, revision: 7, previewUploaded: true },
    "published: null": { version: DOR9_V, published: null, revision: 7 },
    "published: \"false\" (a string)": { version: DOR9_V, published: "false", revision: 7 },
    "published: 0": { version: DOR9_V, published: 0, revision: 7 },
    "revision 0": { version: DOR9_V, published: false, revision: 0 },
    "revision \"7\" (a string)": { version: DOR9_V, published: false, revision: "7" },
  };
  for (const [why, draft] of Object.entries(notDraft)) {
    const { part, view } = dor9Settled({ ok: true, draft });
    assert.equal(part.status, "done", why + ": " + JSON.stringify(part));
    assert.equal(part.outcome.kind, "done", why);
    assert.equal(Object.hasOwn(part.outcome, "draft"), false, why + ": the part was told it saved a draft — " + JSON.stringify(part.outcome));
    assert.equal(Object.hasOwn(view, "draft"), false, why + ": the card says saved as a draft — " + JSON.stringify(view));
  }
  // A RECOVERED ANSWER (`reconciled: "draft-saved"`) IS HELD TO THE SAME: an
  // unpublished revision is a saved draft; a published one, or one with no
  // publication field, is "made the change", never a draft.
  const rec = (draft) => dor9Settled({ ok: true, recovered: true, reconciled: "draft-saved", draft });
  const recSaved = rec({ version: DOR9_V, published: false, revision: 7, preview: "pending" });
  assert.deepEqual([recSaved.part.outcome.kind, recSaved.view.draft], ["draft", { revision: 7, preview: "pending" }], JSON.stringify(recSaved));
  for (const [why, draft] of [["published: true", { version: DOR9_V, published: true, revision: 7 }], ["no publication evidence", { version: DOR9_V, revision: 7 }]]) {
    const { part, view } = rec(draft);
    assert.equal(part.outcome.kind, "recovered", why + ": " + JSON.stringify(part.outcome));
    assert.equal(Object.hasOwn(view, "draft"), false, why + ": " + JSON.stringify(view));
    assert.doesNotMatch(String(part.done), /draft/, why);
  }
});
