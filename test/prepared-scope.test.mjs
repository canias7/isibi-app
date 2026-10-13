// A PREPARED ANSWER RESTS ON EXACTLY WHAT ITS MODEL WAS SHOWN (2026-10-11,
// after Codex's review of 1694dc88). Pure cases, one rule each:
//   - the replayer reuses an answer only for a byte-identical request, and
//     counts every call made through it — none prepared, or only pictures;
//   - a scoped step is shown its declared pages or tables and only the names
//     of the rest, with `needs` as its way out, and is asked again with the
//     whole site when it says so (usage summed);
//   - a scoped answer is checked against what it was shown;
//   - a scoped request is the same whatever changes outside its scope, and a
//     different one when anything inside it changes;
//   - the job body carries the scope only for a part that was prepared;
//   - the request view keeps missing evidence apart from zero.
import test from "node:test";
import assert from "node:assert/strict";
import { textRequest, dataRequest, runTextEdit, runDataEdit, scopedText, scopedData, needsOf, fileOfPagePath } from "../builder/site-apply.mjs";
import { replayer, recorder, requestHash } from "../builder/prepared.mjs";
import { prepScope, stepInputs } from "../builder/request-plan.mjs";
import { jobBody, requestView } from "../builder/request.mjs";

const tool = (name, input, usage = { input_tokens: 10, output_tokens: 4 }) => ({ stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t", name, input }] });

test("replayer: an exact request is answered from the record; any other call is made and counted fresh — with no calls recorded, with only pictures, and with nothing at all", async () => {
  const req = { model: "m", messages: [{ role: "user", content: "a" }] };
  const rec = recorder();
  await rec.wrap(async () => tool("x", { ok: 1 }))(req);
  let live = 0;
  const send = async () => { live++; return tool("x", { ok: 2 }); };
  const rp = replayer({ calls: rec.calls, images: [] });
  assert.deepEqual((await rp.wrap(send)(req)).content[0].input, { ok: 1 });
  await rp.wrap(send)({ ...req, messages: [{ role: "user", content: "b" }] });
  assert.equal(live, 1);
  assert.deepEqual(rp.used(), { calls: 1, rebased: 0, images: 0, missed: 1 });
  // ONLY PICTURES: Codex's case — the call was made and `missed` stayed 0.
  const pics = replayer({ calls: [], images: [{ d: "a loaf", url: "https://x.example/l.png" }] });
  await pics.wrap(send)(req);
  assert.equal(live, 2);
  assert.deepEqual(pics.used(), { calls: 0, rebased: 0, images: 0, missed: 1 });
  // NOTHING STAGED: the job still counts what it asks.
  const none = replayer(null);
  await none.wrap(send)(req);
  await none.wrap(send)(req);
  assert.deepEqual(none.used(), { calls: 0, rebased: 0, images: 0, missed: 2 });
  // A REPLAYED ANSWER IS USED ONCE: the same request again is asked.
  await rp.wrap(send)(req);
  assert.deepEqual(rp.used(), { calls: 1, rebased: 0, images: 0, missed: 2 });
});

test("recorder keeps a fingerprint and the answer only — no copy of the request rides with the record", async () => {
  const rec = recorder();
  await rec.wrap(async () => tool("x", {}))({ model: "m", messages: [{ role: "user", content: "secret words of a page" }] });
  assert.deepEqual(Object.keys(rec.calls[0]).sort(), ["h", "reply"]);
});

// ── TEXT ─────────────────────────────────────────────────────────────────────
const items = (rows) => rows.map(([path, text], i) => ({ path, text, at: i * 100 }));
const SITE = items([["index.tsx", "Harbour Loaf"], ["visit.tsx", "Come to the bakery"], ["about.tsx", "Our story"], ["about.tsx", "Open from 9 on weekdays."]]);
const ASK = "on the About page say we open from 8 on weekdays";

test("scopedText: the named pages' words and their word-for-word copies elsewhere; null when a named page has no words or nothing would be left out", () => {
  const sc = scopedText(SITE, { pages: ["/about"] });
  assert.deepEqual(sc.shown.map((i) => i.path + ":" + i.text), ["about.tsx:Our story", "about.tsx:Open from 9 on weekdays."]);
  assert.deepEqual(sc.others, ["index.tsx", "visit.tsx"]);
  const copies = items([["index.tsx", "Harbour Loaf"], ["about.tsx", "Harbour Loaf"], ["about.tsx", "Our story"], ["visit.tsx", "Come"]]);
  assert.deepEqual(scopedText(copies, { pages: ["/about"] }).shown.map((i) => i.path), ["index.tsx", "about.tsx", "about.tsx"], "a copy of a scoped line on another page is shown");
  assert.equal(scopedText(SITE, { pages: ["/menu"] }), null, "a named page with no words");
  assert.equal(scopedText(SITE, { pages: ["/", "/visit", "/about"] }), null, "nothing left out");
  assert.equal(scopedText(SITE, null), null);
  assert.equal(scopedText(SITE, { tables: ["loaves"] }), null);
  assert.equal(fileOfPagePath("/"), "index.tsx");
  assert.equal(fileOfPagePath("/menu/drinks"), "menu.drinks.tsx");
});

test("text: the scoped request holds no word of another page, names them, offers `needs`; the unscoped request is exactly the one sent before", () => {
  const sc = scopedText(SITE, { pages: ["/about"] });
  const q = textRequest({ instruction: ASK, items: sc.shown, others: sc.others });
  const c = q.messages[0].content;
  assert.ok(!c.includes("Come to the bakery") && !c.includes("Harbour Loaf"), c);
  assert.match(c, /NOT SHOWN\n[^\n]*index\.tsx, visit\.tsx/);
  assert.ok(q.tools[0].input_schema.properties.needs);
  const plain = textRequest({ instruction: ASK, items: SITE });
  assert.ok(!plain.tools[0].input_schema.properties.needs);
  assert.ok(!plain.messages[0].content.includes("NOT SHOWN"));
});

test("text: a scoped request is byte for byte the same whatever another page says, and a different one when the scoped page changes", async () => {
  const hash = (rows) => { const it = items(rows); const sc = scopedText(it, { pages: ["/about"] }); return requestHash(textRequest({ instruction: ASK, items: sc.shown, others: sc.others })); };
  const base = [["index.tsx", "Harbour Loaf"], ["visit.tsx", "Come to the bakery"], ["about.tsx", "Our story"], ["about.tsx", "Open from 9 on weekdays."]];
  const elsewhere = [["index.tsx", "Harbour Loaf"], ["visit.tsx", "Come to the harbour bakery"], ["visit.tsx", "Fresh every day"], ["about.tsx", "Our story"], ["about.tsx", "Open from 9 on weekdays."]];
  const inside = [["index.tsx", "Harbour Loaf"], ["visit.tsx", "Come to the bakery"], ["about.tsx", "Our history"], ["about.tsx", "Open from 9 on weekdays."]];
  assert.equal(await hash(base), await hash(elsewhere));
  assert.notEqual(await hash(base), await hash(inside));
});

const pagesOf = (map) => Object.entries(map).map(([path, body]) => ({ path, source: "export default function P(){ return <main>" + body + "</main> }\n" }));
const PAGES = pagesOf({ "index.tsx": "<h1>Harbour Loaf</h1>", "visit.tsx": "<h1>Come to the bakery</h1>", "about.tsx": "<h1>Our story</h1><p>Open from 9 on weekdays.</p>" });

test("runTextEdit: shown its scope; `needs` asks again with every page (usage summed, `seen: widened`); an answer naming a line it was not shown is not applied", async () => {
  const asked = [];
  const send = async (q) => {
    asked.push(q);
    const c = q.messages[0].content;
    if (q.tools[0].input_schema.properties.needs) return tool("write_text_edits", { needs: true, edits: [] });
    const id = Number(c.split("\n").find((l) => l.includes("Come to the bakery")).split(".")[0]);
    return tool("write_text_edits", { edits: [{ id, to: "Come to the harbour" }] });
  };
  const out = await runTextEdit({ send }, { instruction: ASK, pages: PAGES, scope: { pages: ["/about"] } });
  assert.equal(asked.length, 2);
  assert.ok(!asked[0].messages[0].content.includes("[visit.tsx]") && asked[1].messages[0].content.includes("[visit.tsx]"));
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.seen, "widened");
  assert.equal(out.usage.in, 20);
  assert.equal(out.usage.out, 8);
  // AN ANSWER THAT NAMES AN ID BEYOND WHAT IT WAS SHOWN.
  const stray = await runTextEdit({ send: async () => tool("write_text_edits", { edits: [{ id: 3, to: "x" }] }) }, { instruction: ASK, pages: PAGES, scope: { pages: ["/about"] } });
  assert.equal(stray.ok, false);
  assert.equal(stray.reason, "no-match");
  assert.equal(stray.seen, "scope");
  // NO SCOPE: one call, the whole site, as before.
  const once = [];
  await runTextEdit({ send: async (q) => { once.push(q); return tool("write_text_edits", { edits: [] }); } }, { instruction: ASK, pages: PAGES });
  assert.equal(once.length, 1);
  assert.ok(once[0].messages[0].content.includes("[visit.tsx]"));
  assert.equal(needsOf(tool("write_text_edits", { needs: "yes" })), false, "only `true` is a need");
});

// ── DATA ─────────────────────────────────────────────────────────────────────
const TABLES = [
  { name: "loaves", columns: ["name", "price"], rows: [{ id: 2, name: "Dark Rye", price: 5 }] },
  { name: "hours", columns: ["day", "opens"], rows: [{ id: 1, day: "Monday", opens: "09:00" }] },
];
const RYE = "set the Dark Rye's price to two pounds less than the Monday opening hour";

test("scopedData and the scoped data request: only the named tables' rows, the rest by name, the removed rows and the token room of the named tables alone", () => {
  const sc = scopedData(TABLES, { tables: ["loaves"] });
  assert.deepEqual(sc.others, ["hours"]);
  const recent = [{ table: "hours", was: { day: "Sunday" } }, { table: "loaves", was: { name: "Seeded" } }];
  const q = dataRequest({ instruction: RYE, tables: sc.shown, others: sc.others, recent: recent.filter((r) => sc.names.includes(r.table)), lists: [] });
  const c = q.messages[0].content;
  assert.ok(!c.includes("TABLE hours") && !c.includes('opens=') && !c.includes("Sunday"), c);
  assert.ok(c.includes("TABLE loaves") && c.includes("Seeded"));
  assert.match(c, /NOT SHOWN\n[^\n]*hours/);
  assert.ok(q.tools[0].input_schema.properties.needs);
  assert.equal(scopedData(TABLES, { tables: ["staff"] }), null, "a named table the site does not have");
  assert.equal(scopedData(TABLES, { tables: ["loaves", "hours"] }), null, "nothing left out");
  assert.equal(scopedData(TABLES, { pages: ["/"] }), null);
});

test("runDataEdit: shown only its table, it needs the hours; asked again with every table, it works the price out from them (6) — usage summed; an answer naming a table it was not shown writes nothing", async () => {
  const sent = [];
  const model = async (q) => {
    sent.push(q);
    const m = /day="Monday", opens="(\d+):/.exec(q.messages[0].content);
    if (!m) return tool("write_row_changes", { needs: true, changes: [] });
    return tool("write_row_changes", { changes: [{ table: "loaves", id: 2, values: { price: Number(m[1]) - 2 } }] });
  };
  const applied = [];
  const tables = [TABLES[0], { ...TABLES[1], rows: [{ id: 1, day: "Monday", opens: "08:00" }] }];
  const out = await runDataEdit({ send: model, apply: async (c) => { applied.push(c); return true; } }, { instruction: RYE, tables, scope: { tables: ["loaves"] } });
  assert.equal(sent.length, 2);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(applied.map((c) => [c.table, c.id, c.values.price]), [["loaves", 2, 6]]);
  assert.equal(out.usage.in, 20);
  // THE ROWS JUST REMOVED, AS THE STEP IS SHOWN THEM: only its own table's.
  const shown = [];
  await runDataEdit({ send: async (q) => { shown.push(q.messages[0].content); return tool("write_row_changes", { changes: [] }); }, apply: async () => true },
    { instruction: RYE, tables: TABLES, scope: { tables: ["loaves"] }, recent: [{ table: "hours", was: { day: "Sunday" } }, { table: "loaves", was: { name: "Seeded" } }] });
  assert.ok(shown[0].includes("Seeded") && !shown[0].includes("Sunday"), shown[0]);
  // AN ANSWER OUTSIDE ITS SCOPE: never written, though the table exists.
  const wrote = [];
  const stray = await runDataEdit({ send: async () => tool("write_row_changes", { changes: [{ table: "hours", id: 1, values: { opens: "07:00" } }] }), apply: async (c) => { wrote.push(c); return true; } }, { instruction: RYE, tables: TABLES, scope: { tables: ["loaves"] } });
  assert.deepEqual(wrote, []);
  assert.equal(stray.ok, false);
  // CONTROL: unscoped, the same answer is written.
  await runDataEdit({ send: async () => tool("write_row_changes", { changes: [{ table: "hours", id: 1, values: { opens: "07:00" } }] }), apply: async (c) => { wrote.push(c); return true; } }, { instruction: RYE, tables: TABLES });
  assert.equal(wrote.length, 1);
});

test("data: a scoped request is the same whatever another table holds, and a different one when its own table changes", async () => {
  const h = (tables) => { const sc = scopedData(tables, { tables: ["loaves"] }); return requestHash(dataRequest({ instruction: RYE, tables: sc.shown, others: sc.others, lists: [] })); };
  const hoursMoved = [TABLES[0], { ...TABLES[1], rows: [{ id: 1, day: "Monday", opens: "08:00" }] }];
  const ryeMoved = [{ ...TABLES[0], rows: [{ id: 2, name: "Dark Rye", price: 6 }] }, TABLES[1]];
  assert.equal(await h(TABLES), await h(hoursMoved));
  assert.notEqual(await h(TABLES), await h(ryeMoved));
});

// ── THE PLAN AND THE JOB BODY ────────────────────────────────────────────────
const part = (layer, writes, page, extra = {}) => ({ n: 1, needs: [], phase: "run", status: "ready", route: { intent: "edit", layer, ...(page ? { page } : {}) }, targets: { writes, reads: [] }, ...extra });

test("prepScope: a text step's named pages and a data step's named tables — and null whenever the reach is not declared that narrowly", () => {
  assert.deepEqual(prepScope(part("text", ["page:/about"], "/about")), { pages: ["/about"] });
  assert.deepEqual(stepInputs(part("text", ["page:/about"], "/about")), ["page:/about"]);
  assert.deepEqual(prepScope(part("data", ["data:loaves"])), { tables: ["loaves"] });
  assert.equal(prepScope(part("text", ["page:/about"], "/visit")), null, "a route naming another page than its targets");
  assert.equal(prepScope(part("text", ["page:/about", "header"], "/about")), null, "a write beyond pages");
  assert.equal(prepScope(part("text", [], "/about")), null, "nothing named");
  assert.equal(prepScope(part("data", ["data:loaves", "menu"])), null, "a write beyond tables");
  // RULES NAMED FOR TABLES ARE NARROWED (2026-10-11, the generality round):
  // their step is shown those tables only, the data step's contract, `needs` included.
  assert.deepEqual(prepScope(part("rules", ["data:loaves"])), { tables: ["loaves"] }, "a rules change named for a table is narrowed to it");
  assert.equal(prepScope(part("rules", ["data:loaves", "menu"])), null, "a rules write beyond tables");
  assert.equal(prepScope(part("rules", [])), null, "a rules change naming nothing");
  assert.equal(prepScope({ ...part("text", ["page:/about"], "/about"), targets: { writes: ["page:/about"], reads: ["page:/visit"] } }), null, "a step that declares it reads another page");
  assert.equal(prepScope({ ...part("text", ["page:/about"], "/about"), phase: "route" }), null, "a part still to be routed");
});

test("jobBody: the scope rides on a prepared part's edit body only — its preparation and its job send the same; an unprepared part's body carries none", () => {
  const rec = (prep) => ({
    key: "rq-0000000000-aaaaaaaa", slug: "s", picker: "grok", files: [], parts: [
      { n: 0, words: "x", runs: "x", needs: [], held: [], jobs: [], seq: 1, phase: "run", status: "done", route: { intent: "edit", layer: "data" }, targets: { writes: ["data:hours"], reads: [] } },
      { ...part("data", ["data:loaves"]), words: "y", runs: "y", held: [], jobs: [], seq: 0, ...(prep ? { prep } : {}) },
    ],
  });
  const withPrep = jobBody(rec({ seq: 1, state: "running" }), 1, "run", "k");
  assert.deepEqual(withPrep.body.scope, { tables: ["loaves"] });
  const without = jobBody(rec(null), 1, "run", "k");
  assert.equal(without.body.scope, undefined);
});

test("requestView: a job's evidence served with its counts; a job with none is not known — no counts at all; a count that does not read is null, never 0", () => {
  const base = { key: "k", state: "done", at: 1, updatedAt: 2, parts: [{ n: 0, words: "w", status: "done", held: [], jobs: [{ key: "a", kind: "run", id: "job-a" }, { key: "b", kind: "run", id: "job-b" }, { key: "c", kind: "run", id: "job-c" }] }] };
  let v;
  const MARK = { what: "pick_adds", others: 1, rule: true, unmarked: 0, done: 0, replayed: true };
  try { v = requestView(base, { prepUse: { "job-a": { staged: "yes", replayed: 1, rebased: 0, fresh: 0, scoped: 2, needs: 1, marks: [MARK] }, "job-b": null, "job-c": { staged: "odd", replayed: "1", fresh: -1, scoped: "2", marks: [{ ...MARK, unmarked: -1 }] } } }); }
  catch (e) { assert.fail("requestView threw on a minimal record: " + e.message); }
  // `scoped` and `needs` (v3, 2026-10-11): how many scoped answers the job's
  // steps gave, and how many of those said `needs` — the direct evidence of
  // the model asking. Evidence written before v3 carries neither: null.
  // `marks` (2026-10-13): each call's `partMarks`; absent or unreadable is
  // null — unknown, never "no markings".
  assert.deepEqual(v.parts[0].prepUse, [
    { job: "job-a", known: true, staged: "yes", replayed: 1, rebased: 0, fresh: 0, scoped: 2, needs: 1, marks: [MARK] },
    { job: "job-b", known: false },
    { job: "job-c", known: true, staged: null, replayed: null, rebased: null, fresh: null, scoped: null, needs: null, marks: null },
  ]);
});

// ── THE SCOPED ANSWER NOTED WHEN IT ARRIVES (2026-10-11, round 4) ───────────
// Codex: `deps.seen` ran only after the widened call succeeded, so a scoped
// answer that said `needs: true` followed by a second call that threw left no
// evidence at all. Now each scoped answer is noted the moment it is received,
// with its own explicit `needs`; the outcome, the retry and the charge are
// unchanged (a failed call is still `reason: "send"`, `usage: null`).
const NEED_TEXT = tool("write_text_edits", { needs: true, edits: [] });
const NEED_DATA = tool("write_row_changes", { needs: true, changes: [] });
const boom = () => { const e = new Error("upstream 529"); e.status = 529; return e; };

test("runTextEdit notes the scoped answer when it arrives: needs then a failing widened call keeps `needs`; needs then success keeps it once; a scoped answer without needs is `scope`; a first call that fails notes nothing; unscoped notes nothing", async () => {
  const run = async (answers, scope = { pages: ["/about"] }) => {
    const seen = [];
    let i = 0;
    const out = await runTextEdit({ send: async () => { const a = answers[i++]; if (a instanceof Error) throw a; return a; }, seen: (x) => seen.push(x) }, { instruction: ASK, pages: PAGES, scope });
    return { out, seen, calls: i };
  };
  // FAILURE: the scoped answer asked, the widened call threw.
  const f = await run([NEED_TEXT, boom()]);
  assert.deepEqual(f.seen, ["needs"], "the answer that asked for context left no evidence");
  assert.equal(f.calls, 2);
  assert.equal(f.out.ok, false);
  assert.equal(f.out.reason, "send");
  assert.equal(f.out.usage, null, "a failed call is billed now");
  // POSITIVE: the scoped answer asked, the widened call answered.
  const p = await run([NEED_TEXT, tool("write_text_edits", { edits: [] })]);
  assert.deepEqual(p.seen, ["needs"], "the asking answer counted other than once");
  // A SCOPED ANSWER THAT DID NOT ASK.
  const s = await run([tool("write_text_edits", { edits: [] })]);
  assert.deepEqual(s.seen, ["scope"]);
  // THE FIRST CALL FAILED: no answer was received, so nothing is claimed.
  const n = await run([boom()]);
  assert.deepEqual(n.seen, []);
  assert.equal(n.out.reason, "send");
  // UNSCOPED: never a scoped answer.
  const u = await run([tool("write_text_edits", { edits: [] })], null);
  assert.deepEqual(u.seen, []);
});

test("runDataEdit notes the scoped answer when it arrives, the same way: needs then a failing widened call keeps `needs`, writes nothing and bills nothing; the controls as for text", async () => {
  const run = async (answers, scope = { tables: ["loaves"] }) => {
    const seen = [], wrote = [];
    let i = 0;
    const out = await runDataEdit({ send: async () => { const a = answers[i++]; if (a instanceof Error) throw a; return a; }, apply: async (c) => { wrote.push(c); return true; }, seen: (x) => seen.push(x) }, { instruction: RYE, tables: TABLES, scope });
    return { out, seen, wrote, calls: i };
  };
  const f = await run([NEED_DATA, boom()]);
  assert.deepEqual(f.seen, ["needs"], "the answer that asked for context left no evidence");
  assert.equal(f.calls, 2);
  assert.equal(f.out.reason, "send");
  assert.equal(f.out.usage, null);
  assert.deepEqual(f.wrote, []);
  const p = await run([NEED_DATA, tool("write_row_changes", { changes: [{ table: "loaves", id: 2, values: { price: 7 } }] })]);
  assert.deepEqual(p.seen, ["needs"]);
  assert.equal(p.wrote.length, 1);
  assert.deepEqual((await run([tool("write_row_changes", { changes: [] })])).seen, ["scope"]);
  assert.deepEqual((await run([boom()])).seen, []);
  assert.deepEqual((await run([tool("write_row_changes", { changes: [] })], null)).seen, []);
});
