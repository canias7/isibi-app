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
import { readRun, partOf } from "../builder/request.mjs";
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

test("DOR1 CODEX'S REPRODUCTION, INLINE — the draft record lands and its answer is lost: the save goes on as saved (committed once, billed once, the preview up, no claim left); the job's answer and the part say draft revision N, not published; the live site untouched; every message delivered twice", async () => {
  const { P, v0, done } = await bakery();
  try {
    P.losePut((k) => k === DRAFT_KEY(P.slug));
    const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourbakes." });
    const { rec, hung } = await drive(P, r.key, { twice: true });
    assert.equal(hung, undefined, "the run hung: " + hung);
    const jobs = editJobs(P, r.key);
    assert.equal(jobs.length, 1, "the edit ran more than once: " + jobs.length);
    const j = jobs[0];
    const b = bodyOf(j);
    assert.equal(j.state, "done", JSON.stringify(b).slice(0, 300));
    assert.equal(b.ok, true, "the job was told failure though its save landed: " + JSON.stringify(b).slice(0, 300));
    assert.equal(j.billing, "finalized", "not billed once: " + j.billing);
    assert.equal(refunded(P, j.id), 0, "a landed save was refunded");
    const d = draftOf(P);
    const mine = savedRevision(d, { job: j.id });
    assert.ok(mine, "no revision of this job in the draft record");
    assert.equal(d.revs.filter((x) => x.job === j.id).length, 1, "the job's revision was written twice");
    // THE ANSWER'S FACTS: saved as which revision, not published, and the preview.
    assert.deepEqual([b.checks.published, b.checks.draft, b.checks.revision, b.checks.version], [false, true, mine.n, mine.version], JSON.stringify(b.checks));
    assert.equal(b.checks.preview, "ready", "the preview was up, and the answer does not say so");
    assert.ok(b.draft && b.draft.revision === mine.n && b.draft.published === false, "the text edit's answer carries no draft facts: " + JSON.stringify(Object.keys(b)));
    // NOTHING LIVE; THE PREVIEW IS THE DRAFT; NO CLAIM LEFT.
    assert.equal(live(P), v0, "the live pointer moved without Publish");
    assert.equal(P.liveScript(), v0, "the live script moved without Publish");
    assert.equal(P.previewScript(), mine.version, "the preview is not the saved draft");
    assert.deepEqual(claims(P), [], "the preview's claim was left standing");
    assert.match(visitNow(P), /harbourbakes/, "the editable copy does not hold the saved change");
    // THE PART: done, and its facts say saved.
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const facts = editReplyFacts(b).facts.map((f) => f.text).join(" | ");
    assert.match(facts, new RegExp("Saved as draft revision " + mine.n + ":"), facts);
    assert.doesNotMatch(facts, /Published:/);
  } finally { await done(); }
});

test("DOR1b THE SAME, WITH THE PREVIEW NOT CONFIRMED — every preview upload refused: the save still stands (billed once, not refunded), and its answer says draft revision N with the preview `pending`, never `ready`; the claim stays for the tick", async () => {
  const { P, v0, done } = await bakery();
  try {
    P.losePut((k) => k === DRAFT_KEY(P.slug));
    for (let i = 0; i < 8; i++) P.beforeUpload(async (text) => { if (/draft-|site-version/.test(String(text))) throw new Error("upload refused"); });
    const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourbakes." });
    await drive(P, r.key);
    const j = editJobs(P, r.key)[0];
    const b = bodyOf(j);
    assert.equal(b.ok, true, "a landed save was told failure: " + j.result.body.slice(0, 300));
    assert.equal(refunded(P, j.id), 0);
    const mine = savedRevision(draftOf(P), { job: j.id });
    assert.ok(mine);
    assert.deepEqual([b.checks.draft, b.checks.revision, b.checks.preview], [true, mine.n, "pending"], JSON.stringify(b.checks));
    assert.equal(b.draft.previewUploaded, false);
    assert.ok(claims(P).length >= 1, "the claim the tick needs was removed");
    assert.equal(live(P), v0);
  } finally { await done(); }
});

test("DOR2 A HARD STOP AFTER THE RECORD LANDS — the review reconcile finds the job's own revision: kept `draft-saved`, billed once and never refunded; the part done as a saved draft with its revision; a second reconcile and a duplicate delivery change nothing; Publish of that revision makes it live", async () => {
  const { P, v0, done } = await bakery();
  try {
    P.hangPut((k) => k === DRAFT_KEY(P.slug));
    const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourbakes." });
    const first = await drive(P, r.key);
    assert.match(String(first.hung), /^put:site-drafts\//, "the run did not stop at the draft record: " + first.hung);
    const j0 = editJobs(P, r.key)[0];
    const rec = await afterStop(P, r.key);
    const j = P.jobs.get(j0.id);
    const b = bodyOf(j);
    assert.equal(j.state, "done", "the job was not settled kept: " + j.state + " " + JSON.stringify(b).slice(0, 300));
    assert.equal(b.reconciled, "draft-saved", JSON.stringify(b).slice(0, 300));
    assert.equal(j.billing, "finalized");
    assert.equal(refunded(P, j.id), 0, "a landed save was refunded");
    const mine = savedRevision(draftOf(P), { job: j.id });
    assert.ok(mine, "no revision of this job");
    assert.deepEqual([b.draft.published, b.draft.revision, b.draft.version], [false, mine.n, mine.version], JSON.stringify(b.draft));
    assert.ok(["pending", "unknown", "ready"].includes(b.draft.preview));
    assert.equal(editJobs(P, r.key).length, 1, "the work was run again");
    // THE PART: a saved draft, said as one; the request's facts carry it.
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.outcome])));
    assert.equal(rec.parts[0].outcome.kind, "draft", JSON.stringify(rec.parts[0].outcome));
    assert.equal(rec.parts[0].outcome.draft.revision, mine.n);
    assert.match(rec.parts[0].done, new RegExp("draft revision " + mine.n + " \\(not published"), rec.parts[0].done);
    // NOTHING LIVE BEFORE PUBLISH.
    assert.equal(live(P), v0);
    assert.equal(P.liveScript(), v0);
    // ONCE: another tick, a duplicate delivery, a direct reconcile.
    const ledgerN = P.ledger.length;
    await tick(P); await pump(P, { twice: true });
    const worker = await loadWorkerModule();
    const again = await P.run(() => worker.reconcileEditJob(P.env, j.id));
    assert.notEqual(again.verdict, "refunded");
    assert.equal(P.ledger.length, ledgerN, "a second reconcile or delivery moved money");
    assert.equal(bodyOf(P.jobs.get(j.id)).reconciled, "draft-saved");
    // PUBLISH THE REVISION.
    const pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: mine.n, version: mine.version });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(live(P), mine.version);
  } finally { await done(); }
});

test("DOR3 A HARD STOP AFTER THE COMMIT — the lost-job sweep's bare `recovered` is read against the draft record: the part is told saved as draft revision N (not published), never \"made the change\"; billed once", async () => {
  const { P, v0, done } = await bakery();
  try {
    const before = new Set(P.jobs.keys());
    // THE COMMIT LANDS AND ITS CALLER NEVER HEARS: no answer is written.
    P.hang("edit_committed", (a, out) => !before.has(a.p_id) && !!out && out.ok === true);
    const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourbakes." });
    const first = await drive(P, r.key);
    assert.ok(first.hung, "the run did not stop after its commit");
    const j0 = editJobs(P, r.key)[0];
    assert.ok(P.jobs.get(j0.id).published_at, "the stop was not after the commit — this case tests nothing: " + first.hung + " " + JSON.stringify(P.rpcLog.filter((x) => /edit_/.test(x.fn || x[0] || "")).slice(-8)));
    const rec = await afterStop(P, r.key);
    const j = P.jobs.get(j0.id);
    assert.equal(j.state, "done");
    assert.equal(j.billing, "finalized");
    const mine = savedRevision(draftOf(P), { job: j.id });
    assert.ok(mine);
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].outcome.kind, "draft", JSON.stringify(rec.parts[0].outcome));
    assert.match(rec.parts[0].done, /saved the change as draft revision/);
    assert.equal(live(P), v0);
  } finally { await done(); }
});

test("DOR4 FAILURE BEFORE THE WRITE — the draft record never lands: nothing of the job is in the draft, it is refunded, and its part is not done", async () => {
  const { P, v0, done } = await bakery();
  try {
    const before = draftOf(P);
    P.failPut((k) => k === DRAFT_KEY(P.slug));
    const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourbakes." });
    const { rec } = await drive(P, r.key);
    const j = editJobs(P, r.key)[0];
    assert.equal(savedRevision(draftOf(P), { job: j.id }), null, "a revision of a save that never landed");
    assert.deepEqual(draftOf(P), before);
    assert.equal(refunded(P, j.id), reserved(P, j.id), "not refunded in full");
    assert.notEqual(j.state, "done");
    assert.notEqual(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(live(P), v0);
  } finally { await done(); }
});

test("DOR5 A NEWER DRAFT ARRIVES WHILE THE ANSWER IS LOST — built on this job's revision, the save is proven and the newer draft stays selected; replaced without it, nothing is proven: refused and refunded, never kept", async () => {
  for (const keepsMine of [true, false]) {
    const { P, v0, done } = await bakery();
    try {
      let newer = null;
      P.losePut((k) => k === DRAFT_KEY(P.slug), async () => {
        const mineRec = draftOf(P);
        const last = mineRec.revs[mineRec.revs.length - 1];
        // ANOTHER TASK'S SAVE ON TOP: the same bytes under a later version.
        newer = "0" + String(Number(last.version.slice(0, 14)) + 1000).padStart(13, "0") + "-zzzzzz";
        for (const key of P.objectKeys("builds/" + P.slug + "/" + last.version + "/")) {
          await P.bucket.put(key.replace("/" + last.version + "/", "/" + newer + "/"), P.readObj(key));
        }
        const at = new Date(P.now()).toISOString();
        const revs = keepsMine ? [...mineRec.revs, { n: last.n + 1, version: newer, at, job: "another-task" }] : [{ n: 1, version: newer, at, job: "another-task" }];
        await P.bucket.put(DRAFT_KEY(P.slug), JSON.stringify({ ...mineRec, version: newer, rev: revs[revs.length - 1].n, revs, history: [] }));
      });
      const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourbakes." });
      await drive(P, r.key);
      const j = editJobs(P, r.key)[0];
      assert.ok(newer, "the newer draft was never written — this case tests nothing");
      const d = draftOf(P);
      assert.equal(d.version, newer, "the newer draft is no longer selected");
      if (keepsMine) {
        assert.equal(bodyOf(j).ok, true, "a save the newer draft was built on was not proven: " + j.result.body.slice(0, 300));
        assert.equal(refunded(P, j.id), 0);
        assert.equal(editJobs(P, r.key).length, 1, "proven work was run again");
      } else {
        assert.notEqual(bodyOf(j).ok, true, "a save no longer in the draft record was settled as saved");
        assert.equal(refunded(P, j.id), reserved(P, j.id), "not refunded in full");
      }
      assert.equal(live(P), v0);
    } finally { await done(); }
  }
});

test("DOR6 HELD BACKEND CHANGES — a data edit sealed under draft-first whose record answer is lost is proven by its own held revision: billed once, its journal there once, no row written before Publish", async () => {
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  const { P, done } = await bakery({ db, answers: {
    route: (args) => (/price|£/i.test(said(args)) ? { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"] }] } : ROUTE_TEXT),
    write_row_changes: () => ({ changes: [{ table: "loaves", id: 2, values: { price: 5.6 } }] }),
  } });
  try {
    const writes0 = db.writes().length;
    P.losePut((k) => k === DRAFT_KEY(P.slug));
    const r = await sendMessage(P, { message: "Make the Dark Rye £5.60." });
    const { rec } = await drive(P, r.key, { twice: true });
    const jobs = editJobs(P, r.key);
    assert.equal(jobs.length, 1);
    const j = jobs[0];
    const b = bodyOf(j);
    assert.equal(b.ok, true, "a landed held save was told failure: " + j.result.body.slice(0, 300));
    assert.equal(refunded(P, j.id), 0);
    const d = draftOf(P);
    const mine = d.revs.filter((x) => x.held && x.job === j.id);
    assert.equal(mine.length, 1, "the held revision is not there exactly once: " + JSON.stringify(d.revs));
    assert.ok(P.readObj(HELD_KEY(P.slug, mine[0].held)), "the held journal is missing");
    assert.equal(db.writes().length, writes0, "a row was written before Publish");
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  } finally { await done(); }
});

test("DOR6b AN ADD-ON'S PAGE AND HELD TABLE, STOPPED FOR GOOD AFTER ITS RECORD — the reconcile reads its own revision and its held journal: kept `draft-saved`, billed once, the part done as a saved draft; the table is not created before Publish, and Publish creates it once", async () => {
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  const PAGE = { path: "/sign-up", name: "Sign up", purpose: "what Sign up is for", sections: ["a band"], components: ["section-header"] };
  const { P, v0, done } = await bakery({ db, answers: {
    route: (args) => (/sign-up/i.test(said(args)) ? { intent: "addon" } : ROUTE_TEXT),
    [T.adds]: { kinds: ["table", "page"] },
    "add:table": { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }, { name: "email", type: "text" }] }, seed: [] }] },
    "add:page": { page: [PAGE] },
    [T.pages]: { pages: [writtenPage("/sign-up")] },
  } });
  const creates = () => db.writes().filter((w) => /create table[^;]*signups/i.test(w.query)).length;
  try {
    P.hangPut((k) => k === DRAFT_KEY(P.slug));
    const r = await sendMessage(P, { message: "Add a sign-up page where people leave their name and email address." });
    const first = await drive(P, r.key);
    assert.match(String(first.hung), /^put:site-drafts\//, "the add-on did not stop at its record: " + first.hung);
    const a0 = P.jobsOf(r.key).filter((j) => j.op === "addon")[0];
    const rec = await afterStop(P, r.key, { rounds: 20 });
    const a = P.jobs.get(a0.id);
    const b = bodyOf(a);
    assert.equal(b.reconciled, "draft-saved", JSON.stringify(b).slice(0, 300));
    assert.equal(refunded(P, a.id), 0, "a landed held save was refunded");
    assert.equal(P.jobsOf(r.key).filter((j) => j.op === "addon").length, 1, "the add-on was run again");
    const mine = savedRevision(draftOf(P), { job: a.id });
    assert.ok(mine && mine.held, "the add-on's revision carries no held change");
    assert.equal(JSON.parse(bare(P.readObj(HELD_KEY(P.slug, mine.held)))).ops.filter((o) => o.kind === "schema").length, 1);
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].outcome.kind, "draft");
    assert.equal(b.migration && b.migration.status, "applied", "the migration record of a saved held schema: " + JSON.stringify(b.migration));
    assert.equal(creates(), 0, "the held table was created before Publish");
    assert.equal(live(P), v0);
    const pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: mine.n, version: mine.version });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(live(P), mine.version);
    assert.ok(creates() >= 1, "Publish did not create the held table");
  } finally { await done(); }
});

test("DOR6c AN ADD-ON'S HELD SAVE WHOSE PROOF COULD NOT BE READ AT ONCE — its record landed, its answer was lost and the draft could not be read back, so it answered failure (`discarded`); the review reconcile then reads its own revision and journal: kept `draft-saved`, billed once, the migration record corrected to the saved state, nothing live", async () => {
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  const PAGE = { path: "/sign-up", name: "Sign up", purpose: "what Sign up is for", sections: ["a band"], components: ["section-header"] };
  const { P, v0, done } = await bakery({ db, answers: {
    route: (args) => (/sign-up/i.test(said(args)) ? { intent: "addon" } : ROUTE_TEXT),
    [T.adds]: { kinds: ["table", "page"] },
    "add:table": { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }, { name: "email", type: "text" }] }, seed: [] }] },
    "add:page": { page: [PAGE] },
    [T.pages]: { pages: [writtenPage("/sign-up")] },
  } });
  try {
    // LANDED, ANSWER LOST, AND THE NEXT READS OF THE DRAFT FAIL.
    P.losePut((k) => k === DRAFT_KEY(P.slug), () => { P.failGetFrom((k) => k === DRAFT_KEY(P.slug), { skip: 0, count: 3 }); });
    const r = await sendMessage(P, { message: "Add a sign-up page where people leave their name and email address." });
    await drive(P, r.key);
    await afterStop(P, r.key, { rounds: 6 });
    const a = P.jobsOf(r.key).filter((j) => j.op === "addon")[0];
    const b = bodyOf(P.jobs.get(a.id));
    assert.equal(b.reconciled, "draft-saved", JSON.stringify(b).slice(0, 400));
    assert.equal(refunded(P, a.id), 0, "a landed held save was refunded");
    assert.equal(b.migration && b.migration.status, "applied", "the saved held schema's record was not corrected: " + JSON.stringify(b.migration));
    assert.equal(live(P), v0);
  } finally { await done(); }
});

test("DOR7 A DEPENDENT PART WAITS FOR ITS PREREQUISITE TO BE PROVEN SAVED — the first part stops for good after its record lands; the second is not filed while the first is unsettled and runs once the first is reconciled as a saved draft; a step that needs the first is told it saved draft revision N, not published; each billed once, nothing live", async () => {
  const ADD = "add a gallery page";
  const PAGE = { path: "/gallery", name: "Gallery", purpose: "what Gallery is for", sections: ["a band"], components: ["section-header"] };
  let routed = 0;
  const { P, v0, done } = await bakery({ answers: {
    route: (args) => (/gallery/i.test(said(args)) && routed++ === 0 ? { ...ROUTE_TEXT, alsoAsked: [ADD] } : /gallery/i.test(said(args)) ? { intent: "addon" } : ROUTE_TEXT),
    [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE] }, [T.pages]: { pages: [writtenPage("/gallery")] },
  } });
  try {
    P.hangPut((k) => k === DRAFT_KEY(P.slug));
    const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourbakes, and " + ADD + "." });
    const first = await drive(P, r.key);
    assert.match(String(first.hung), /^put:site-drafts\//, "the first part did not stop at its record: " + first.hung);
    const e0 = editJobs(P, r.key)[0];
    assert.ok(e0, "no edit job");
    // BEFORE THE FIRST IS SETTLED: the cron runs, inside the lease — no second job.
    P.recover();
    await tick(P); await pump(P);
    assert.equal(P.jobsOf(r.key).filter((j) => j.op === "addon").length, 0, "the dependent part ran before its prerequisite was proven saved");
    const rec = await afterStop(P, r.key, { rounds: 20 });
    const e = P.jobs.get(e0.id);
    assert.equal(bodyOf(e).reconciled, "draft-saved", e.result && e.result.body.slice(0, 300));
    assert.equal(refunded(P, e.id), 0);
    const addons = P.jobsOf(r.key).filter((j) => j.op === "addon");
    assert.equal(addons.length, 1, "the dependent part did not run exactly once: " + addons.length);
    assert.ok(addons[0].created_at >= e.published_at, "the dependent part was filed before its prerequisite was settled");
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].outcome.kind, "draft");
    // EACH SAVED AS ITS OWN REVISION, IN ORDER; NOTHING LIVE.
    const d = draftOf(P);
    const mine = savedRevision(d, { job: e.id });
    const theirs = savedRevision(d, { job: addons[0].id });
    assert.ok(mine && theirs && theirs.n > mine.n, JSON.stringify(d.revs));
    assert.equal(live(P), v0);
    assert.equal(refunded(P, addons[0].id), 0);
    // WHAT A STEP THAT NEEDS THE FIRST IS TOLD IT DID (`partOf`, the text
    // every step's model reads under "WHAT THE PARTS BEFORE THIS ONE DID"),
    // from the request's own settled record: a saved draft, not a publish.
    const needing = { ...rec, parts: rec.parts.map((q, i) => (i === 1 ? { ...q, needs: [0] } : q)) };
    const told = partOf(needing, 1).done;
    assert.equal(told.length, 1, "the step that needs the first part is told nothing of it");
    assert.match(told[0].said, new RegExp("saved the change as draft revision " + mine.n + " \\(not published"), told[0].said);
  } finally { await done(); }
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
