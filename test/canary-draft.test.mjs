// THE DRAFT-FIRST VERIFIER, PROVED OFFLINE (2026-10-16): `scripts/canary-draft.mjs`
// judged against the real Worker (`worker.js`) over the platform's stand-ins,
// with supplied model answers. A verifier is only worth what its negative
// controls show: each check must FAIL when the property is broken and stay
// UNVERIFIED when the evidence is missing — never pass on absence.
//
//   CD1  the whole path: edits held as drafts (isolation passes, the preview
//        serves the draft), the explicit Publish named by revision (the
//        pointer and the running script move to it; pressed again it is
//        `already`), and recovery leaves nothing
//   CD2  negative: the switch off, so the edits publish — isolation FAILS
//   CD3  unavailable evidence stays unverified: an unreadable pointer, a
//        running script that sends no version, a preview with no address,
//        recovery notes that cannot be listed
//   CD4  negative: a Publish answer that claims success while the pointer and
//        the script did not move FAILS; a repeat that redoes work FAILS
//   CD5  recovery notes: a stale note FAILS, a fresh one is UNVERIFIED (an
//        upload may be in flight), none PASSES; a stopped journal FAILS
//   CD6  publishPress refuses without confirm: true and makes no call
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import {
  combine, readDraftEvidence, readPreview, draftVersion, isolationChecks, previewChecks,
  publishPress, publishChecks, recoveryChecks, switchChecks,
} from "../scripts/canary-draft.mjs";

blockNetwork();

const slugOf = (k) => "cd-" + k + "-" + Math.random().toString(16).slice(2, 8);
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const TT_LATER = "Follow us on TikTok at @harbourloafbakery";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const ROUTE_TEXT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const ROUTE_DATA = { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"] }] };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

function bakery(name) {
  const compiler = installCompiler();
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  const said = (args) => String(args.messages[0].content);
  const P = platform({
    slug: slugOf(name), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], db, liveScripts: true, balance: 400,
    answers: {
      route: (args) => (/TikTok/.test(said(args)) ? ROUTE_TEXT : ROUTE_DATA),
      [T.text]: (args) => (/@harbourloafbakery/.test(said(args)) ? { edits: [{ id: lineId(args, "visit.tsx", TT_TO), to: TT_LATER }] } : { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] }),
      write_row_changes: (args) => {
        const m = /£(\d+\.\d+)/.exec((said(args).split("WHAT THEY ASKED FOR\n")[1] || "").split("\n")[0]);
        return { changes: [{ table: "loaves", id: 2, values: { price: m ? Number(m[1]) : 0 } }] };
      },
    },
  });
  return { P, db, compiler };
}
async function runOne(P, message) {
  const r = await sendMessage(P, { message });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await settle(P, r.key, { rounds: 20 });
  const job = P.jobsOf(r.key).find((j) => j.op === "edit");
  assert.equal(job && job.state, "done", JSON.stringify(job && job.result).slice(0, 300));
}
/** The verifier's `api`: the owner's routes on the real Worker. */
const apiOf = (P) => (method, path, body) => call(P, method, path, body);
/** The verifier's `fetchPage`: any address, through the real Worker. */
const pageOf = (P) => async (url) => {
  const worker = await loadWorker();
  return P.run(async () => { const ctx = makeCtx(); const r = await worker.fetch(new Request(url), P.env, ctx); await Promise.allSettled(ctx.pending); return r; });
};
async function done(P, compiler) {
  await P.settle();
  assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  P.close(); compiler.uninstall();
}
/** A site published once (switch off), then the switch on: answers the before-reading. */
async function liveThenDraftFirst(P) {
  await runOne(P, "Change our TikTok link on the Visit page to @harbourloaf.");
  P.env.DRAFT_FIRST = "on";
  const before = await readDraftEvidence(apiOf(P), P.slug);
  assert.ok(before.ok, before.why);
  assert.ok(before.state.inspect.pointer.version, "the site is not live before the case: " + JSON.stringify(before.state.inspect.pointer));
  return before;
}

test("CD1 THE WHOLE PATH PASSES ON REAL EVIDENCE — two edits saved as drafts (pointer and running script unchanged, two revisions, a held row change, the preview serving the draft), then Publish named by revision makes it live (pointer and script on it, journal closed, nothing left unpublished), pressed again it is already published, and recovery left nothing", async () => {
  const { P, db, compiler } = bakery("cd1");
  try {
    const before = await liveThenDraftFirst(P);
    // THE OWNER LOOKS AT REVISION 1 (the row change); revision 2 (the page
    // line) is saved before the click and must stay out of that approval.
    await runOne(P, "Make the Dark Rye £5.60.");
    await runOne(P, "Change our TikTok link on the Visit page to @harbourloafbakery.");
    const after = await readDraftEvidence(apiOf(P), P.slug);
    const iso = isolationChecks(before, after, { expectRevisions: 2, expectHeld: ["row"] });
    assert.equal(combine(iso).verdict, "pass", JSON.stringify(iso));
    const pv = previewChecks(after, await readPreview(pageOf(P), after.state));
    assert.equal(combine(pv).verdict, "pass", JSON.stringify(pv));

    const revs = after.state.revisions;
    const chosen = { revision: revs[revs.length - 2].revision, version: revs[revs.length - 2].version };
    const later = [{ revision: revs[revs.length - 1].revision, version: revs[revs.length - 1].version }];
    const press = await publishPress(apiOf(P), P.slug, { ...chosen, confirm: true });
    const published = await readDraftEvidence(apiOf(P), P.slug);
    const repeat = await publishPress(apiOf(P), P.slug, { ...chosen, confirm: true });
    const pub = publishChecks({ chosen, press, after: published, repeat, later });
    assert.equal(combine(pub).verdict, "pass", JSON.stringify(pub));
    // NEGATIVE CONTROL (2026-10-16): the same reading judged as if the later
    // revision had been published too fails the `later` check, never passes.
    const swallowed = { ...published, state: { ...published.state, revisions: published.state.revisions.filter((r) => r.revision !== later[0].revision) } };
    assert.equal(publishChecks({ chosen, press, after: swallowed, repeat, later }).later.verdict, "fail", "a later revision gone from the draft was not caught");
    assert.equal(publishChecks({ chosen, press, after: published, repeat }).later.verdict, "unverified", "no later revision named must be unverified, never a pass");
    assert.equal(Number(db.rows("loaves").find((l) => l.id === 2).price), 5.6, "the held row change did not reach the database on Publish");

    const rec = recoveryChecks(await readDraftEvidence(apiOf(P), P.slug));
    assert.equal(combine(rec).verdict, "pass", JSON.stringify(rec));
  } finally { await done(P, compiler); }
});

test("CD2 NEGATIVE — with the switch off the same edits publish at once, and isolation FAILS on the pointer and the running script, never passes", async () => {
  const { P, compiler } = bakery("cd2");
  try {
    await runOne(P, "Change our TikTok link on the Visit page to @harbourloaf.");
    // THE SWITCH STAYS OFF: the draft route still answers (its `enabled` false).
    const before = await readDraftEvidence(apiOf(P), P.slug);
    assert.ok(before.ok, before.why);
    await runOne(P, "Change our TikTok link on the Visit page to @harbourloafbakery.");
    const after = await readDraftEvidence(apiOf(P), P.slug);
    const iso = isolationChecks(before, after, { expectRevisions: 1 });
    assert.equal(iso.pointer.verdict, "fail", JSON.stringify(iso.pointer));
    assert.equal(iso.liveScript.verdict, "fail", JSON.stringify(iso.liveScript));
    assert.equal(combine(iso).verdict, "fail");
  } finally { await done(P, compiler); }
});

test("CD3 UNAVAILABLE EVIDENCE STAYS UNVERIFIED — an unreadable pointer, a running script that answers no version, a draft with no preview address, recovery notes that cannot be listed: each check says why and none passes", async () => {
  const { P, compiler } = bakery("cd3");
  try {
    const before = await liveThenDraftFirst(P);
    await runOne(P, "Change our TikTok link on the Visit page to @harbourloafbakery.");
    const good = await readDraftEvidence(apiOf(P), P.slug);
    // THE POINTER: one read refused, as a store that did not answer.
    const noPointer = JSON.parse(JSON.stringify(good));
    noPointer.state.inspect.pointer = { unreadable: true };
    assert.equal(isolationChecks(before, noPointer).pointer.verdict, "unverified");
    // THE RUNNING SCRIPT: answered nothing usable.
    const noScript = JSON.parse(JSON.stringify(good));
    noScript.state.inspect.liveScript = { unanswered: true };
    assert.equal(isolationChecks(before, noScript).liveScript.verdict, "unverified");
    assert.equal(recoveryChecks(noScript).aligned.verdict, "unverified");
    // NO PREVIEW ADDRESS, AND A PREVIEW WITHOUT A VERSION HEADER.
    const noPreview = JSON.parse(JSON.stringify(good));
    noPreview.state.preview = null;
    assert.equal(previewChecks(noPreview, await readPreview(pageOf(P), noPreview.state)).preview.verdict, "unverified");
    assert.equal(previewChecks(good, { ok: true, status: 200, version: "" }).preview.verdict, "unverified");
    // THE NOTES: the list failed.
    const noNotes = JSON.parse(JSON.stringify(good));
    noNotes.state.inspect.notes = { unreadable: true };
    assert.equal(recoveryChecks(noNotes).notes.verdict, "unverified");
    // NO READING AT ALL.
    const none = { ok: false, why: "the draft route answered 503" };
    assert.deepEqual(Object.values(isolationChecks(before, none)).map((c) => c.verdict), ["unverified", "unverified", "unverified"]);
    assert.equal(combine(publishChecks({ chosen: { revision: 1, version: "v" }, press: null, after: none, repeat: null })).verdict, "unverified");
    // THROUGH THE REAL ROUTE: the state's own pointer read answers, the
    // inspection's fails — the reading says unreadable, never "no pointer".
    P.failGetFrom((k) => k === "current/" + P.slug + ".json", { skip: 1, count: 1 });
    const half = await readDraftEvidence(apiOf(P), P.slug);
    assert.ok(half.ok, half.why);
    assert.deepEqual(half.state.inspect.pointer, { unreadable: true }, "an unreadable pointer was reported as " + JSON.stringify(half.state.inspect.pointer));
    assert.equal(isolationChecks(before, half).pointer.verdict, "unverified");
    // AND THE ROUTE ITSELF: a store that refuses the pointer read makes the route
    // refuse, so the verifier records no reading — never a value.
    P.failGet((k) => k === "current/" + P.slug + ".json");
    const refused = await readDraftEvidence(apiOf(P), P.slug);
    assert.equal(refused.ok, false, "a route that could not read the pointer still answered a reading");
    assert.equal(combine(isolationChecks(before, refused)).verdict, "unverified");
  } finally { await done(P, compiler); }
});

test("CD4 NEGATIVE — a Publish that answers success while the pointer and the running script stay where they were FAILS; a repeated press that publishes again instead of answering `already` FAILS", async () => {
  const { P, compiler } = bakery("cd4");
  try {
    await liveThenDraftFirst(P);
    await runOne(P, "Change our TikTok link on the Visit page to @harbourloafbakery.");
    const after = await readDraftEvidence(apiOf(P), P.slug);
    const chosen = { revision: after.state.revisions[0].revision, version: draftVersion(after.state) };
    // A CLAIMED SUCCESS WITH NOTHING MOVED: the reading taken without publishing.
    const claimed = { called: true, status: 200, body: { ok: true, published: chosen.version } };
    const c = publishChecks({ chosen, press: claimed, after, repeat: { called: true, status: 200, body: { ok: true, already: true } } });
    assert.equal(c.pointer.verdict, "fail", JSON.stringify(c.pointer));
    assert.equal(c.liveScript.verdict, "fail", JSON.stringify(c.liveScript));
    assert.equal(c.drafted.verdict, "fail", JSON.stringify(c.drafted));
    assert.equal(combine(c).verdict, "fail");
    // THE REPEAT REDOING WORK.
    const press = await publishPress(apiOf(P), P.slug, { ...chosen, confirm: true });
    const published = await readDraftEvidence(apiOf(P), P.slug);
    const redo = publishChecks({ chosen, press, after: published, repeat: { called: true, status: 200, body: { ok: true, already: false, published: chosen.version } } });
    assert.equal(redo.repeat.verdict, "fail");
    assert.equal(combine(redo).verdict, "fail");
  } finally { await done(P, compiler); }
});

test("CD5 RECOVERY NOTES AND JOURNALS — no note passes; a note inside its window is unverified (an upload may be in flight); one past the window fails; a publication stopped with no runner fails; one running is unverified", async () => {
  const { P, compiler } = bakery("cd5");
  try {
    await liveThenDraftFirst(P);
    const clean = await readDraftEvidence(apiOf(P), P.slug);
    assert.equal(recoveryChecks(clean).notes.verdict, "pass", JSON.stringify(clean.state.inspect.notes));
    // A NOTE WRITTEN NOW, read through the real route.
    await P.run(async () => P.env.SITES_BUCKET.put("scriptpending/" + P.slug + "/0f0f0f0f-0000-4000-8000-000000000001.json", JSON.stringify({ slug: P.slug, version: "v", by: "align" })));
    const fresh = await readDraftEvidence(apiOf(P), P.slug);
    assert.equal(fresh.state.inspect.notes.count, 1, JSON.stringify(fresh.state.inspect.notes));
    assert.equal(recoveryChecks(fresh).notes.verdict, "unverified", JSON.stringify(recoveryChecks(fresh).notes));
    // THE SAME NOTE PAST ITS WINDOW.
    const stale = JSON.parse(JSON.stringify(fresh));
    stale.state.inspect.notes.oldestMs = stale.state.inspect.notes.windowMs + 60_000;
    assert.equal(recoveryChecks(stale).notes.verdict, "fail");
    // JOURNALS.
    const stopped = JSON.parse(JSON.stringify(clean));
    stopped.state.inspect.journal = { revision: 2, phase: "switching", closed: false, running: false, error: null };
    assert.equal(recoveryChecks(stopped).journal.verdict, "fail");
    const running = JSON.parse(JSON.stringify(clean));
    running.state.inspect.journal = { revision: 2, phase: "prepared", closed: false, running: true, error: null };
    assert.equal(recoveryChecks(running).journal.verdict, "unverified");
    // THE SCRIPT OFF ITS POINTER.
    const off = JSON.parse(JSON.stringify(clean));
    off.state.inspect.liveScript = { version: "someone-else", build: "b" };
    assert.equal(recoveryChecks(off).aligned.verdict, "fail");
  } finally { await done(P, compiler); }
});

test("CD6 PUBLISH IS NEVER PRESSED BY ACCIDENT — publishPress without confirm: true, or without a named revision and version, refuses and makes no call", async () => {
  let calls = 0;
  const api = async () => { calls++; return { status: 200, body: { ok: true } }; };
  assert.equal((await publishPress(api, "x", { revision: 1, version: "v" })).called, false);
  assert.equal((await publishPress(api, "x", { revision: 1, version: "v", confirm: "yes" })).called, false);
  assert.equal((await publishPress(api, "x", { version: "v", confirm: true })).called, false);
  assert.equal((await publishPress(api, "x", { revision: 1, confirm: true })).called, false);
  assert.equal(calls, 0, "a refused press still called the route");
  assert.equal((await publishPress(api, "x", { revision: 1, version: "v", confirm: true })).called, true);
  assert.equal(calls, 1);
});

test("CD7 THE SWITCHES BEFORE A PRESS — the Worker's reading, the job's calculated reading and the job child's observed reading are judged apart: a missing probe leaves the observed check unverified even when the calculation agrees; a calculated on beside an observed off FAILS", () => {
  const want = { draftFirst: true, parallelWrites: true };
  const rt = { draftFirst: true, parallelWrites: true, jobDraftFirst: true, jobParallelWrites: true };
  const allOn = switchChecks(rt, { probe: "env", draftFirst: true, parallelWrites: true }, want);
  assert.equal(combine(allOn).verdict, "pass", JSON.stringify(allOn));
  const noProbe = switchChecks(rt, null, want);
  assert.equal(noProbe["draftFirst.jobObserved"].verdict, "unverified");
  assert.equal(noProbe["draftFirst.jobCalculated"].verdict, "pass");
  assert.equal(combine(noProbe).verdict, "unverified");
  const split = switchChecks(rt, { probe: "env", draftFirst: false, parallelWrites: true }, want);
  assert.equal(split["draftFirst.jobObserved"].verdict, "fail");
  assert.equal(combine(split).verdict, "fail");
  const oldRoute = switchChecks({ draftFirst: true }, null, want);
  assert.equal(oldRoute["draftFirst.jobCalculated"].verdict, "unverified", "a route that reports no job field read as a value");
  assert.equal(switchChecks({}, { probe: "env", error: "the Worker module has no jobSwitches export" }, want)["draftFirst.jobObserved"].verdict, "unverified");
  const off = switchChecks({ draftFirst: false, parallelWrites: false, jobDraftFirst: false, jobParallelWrites: false }, { probe: "env", draftFirst: false, parallelWrites: false }, { draftFirst: false, parallelWrites: false });
  assert.equal(combine(off).verdict, "pass", "both off, as wanted, did not pass");
});
