// NO CHANGE-COUNT LIMIT ON THE DRAFT (2026-10-16, the owner's requirement
// during the frontend batch).
//
// The owner: *"There must be no artificial change-count limit that forces
// publication or loses pending work. Users must be able to keep changing
// their draft across sessions, and only their explicit Publish click releases
// the approved state."* Codex found the draft record cut to its last 60
// revisions on every read and save (`MAX_REVS`): 100 held row additions
// published only 41–100, and one held addition followed by 99 code saves
// dropped the addition from the draft's effective state. Now every revision
// past `applied` is kept; only published revisions are trimmed, for the
// history, and what was trimmed is recorded so recovery still knows what a
// job's absence proves.
//
//   DRT1  Codex's first reproduction: 100 held additions — every one in the
//         draft's ops and in the publication's plan, after a reload too
//   DRT2  Codex's second: one held addition, then 99 code saves — the
//         addition stays in the effective state
//   DRT3  retention after a partial publication: published revisions trimmed
//         to the history kept, every unpublished one kept, `trimmed` recorded;
//         `revisionsTrimmed` proves absence only for a job that began after
//   DRT4  a record cut by the old limit reads as trimmed, with nothing dropped
//         on reading it
//   DRT5  THROUGH THE REAL WORKER: 130 mixed revisions (held additions and code
//         saves) on a live bakery; nothing live moves without a click; the
//         panel lists all 130; a next task is shown the earliest held loaf; a
//         partial Publish releases exactly revisions 1–60; a change saved
//         while that publication runs is kept and not published; a duplicate
//         click does nothing; the last Publish releases the rest, each loaf once
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { MAX_DATA_ROWS } from "../builder/site-apply.mjs";
import {
  DRAFT_KEY, PUBLISHING_KEY, readDraft, saveDraftRecord, sealHeldRevision, newHold, unpublishedOps, publishPlan, markApplied,
  revisionsTrimmed, mintAfter, KEEP_PUBLISHED, TRIM_CLOCK_MARGIN_MS,
} from "../site-draft.mjs";

blockNetwork();

// ── A STORE WITH ETAGS, AS THE DRAFT'S FUNCTIONS USE IT ─────────────────────
function memDeps() {
  const m = new Map();
  let n = 0;
  return {
    m,
    async get(k) { const o = m.get(k); return o ? { etag: o.etag, text: async () => o.body } : null; },
    async put(k, body, _ct, onlyIf) {
      const cur = m.get(k);
      if (onlyIf && onlyIf.etagDoesNotMatch === "*" && cur) return null;
      if (onlyIf && onlyIf.etagMatches && (!cur || cur.etag !== onlyIf.etagMatches)) return null;
      m.set(k, { body: String(body), etag: "e" + (++n) });
      return { etag: "e" + n };
    },
    async list(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })); },
    async remove(k) { m.delete(k); },
  };
}
const V0 = "01790000000000-aaaaaa";
let clock = Date.parse("2026-10-16T10:00:00.000Z");
const now = () => new Date(clock += 1000);
const insertOf = (i) => ({ kind: "row", table: "loaves", op: "insert", values: { name: "Loaf " + i, price: 4 + i / 100 } });
async function holdOne(deps, slug, op) {
  const h = newHold(deps, slug);
  h.add(op);
  const held = await h.flush();
  const r = await sealHeldRevision(deps, slug, { held, liveVersion: V0, now });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r;
}

test("DRT1 CODEX'S FIRST REPRODUCTION — 100 held additions: all 100 revisions kept, every addition in the draft's ops and in the publication's plan, the same after a reload", async () => {
  const deps = memDeps();
  const slug = "drt1";
  for (let i = 1; i <= 100; i++) await holdOne(deps, slug, insertOf(i));
  const { draft } = await readDraft(deps, slug);
  assert.deepEqual([draft.rev, draft.revs.length, draft.revs[0].n, draft.applied], [100, 100, 1, 0]);
  const ops = await unpublishedOps(deps, slug, draft);
  assert.deepEqual(ops.map((o) => o.values.name), Array.from({ length: 100 }, (_, i) => "Loaf " + (i + 1)), "an unpublished addition was left out of the draft's ops");
  const plan = publishPlan(ops);
  assert.equal(plan.ok, true);
  assert.equal(plan.plan.inserts.length, 100, "the publication's plan left additions out");
  assert.deepEqual([plan.plan.inserts[0].values.name, plan.plan.inserts[99].values.name], ["Loaf 1", "Loaf 100"]);
  // A RELOAD (a new session reading the record afresh) reads the same.
  const again = (await readDraft(deps, slug)).draft;
  assert.deepEqual(again.revs.map((r) => r.n), draft.revs.map((r) => r.n));
  assert.equal(again.trimmed, null, "nothing was published, so nothing may be trimmed");
});

test("DRT2 CODEX'S SECOND REPRODUCTION — one held addition, then 99 code saves: the addition stays in the draft's effective state, and every code revision is kept", async () => {
  const deps = memDeps();
  const slug = "drt2";
  await holdOne(deps, slug, insertOf(1));
  let v = V0;
  for (let i = 0; i < 99; i++) {
    v = mintAfter(v, 0, ("c" + i).padStart(6, "0"));
    const r = await saveDraftRecord(deps, slug, { version: v, base: V0, job: "job-" + i, now });
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  const { draft } = await readDraft(deps, slug);
  assert.deepEqual([draft.rev, draft.revs.length, draft.version], [100, 100, v]);
  const ops = await unpublishedOps(deps, slug, draft);
  assert.deepEqual(ops.map((o) => o.values && o.values.name), ["Loaf 1"], "the early unpublished addition fell out of the draft");
  assert.ok(draft.revs.find((r) => r.job === "job-0"), "the first code save fell off the list");
});

test("DRT3 AFTER A PARTIAL PUBLICATION — published revisions trimmed to the history kept, every unpublished one kept; what was trimmed is recorded, and a job's absence proves nothing only for a job that began before it", async () => {
  const deps = memDeps();
  const slug = "drt3";
  for (let i = 1; i <= 130; i++) await holdOne(deps, slug, insertOf(i));
  const before = (await readDraft(deps, slug)).draft;
  const m = await markApplied(deps, slug, { revision: 60 });
  assert.equal(m.ok, true);
  const { draft } = await readDraft(deps, slug);
  const pending = draft.revs.filter((r) => r.n > draft.applied).map((r) => r.n);
  assert.deepEqual(pending, Array.from({ length: 70 }, (_, i) => 61 + i), "an unpublished revision was dropped");
  const kept = draft.revs.filter((r) => r.n <= draft.applied).map((r) => r.n);
  assert.deepEqual(kept, Array.from({ length: KEEP_PUBLISHED }, (_, i) => 60 - KEEP_PUBLISHED + 1 + i));
  assert.equal(draft.trimmed.n, 60 - KEEP_PUBLISHED);
  assert.equal(draft.trimmed.at, before.revs[60 - KEEP_PUBLISHED - 1].at, "the trimming's time is not the last trimmed revision's");
  const ops = await unpublishedOps(deps, slug, draft);
  assert.deepEqual([ops.length, ops[0].values.name, ops[69].values.name], [70, "Loaf 61", "Loaf 130"]);
  // MORE SAVES AFTER THE PUBLICATION: still nothing unpublished dropped.
  for (let i = 131; i <= 200; i++) await holdOne(deps, slug, insertOf(i));
  const d2 = (await readDraft(deps, slug)).draft;
  assert.equal(d2.revs.filter((r) => r.n > d2.applied).length, 140);
  assert.equal(d2.revs.filter((r) => r.n <= d2.applied).length, KEEP_PUBLISHED);
  // ABSENCE: a job that began well after the trimmed revisions were saved left
  // nothing trimmed; one that began before, or at an unknown time, may have.
  const cut = Date.parse(draft.trimmed.at);
  assert.equal(revisionsTrimmed(draft, { since: cut + TRIM_CLOCK_MARGIN_MS + 1000 }), false);
  assert.equal(revisionsTrimmed(draft, { since: new Date(cut + TRIM_CLOCK_MARGIN_MS + 1000).toISOString() }), false);
  assert.equal(revisionsTrimmed(draft, { since: cut - 1000 }), true);
  assert.equal(revisionsTrimmed(draft, { since: cut + 1000 }), true, "inside the clock margin is not proof");
  assert.equal(revisionsTrimmed(draft, {}), true);
  // NOTHING TRIMMED: nothing could have been dropped.
  assert.equal(revisionsTrimmed(before, {}), false);
});

test("DRT4 A RECORD CUT BY THE OLD LIMIT — read as stored (nothing more dropped on reading), and said as trimmed with no time, so it proves no job's absence", async () => {
  const deps = memDeps();
  const slug = "drt4";
  const revs = Array.from({ length: 60 }, (_, i) => ({ n: 41 + i, version: V0, at: "2026-10-15T00:00:" + String(i % 60).padStart(2, "0") + ".000Z", job: null, held: null, ops: 0 }));
  await deps.put(DRAFT_KEY(slug), JSON.stringify({ v: 2, version: V0, build: "", base: V0, job: null, at: "", history: [], preview: "0123456789ab", rev: 100, revs, applied: 0, refs: {} }));
  const { draft } = await readDraft(deps, slug);
  assert.deepEqual([draft.revs.length, draft.revs[0].n, draft.trimmed], [60, 41, null]);
  assert.equal(revisionsTrimmed(draft, { since: Date.now() }), true);
  // A SAVE ON IT KEEPS ALL 60 AND ADDS ONE.
  await holdOne(deps, slug, insertOf(1));
  const d2 = (await readDraft(deps, slug)).draft;
  assert.deepEqual([d2.revs.length, d2.revs[0].n, d2.rev], [61, 41, 101]);
});

// ── THROUGH THE REAL WORKER ──────────────────────────────────────────────────
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));

test("DRT5 130 MIXED REVISIONS THROUGH THE REAL WORKER — held additions and code saves on a live bakery: nothing live moves without a click; the panel lists all 130; the next task is shown the earliest held loaf; Publish of revision 60 releases exactly 1–60; a change saved while it runs is kept, unpublished; a second click does nothing; the last Publish releases the rest, each loaf once", { timeout: 240000 }, async () => {
  const compiler = installCompiler();
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 100 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  const shown = [];
  let tt = TT_FROM, edits = 0;
  const P = platform({
    slug: "drt5-" + Math.random().toString(16).slice(2, 8), balance: 100000, pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], db, liveScripts: true,
    answers: {
      route: (args) => (/TikTok/.test(String(args.messages[0].content)) ? { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] } : { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"] }] }),
      [T.text]: (args) => { const from = tt; tt = "Follow us on TikTok at @harbour" + (++edits); return { edits: [{ id: lineId(args, "visit.tsx", from), to: tt }] }; },
      write_row_changes: (args) => { shown.push(String(args.messages[0].content)); return { changes: [{ table: "loaves", id: 2, values: { price: 5.9 } }] }; },
    },
  });
  try {
    // PUBLISHED ONCE BEFORE THE SWITCH.
    const r0 = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourloaf." });
    await settle(P, r0.key, { rounds: 20 });
    const pointer = () => JSON.parse(bare(P.readObj("current/" + P.slug + ".json"))).version;
    const v0 = pointer();
    const live0 = P.liveScript();
    P.env.DRAFT_FIRST = "on";
    const deps = {
      get: (k) => P.run(() => P.bucket.get(k)),
      put: (k, body, ct, onlyIf) => P.run(() => P.bucket.put(k, body, { httpMetadata: { contentType: ct || "application/json" }, ...(onlyIf ? { onlyIf } : {}) })),
      list: async (prefix) => (await P.run(() => P.bucket.list({ prefix }))).objects,
      remove: (k) => P.run(() => P.bucket.delete(k)),
    };
    // A CODE SAVE: a real page edit, run as a job, saved as the draft's next revision.
    const versions = {};
    const codeSave = async (n) => {
      const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbour" + n + "." });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const { rec } = await settle(P, r.key, { rounds: 20 });
      assert.ok(rec, "no request for the page edit: " + JSON.stringify(r.body).slice(0, 400));
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts[0]).slice(0, 300));
      const d = (await readDraft(deps, P.slug)).draft;
      assert.equal(d.revs[d.revs.length - 1].n, n, "the page edit is not revision " + n);
      versions[n] = d.version;
    };
    const writes0 = db.writes().length;
    const held = [];
    for (let n = 1; n <= 130; n++) {
      if (n % 3 === 0) await codeSave(n);
      else {
        const h = newHold(deps, P.slug);
        h.add(insertOf(n));
        const r = await sealHeldRevision(deps, P.slug, { held: await h.flush(), liveVersion: v0 });
        assert.equal(r.ok, true, JSON.stringify(r));
        held.push(n);
      }
    }
    // NOTHING LIVE MOVED.
    assert.deepEqual([pointer(), P.liveScript(), db.writes().length], [v0, live0, writes0], "something went live without a click");
    // THE PANEL LISTS EVERY UNPUBLISHED REVISION.
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.equal(st.status, 200, JSON.stringify(st.body).slice(0, 300));
    assert.deepEqual([st.body.state, st.body.revision, st.body.applied, st.body.revisions.length, st.body.revisions[0].revision], ["saved", 130, 0, 130, 1]);
    // A NEXT TASK IS SHOWN THE DRAFT'S ROWS, THE EARLIEST HELD LOAF INCLUDED.
    const t = await sendMessage(P, { message: "Make the Dark Rye £5.90." });
    await settle(P, t.key, { rounds: 20 });
    assert.ok(shown.length > 0, "the data step was never asked");
    assert.match(shown[shown.length - 1], /name="Loaf 1"/, "the earliest held loaf was not shown to the next task");
    // THE DATA STEP IS SHOWN A TABLE'S FIRST `MAX_DATA_ROWS` ROWS, live or held
    // alike (a prompt bound, kept separate in the backlog): as many as it shows.
    const rowsShown = shown[shown.length - 1].split("\n").filter((l) => /^  id -?\d+: /.test(l)).length;
    assert.equal(rowsShown, Math.min(MAX_DATA_ROWS, BAKERY_LOAVES.length + held.length));
    const after131 = (await readDraft(deps, P.slug)).draft;
    assert.equal(after131.rev, 131);
    assert.equal(db.writes().length, writes0, "the task's change went live");

    // PUBLISH REVISION 60 — AND, WHILE IT RUNS, ANOTHER CHANGE IS SAVED.
    let during = null;
    P.beforePut((k) => k === PUBLISHING_KEY(P.slug) && !during, async () => {
      const h = newHold(deps, P.slug);
      h.add(insertOf(999));
      during = await sealHeldRevision(deps, P.slug, { held: await h.flush(), liveVersion: v0 });
    });
    const p60 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 60, version: versions[60] });
    assert.equal(p60.status, 200, JSON.stringify(p60.body).slice(0, 400));
    assert.ok(during && during.ok, "the change saved during the publication was not saved");
    const names = () => db.rows("loaves").map((r) => r.name).filter((x) => /^Loaf /.test(x));
    const expect60 = held.filter((n) => n <= 60).map((n) => "Loaf " + n);
    assert.deepEqual(names(), expect60, "the partial publication released other than exactly revisions 1–60");
    assert.equal(pointer(), versions[60], "the pages live are not revision 60's");
    const d60 = (await readDraft(deps, P.slug)).draft;
    assert.equal(d60.applied, 60);
    assert.deepEqual(d60.revs.filter((r) => r.n > 60).map((r) => r.n), Array.from({ length: 72 }, (_, i) => 61 + i), "an unpublished revision was dropped by the publication");
    assert.ok(!names().includes("Loaf 999"), "a change saved during the publication went live");
    // A SECOND CLICK ON THE SAME REVISION DOES NOTHING.
    const again = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 60, version: versions[60] });
    assert.deepEqual([again.status, again.body.already], [200, true]);
    assert.deepEqual(names(), expect60);
    // THE LAST PUBLISH RELEASES THE REST, EACH LOAF ONCE.
    const last = d60.rev;
    const pl = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: last });
    assert.equal(pl.status, 200, JSON.stringify(pl.body).slice(0, 400));
    const all = [...held.map((n) => "Loaf " + n), "Loaf 999"];
    assert.deepEqual(names(), all, "the rest did not go live exactly once each");
    assert.equal(pointer(), versions[129], "the last code revision's pages are not live");
    assert.equal(Number(db.rows("loaves").find((r) => r.id === 2).price), 5.9, "the task's change was not released");
    const fin = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([fin.body.state, fin.body.unpublished, fin.body.revisions.length], ["published", false, 0]);
  } finally {
    await P.settle();
    P.close(); compiler.uninstall();
  }
});

test("DRT6 THE RECOVERY READERS TAKE THE TRIMMING FACT — Edit/Add-on reconcile and Build recovery: a list starting past revision 1 is cannot-tell unless the reader says this job's revision could not have been trimmed; then its absence decides", async () => {
  const { reconcileVerdict } = await import("../builder/site-reconcile.mjs");
  const { savedOfJob } = await import("../builder/build-lease.mjs");
  const revs = [{ n: 31, version: V0, at: "x", job: "job-other", held: null, ops: 0 }];
  const note = { n: 30, at: "2026-10-01T00:00:00.000Z" };
  const facts = (trimmed, record = { version: V0, rev: 31, revs, trimmed: note }) => ({ job: { id: "job-a" }, pointer: null, live: null, builds: [], buildsUnread: [], mine: null, draft: { state: "read", record, ...(trimmed === undefined ? {} : { trimmed }) }, manifests: {}, journals: {} });
  assert.equal(reconcileVerdict(facts(undefined)).kind, "draft-trimmed", "without the fact, a record that says it was trimmed proved absence");
  assert.equal(reconcileVerdict(facts(undefined, { version: V0, rev: 31, revs })).kind, "never-staged", "a short list past revision 1, never trimmed, was taken as trimmed");
  assert.equal(reconcileVerdict(facts(true)).kind, "draft-trimmed");
  assert.equal(reconcileVerdict(facts(false)).kind, "never-staged", "the reader's fact that nothing of this job was trimmed was ignored");
  const draft = (trimmed, record = { version: V0, rev: 31, revs, trimmed: note }) => ({ state: "read", record, ...(trimmed === undefined ? {} : { trimmed }) });
  assert.deepEqual(savedOfJob(draft(undefined), "job-a", []), { state: "unknown", why: "draft-trimmed" });
  assert.deepEqual(savedOfJob(draft(undefined, { version: V0, rev: 31, revs }), "job-a", []), { state: "none" });
  // A RECORD THE EARLIER LIMIT CUT (sixty, from past revision 1), with no note: proves nothing.
  const cut60 = Array.from({ length: 60 }, (_, i) => ({ n: 41 + i, version: V0, at: "x", job: "job-other", held: null, ops: 0 }));
  assert.equal(reconcileVerdict(facts(undefined, { version: V0, rev: 100, revs: cut60 })).kind, "draft-trimmed");
  assert.deepEqual(savedOfJob(draft(undefined, { version: V0, rev: 100, revs: cut60 }), "job-a", []), { state: "unknown", why: "draft-trimmed" });
  assert.deepEqual(savedOfJob(draft(true), "job-a", []), { state: "unknown", why: "draft-trimmed" });
  assert.deepEqual(savedOfJob(draft(false), "job-a", []), { state: "none" });
  // A LIST FROM REVISION 1 WAS NEVER TRIMMED: absence decides, whatever its length.
  const whole = Array.from({ length: 150 }, (_, i) => ({ n: i + 1, version: V0, at: "x", job: "job-other", held: null, ops: 0 }));
  assert.equal(reconcileVerdict({ ...facts(undefined), draft: { state: "read", record: { version: V0, rev: 150, revs: whole } } }).kind, "never-staged", "a long untrimmed list was taken as trimmed");
  assert.deepEqual(savedOfJob({ state: "read", record: { version: V0, rev: 150, revs: whole } }, "job-a", []), { state: "none" });
});
