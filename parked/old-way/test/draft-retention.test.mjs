// PARKED (2026-11-03, park-old-way): the old-way half of test/draft-retention.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { platform, sendMessage, settle, call, T } from "../../../test/fixtures/request-flow.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { page as pageSrc } from "../../../test/fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "../../../test/fixtures/rows-db.mjs";
import { MAX_DATA_ROWS } from "../../../builder/site-apply.mjs";
import {
  DRAFT_KEY, PUBLISHING_KEY, HELD_KEY, HELD_SUM_KEY, readDraft, saveDraftRecord, sealHeldRevision, newHold, unpublishedOps, heldRange, publishPlan, markApplied,
  revisionsTrimmed, mintAfter, KEEP_PUBLISHED, TRIM_CLOCK_MARGIN_MS,
} from "../../../site-draft.mjs";

blockNetwork();

// ── A STORE WITH ETAGS, AS THE DRAFT'S FUNCTIONS USE IT ─────────────────────
function memDeps() {
  const m = new Map();
  let n = 0;
  return {
    m,
    gets: [],
    async get(k) { this.gets.push(k); const o = m.get(k); return o ? { etag: o.etag, text: async () => o.body } : null; },
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
    // AND READING THEM DOES NOT READ ONE JOURNAL PER REVISION (the cumulative record).
    const realGet = P.bucket.get;
    let journalsRead = 0;
    P.bucket.get = async (k, o) => { if (String(k).includes("/held/")) journalsRead++; return realGet.call(P.bucket, k, o); };
    try { assert.equal((await call(P, "GET", "/api/site/" + P.slug + "/draft")).status, 200); }
    finally { P.bucket.get = realGet; }
    assert.equal(journalsRead, 0, "the panel's read read " + journalsRead + " journals");
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

// ── THE CUMULATIVE RECORD OF HELD CHANGES (2026-10-16, Codex's review of `44676fcd`) ──
/** The reference: every journal read directly, as the code did before the record. */
async function fromJournals(deps, slug, draft, from, to = Infinity) {
  const out = [];
  for (const r of draft.revs) {
    if (r.n <= from || r.n > to || !r.held) continue;
    out.push({ n: r.n, ops: JSON.parse(deps.m.get(HELD_KEY(slug, r.held)).body).ops });
  }
  return out;
}
const journalReads = (deps, from) => deps.gets.slice(from).filter((k) => k.includes("/held/")).length;

// ── THE CUMULATIVE RECORD'S LAST TWO EDGES (2026-10-17, the T2 and R4 gaps) ──
// The mutation sweep of `5491e124` left two of the record's rules unproven:
// a malformed record replaced when there is nothing to learn (T2), and
// published revisions kept out of it (R4). Both are read from what is stored
// and from the writes each read makes.
const sumOf = (deps, slug) => { const o = deps.m.get(HELD_SUM_KEY(slug)); return o ? o.body : null; };
const sumWrites = (deps) => { const w = []; const put = deps.put.bind(deps); deps.put = async (k, ...rest) => { if (k.includes("/held-sum")) w.push(k); return put(k, ...rest); }; return w; };
