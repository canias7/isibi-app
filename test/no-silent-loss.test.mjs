// NO SILENT LOSS IN REQUIREMENTS, WARNINGS AND THEIR LISTS (2026-10-07).
//
// The owner: *"address the documented requirements cut off after twelve,
// warning lists cut off at three or four, truncated affected-page lists,
// refused seed rows identified by the wrong index, and tables whose skipped
// starter rows or missing filling mechanism are not explained; distinguish
// real processing limits from presentation limits, preserve the complete
// record … and ask a model-written clarification or explicitly explain a
// genuine capacity limit instead of silently dropping work."*
//
//   LIMIT    a step keeps twelve requirements (a real bound: each is judged,
//            and the judgment's answer is capped); the designer is told so and
//            to ask which part comes first rather than leave any out; any past
//            the twelfth anyway are kept by name, told as not checked, a fact
//            each, and leave the request's part done in part.
//   BRIEF / RECORD   no cut in a step's brief or the developer record.
//   SEED     the engine says every starter row it did not put in, each by its
//            place in the design; a table whose every row was refused is never
//            told as some having gone in; a table nothing filled is explained
//            from what the engine really put in.
//   PROBLEMS / NAMES / SUGGEST   every lint problem about what went out, every
//            page and component a note is about, every suggestion offered.
//   NOTDONE  an addition's part reads its own report.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer here is supplied.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addon, writtenPage, storedAnswer } from "./fixtures/addon-route.mjs";
import { cleanRequirements, requirementReport, requirementRecord, requirementBrief, toldNote, cleanSuggestions, MAX_REQUIREMENTS, MAX_SUGGESTIONS } from "../builder/site-requirements.mjs";
import { addTool, warningReport, seedSkipNote } from "../builder/site-add.mjs";
import { addonReplyFacts } from "../builder/site-reply.mjs";
import { notDoneOf, editJobOutcome } from "../builder/request.mjs";
import { problemsShipped, keptReply, keptPartsNote, unseenPartsNote, unseenPagesNote, takePagesAway } from "../builder/site-addon.mjs";
import { seedSiteRows, MAX_SEED_ROWS } from "../site-schema.mjs";
import { browserReply } from "../scripts/addon-sweep.mjs";

const facts = (body) => (addonReplyFacts(body).facts || []).map((f) => f.kind + ": " + f.text);
const screen = (body) => { const b = browserReply(body, true); assert.ok(b.ok, "the browser's composer could not run: " + b.why); return b.text; };
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const nums = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

test("LIMIT 1 — A STEP'S REQUIREMENTS PAST WHAT IT KEEPS TRACK OF: kept by name with the step that wrote them, told one by one as not checked and why, a fact each and in the note, and on the request's part as not done — never set aside in silence", () => {
  const raw = nums(1, MAX_REQUIREMENTS + 3).map((n) => ({ need: "Need number " + n, status: "covered", basis: "asked", words: "w" }));
  const c = cleanRequirements(raw, "page");
  assert.equal(c.list.length, MAX_REQUIREMENTS);
  assert.deepEqual(c.skipped.map((s) => [s.need, s.why, s.from]), nums(13, 15).map((n) => ["Need number " + n, "over-cap", "page"]));
  const rep = requirementReport([], { skipped: c.skipped, judged: true });
  assert.deepEqual(rep.told.map((o) => [o.need, o.told, o.state]), nums(13, 15).map((n) => ["Need number " + n, "not-tracked", "over-cap"]));
  assert.ok(rep.told.every((o) => o.why === "one step of a change keeps track of at most " + MAX_REQUIREMENTS + " requirements"), JSON.stringify(rep.told));
  // ONLY WHAT WAS PAST THE LIMIT: an entry that could not be read is the record's alone.
  assert.deepEqual(requirementReport([], { skipped: [{ need: "", why: "no-need" }, { need: "A bad status", why: "bad-status" }], judged: true }).told, []);
  const note = toldNote(rep.told);
  for (const n of nums(13, 15)) assert.match(note, new RegExp("Need number " + n + "\\b"), note);
  const body = { ok: true, changed: ["src/routes/index.tsx"], requirementsTold: rep.told, coverNote: note };
  const f = facts(body);
  for (const n of nums(13, 15)) {
    assert.equal(f.filter((t) => t === "not-done: Not checked in this change, because one step of a change keeps track of at most " + MAX_REQUIREMENTS + " requirements: Need number " + n + ". They can ask for it on its own.").length, 1, n + ": " + JSON.stringify(f));
  }
  assert.deepEqual(notDoneOf(body, "addon").map((x) => [x.what, x.why]), nums(13, 15).map((n) => ["Need number " + n, "not-tracked"]));
});

test("LIMIT 2 — THROUGH THE ROUTE: a designer that wrote down fourteen requirements has twelve judged and the two past the limit told on the answer, in the note, as facts and on the screen, and kept by name with its step in the developer record", async () => {
  const MSG = "Add a gallery page for our bakes";
  const needs = nums(1, 14).map((n) => "The gallery does thing " + n);
  const r = await addon("nsl-limit", MSG, {
    kinds: ["page"], publishes: true, written: [writtenPage("/gallery")],
    answers: { page: { page: [PAGE("/gallery", "Gallery")], requirements: needs.map((need) => ({ need, status: "covered", by: "the gallery page", item: "/gallery", kind: "page", basis: "asked", words: MSG })) } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  const untracked = (r.body.requirementsTold || []).filter((o) => o.told === "not-tracked").map((o) => o.need);
  assert.deepEqual(untracked, needs.slice(12), JSON.stringify(r.body.requirementsTold));
  for (const n of needs.slice(12)) {
    assert.ok(r.body.coverNote.includes(n), "the note lost " + n + ": " + r.body.coverNote);
    assert.ok(facts(r.body).some((t) => t.startsWith("not-done: Not checked in this change") && t.includes(n)), n);
    assert.ok(screen(r.body).includes(n), "the screen lost " + n);
  }
  const rec = storedAnswer(r, "nsl-limit");
  assert.ok(rec && rec.coverage, "no developer record");
  assert.equal(rec.coverage.requirements.length, MAX_REQUIREMENTS, "the judged list is not the twelve kept");
  assert.deepEqual(rec.coverage.unreadable.map((s) => [s.need, s.why, s.from]), needs.slice(12).map((n) => [n, "over-cap", "page"]));
});

test("WIRE 4 — THROUGH THE ROUTE, EVERY LIST ON THE ANSWER AND IN THE RECORD PAST ITS OLD CUT: sixteen open requirements from two steps, fourteen pages the window could not carry, eight starter rows not put in, five problems about pages that went out, and two suggestions past a designer's limit", async () => {
  const MSG = "Keep a list of breads and add five pages about them";
  const open = (step) => nums(1, 8).map((n) => ({ need: step + " need " + n, status: "unsupported", why: "this kind of change cannot do that yet" }));
  const five = ["/a", "/b", "/c", "/d", "/e"];
  // TWENTY-SIX STORED PAGES OF 7,000 CHARACTERS: twelve fit the 90,000 the
  // designer is shown, and fourteen do not.
  const stored = nums(1, 26).map((n) => ({ path: "src/routes/old" + n + ".tsx", source: "export const x" + n + " = `" + "w".repeat(7000) + "`\n" }));
  const r = await addon("nsl-wire4", MSG, {
    kinds: ["table", "page"], publishes: true, storedPages: stored,
    // WRITTEN WITH NO `head`, so the lint says so once for each: five problems.
    written: five.map(writtenPage),
    answers: {
      table: {
        table: [{ table: { name: "breads", access: "display", columns: [{ name: "name", type: "text" }] }, seed: nums(1, 8).map((n) => ({ nope: n })) }],
        requirements: open("table"),
        suggestions: ["Idea one", "Idea two", "Idea three", "Idea four", "Idea five"],
      },
      page: { page: five.map((p) => PAGE(p, "Page " + p.slice(1))), requirements: open("page") },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  assert.deepEqual((r.body.requirements || []).map((q) => q.need).sort(), [...open("table"), ...open("page")].map((q) => q.need).sort(), "the wire's open requirements were cut");
  assert.equal((r.body.unseenPages || []).length, 14, "the pages the window could not carry were cut: " + JSON.stringify(r.body.unseenPages));
  assert.deepEqual(r.body.seedSkipped, nums(1, 8).map((n) => "breads row " + n + ": names none of its columns"), "the starter rows not put in were cut");
  const lint = (r.body.problems || []).filter((q) => /has no `head` on its route/.test(q));
  assert.equal(lint.length, 5, "the problems about pages that went out were cut: " + JSON.stringify(r.body.problems));
  const rec = storedAnswer(r, "nsl-wire4");
  assert.ok(rec && rec.coverage, "no developer record");
  assert.deepEqual(rec.coverage.suggestionsOver, ["Idea four", "Idea five"], "the suggestions past the designer's limit were not kept for the record");
});

test("TOOL 1 — THE DESIGNER IS TOLD THE LIMIT, AND TO ASK WHICH PART COMES FIRST RATHER THAN LEAVE ANY OUT: the schema still carries the limit, and the question it would ask with is on the same tool", () => {
  for (const kind of ["page", "table"]) {
    const t = addTool(kind);
    const req = t.input_schema.properties.requirements;
    assert.equal(req.maxItems, MAX_REQUIREMENTS, kind);
    assert.ok(req.description.includes("At most " + MAX_REQUIREMENTS + ": when what they asked for needs more than that, leave none of it out — ask them, as your question, which part to do first."), kind + ": " + req.description);
    assert.ok(Object.hasOwn(t.input_schema.properties, "question"), kind + ": no question to ask with");
  }
});

test("BRIEF 1 — EVERY REQUIREMENT HANDED TO A STEP IS IN ITS BRIEF: fifteen handed to the page step, from two steps of twelve or fewer each, all fifteen printed — none is marked handed to a step that never heard it", () => {
  const list = nums(1, 15).map((n, i) => ({ need: "Handed need " + n, status: "elsewhere", step: "page", from: i < 12 ? "table" : "function", id: (i < 12 ? "table#" + i : "function#" + (i - 12)) }));
  const brief = requirementBrief(list, "page");
  for (const n of nums(1, 15)) assert.match(brief, new RegExp("\\] Handed need " + n + "$", "m"), "missing " + n);
});

test("RECORD 2 — THE DEVELOPER RECORD KEEPS EVERY LIST WHOLE: twenty requirements, fifteen set aside, fifteen missing pages, thirty applied items, fourteen suggestions, and the suggestions past a designer's limit", () => {
  const list = nums(1, 20).map((n) => ({ need: "R" + n, status: "unsupported", why: "x", from: "table", id: "table#" + n }));
  const rec = requirementRecord({
    list, skipped: nums(1, 15).map((n) => ({ need: "S" + n, why: "over-cap", from: "page" })),
    missingPages: nums(1, 15).map((n) => "/p" + n), made: nums(1, 30).map((n) => ({ kind: "table", name: "t" + n })),
    suggestions: nums(1, 14).map((n) => "idea " + n), suggestionsOver: ["extra one", "extra two"],
    invalid: nums(1, 14).map((n) => "prop" + n), unseenPages: nums(1, 13).map((n) => "src/routes/u" + n + ".tsx"),
  });
  assert.equal(rec.requirements.length, 20);
  assert.equal(rec.unreadable.length, 15);
  assert.equal(rec.missingPages.length, 15);
  assert.equal(rec.applied.length, 30);
  assert.equal(rec.suggestions.length, 14);
  assert.deepEqual(rec.suggestionsOver, ["extra one", "extra two"]);
  assert.equal(rec.invalidProps.length, 14);
  assert.equal(rec.unseenPages.length, 13);
});

// ── STARTER ROWS ─────────────────────────────────────────────────────────────

const BREADS = { tables: [{ name: "breads", access: "display", columns: [{ name: "name", type: "text" }, { name: "price", type: "integer" }] }] };
const seedDeps = () => ({
  sqlQuery: async (uuid, q, params) => {
    if (/^SELECT 1 AS x FROM/.test(q)) return [];
    if (/^INSERT/.test(q) && (params || []).includes("bad")) throw new Error("invalid input");
    return [];
  },
});

test("SEED 1 — THE ENGINE SAYS EVERY STARTER ROW IT DID NOT PUT IN: rows past the limit by count, a refused row by its place in the design (never by how many went in before it), a row naming none of the table's columns, and a table whose every row was refused as none in", async () => {
  const rows = [{ name: "a" }, { name: "bad" }, "junk", { nope: 1 }, { name: "b" }, { name: "bad" }, ...nums(1, MAX_SEED_ROWS).map((n) => ({ name: "extra" + n }))];
  const out = await seedSiteRows("u", BREADS, { breads: rows }, seedDeps());
  assert.deepEqual(out.skipped, [
    "breads: 6 starter rows past the first " + MAX_SEED_ROWS + " were not put in",
    "breads row 2: invalid input",
    "breads row 3: names none of its columns",
    "breads row 4: names none of its columns",
    "breads row 6: invalid input",
  ]);
  assert.deepEqual(out.seeded, { breads: 8 });
  const none = await seedSiteRows("u", BREADS, { breads: [{ name: "bad" }, { name: "bad" }] }, seedDeps());
  assert.deepEqual(none.skipped, ["breads row 1: invalid input", "breads row 2: invalid input", "breads: none of its 2 starter rows went in"]);
  assert.deepEqual(none.seeded, {});
  // CONTROLS: every row in says nothing; one row past the limit is one.
  const all = await seedSiteRows("u", BREADS, { breads: [{ name: "a" }, { name: "b" }] }, seedDeps());
  assert.deepEqual([all.skipped, all.seeded], [[], { breads: 2 }]);
  const one = await seedSiteRows("u", BREADS, { breads: nums(1, MAX_SEED_ROWS + 1).map((n) => ({ name: "r" + n })) }, seedDeps());
  assert.deepEqual(one.skipped, ["breads: 1 starter row past the first " + MAX_SEED_ROWS + " was not put in"]);
});

test("SEED 2 — EACH REASON ABOUT A TABLE'S ROWS IS TOLD BESIDE THE OTHERS: past the limit, refused, naming no column — a table skipped whole keeps its first reason, and every row refused is told as none in, never as some", () => {
  const skipped = [
    "breads: 6 starter rows past the first 12 were not put in", "breads row 2: invalid input", "breads row 3: names none of its columns", "breads row 6: invalid input",
    "pies row 1: invalid input", "pies: none of its 1 starter row went in",
    "orders: only display tables are seeded (collect)", "orders: already has rows",
  ];
  const w = warningReport({ seedSkips: skipped });
  assert.deepEqual(w.map((x) => [x.name, x.why]), [["breads", "over-cap"], ["breads", "row-failed"], ["breads", "row-unusable"], ["pies", "none-went-in"], ["orders", "not-display"]]);
  const note = seedSkipNote(skipped);
  // PAST THE LIMIT PROVES NOTHING WENT IN (2026-10-07, Codex's review): those rows were not tried, and nothing more is claimed.
  assert.match(note, /breads[^.]*(?:weren't|were not) tried/, note);
  assert.doesNotMatch(note, /only the first|I put in only/i);
  assert.match(note, /Not all of the starter rows I had ready for breads went in\./);
  assert.match(note, /Some starter rows I had ready for breads named none of its columns, so they weren't put in\./);
  assert.match(note, /None of the starter rows I had ready for pies went in\./);
  assert.doesNotMatch(note, /Not all of the starter rows I had ready for (?:[^.]*\b)?pies\b/, "every row refused was told as some going in");
  const f = facts({ ok: true, changed: ["src/routes/index.tsx"], warningsTold: w, coverNote: note });
  const over = f.filter((t) => t.startsWith("not-done: ") && /\bbreads\b/.test(t) && /not tried/.test(t));
  assert.equal(over.length, 1, JSON.stringify(f));
  assert.ok(!/went in/.test(over[0]), "rows past the limit were told as rows going in: " + over[0]);
  assert.ok(!f.some((t) => /only the first/i.test(t)), JSON.stringify(f));
  assert.ok(f.includes("not-done: Some starter rows for the table breads were not put in: they named none of its columns."), JSON.stringify(f));
  assert.ok(f.includes("not-done: None of the starter rows for the table pies went in: the database refused every one."), JSON.stringify(f));
});

test("FILL 1 — A TABLE THIS CHANGE READS WHOSE EVERY STARTER ROW WAS REFUSED IS EXPLAINED: what nothing can fill is read from what the engine really put in, so it is told beside the refused rows — the design's own seed used to count it as filled", async () => {
  const r = await addon("nsl-fill", "keep a menu of breads and count them", {
    kinds: ["table", "function", "page"], publishes: true, written: [writtenPage("/menu")],
    rowFail: /^menu$/,
    answers: {
      table: { table: [{ table: { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }] }, seed: [{ dish: "Rye" }, { dish: "Spelt" }] }] },
      function: { function: [{ name: "menu_count", internal: true, returns: "bigint", body: "SELECT COUNT(*) FROM menu" }] },
      page: { page: [PAGE("/menu", "Menu")] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  assert.ok((r.body.seedSkips || []).includes("menu: none of its 2 starter rows went in"), JSON.stringify(r.body.seedSkips));
  assert.deepEqual(r.body.noPopulation, ["menu"], "the table every starter row of which was refused is not told as one nothing fills");
  // EVERY ROW BY ITS PLACE, FROM THE ENGINE'S ONE RECORD (2026-10-07): both refused, none in — one entry, never "none" beside "some".
  assert.deepEqual(r.body.warningsTold, [{ what: "seed", name: "menu", why: "rows", rows: { designed: 2, cap: 12, inserted: [], refused: [1, 2], unusable: [], unattempted: 0 } }, { what: "fill", name: "menu" }]);
  assert.deepEqual(r.body.seedRows, { menu: { designed: 2, cap: 12, inserted: [], refused: [1, 2], unusable: [], unattempted: 0 } });
  // CONTROL: the rows went in, so nothing is said about filling it.
  const ok = await addon("nsl-fill-ok", "keep a menu of breads and count them", {
    kinds: ["table", "function", "page"], publishes: true, written: [writtenPage("/menu")],
    answers: {
      table: { table: [{ table: { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }] }, seed: [{ dish: "Rye" }, { dish: "Spelt" }] }] },
      function: { function: [{ name: "menu_count", internal: true, returns: "bigint", body: "SELECT COUNT(*) FROM menu" }] },
      page: { page: [PAGE("/menu", "Menu")] },
    },
  });
  assert.equal(ok.body.ok, true, JSON.stringify(ok.body).slice(0, 400));
  assert.equal(ok.body.noPopulation, undefined, JSON.stringify(ok.body.noPopulation));
});

// ── PROBLEMS, NAMES, SUGGESTIONS ─────────────────────────────────────────────

test("PROBLEMS 1 — EVERY LINT PROBLEM ABOUT WHAT WENT OUT IS KEPT, past the old four; one about a page this change wrote that did not go out is dropped; one it cannot place is kept", () => {
  const pages = ["a", "b", "c", "d", "e"].map((n) => "src/routes/" + n + ".tsx");
  const problems = [...pages.map((p, i) => p + ": problem " + (i + 1)), "src/routes/held.tsx: about a page held back", "a component's own finding"];
  const out = problemsShipped(problems, [...pages, "src/routes/held.tsx"], pages);
  assert.deepEqual(out, problems.filter((q) => !q.startsWith("src/routes/held.tsx")));
  // A PAGE THIS CHANGE DID NOT WRITE cannot have been held back by it: kept.
  assert.deepEqual(problemsShipped(["src/routes/old.tsx: x"], pages, pages), ["src/routes/old.tsx: x"]);
  assert.deepEqual(problemsShipped(["", 3, null], pages, pages), []);
  // AND THE SCREEN, with no model reply, prints every one (it printed three).
  const shown = screen({ ok: true, changed: pages, problems: out });
  for (const q of out) assert.ok(shown.includes(q), "the screen lost " + q);
});

test("PROBLEMS 2 — EVERY REMOVAL REFUSED AND NOTHING ELSE TO DO: the refusal carries the pages kept and its own sentence — the generic stop said neither", async () => {
  // THE WRITER RETURNS NO PAGE AND TAKES AWAY ONLY THE HOME PAGE, which is
  // never removable: nothing was added, changed or removed.
  const r = await addon("nsl-kept", "add a news page and take the home page away", {
    kinds: ["page"], publishes: true, written: [], removes: ["index.tsx"],
    answers: { page: { page: [PAGE("/news", "News")] } },
  });
  assert.deepEqual([r.body.ok, r.body.error], [false, "kept"], JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual(r.body.kept, [{ path: "index.tsx", why: "home" }]);
  assert.match(r.body.msg, /I left \/ — that is the home page/);
});

test("WIRE 3 — THE EDIT'S PAGE STEP SENDS EVERY PROBLEM AND EVERY PAGE IT LEFT ALONE OR REORDERED, AND A MESSAGE OF SEVERAL STEPS SENDS EVERY STEP'S PROBLEMS. Read from the source: the page step's answers are built in one route", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok((W.match(/\bpProblems\b/g) || []).length >= 6, "the page step's problems are gone — this case reads nothing");
  assert.doesNotMatch(W, /pProblems\.slice\(/, "the page step cuts its problems again");
  assert.ok(W.includes("ignored: (pValid.pages || []).filter((p) => p.path !== target.path).map((p) => p.path),"), "the pages left alone are cut");
  assert.ok(W.includes("reordered: alsoOn.length ? alsoOn : undefined,"), "the pages reordered are cut");
  assert.ok(W.includes('problems: flat("problems").length ? [...new Set(flat("problems"))] : undefined,'), "a message of several steps keeps only the first step's problems");
});

test("NAMES 1 — EVERY PAGE AND COMPONENT A NOTE IS ABOUT IS NAMED: five components kept or unseen, five pages the window could not carry, five removals kept, and a page linked from six others names all six", () => {
  const names = ["one", "two", "three", "four", "five"];
  for (const n of names) {
    assert.ok(keptPartsNote(names).includes(n), "kept components lost " + n);
    assert.ok(unseenPartsNote(names).includes(n), "unseen components lost " + n);
  }
  const paths = names.map((n) => "src/routes/" + n + ".tsx");
  for (const n of names) assert.ok(unseenPagesNote(paths).includes("/" + n), "unseen pages lost " + n);
  const kept = paths.map((path) => ({ path, why: "linked", from: ["src/routes/index.tsx"] }));
  for (const n of names) assert.ok(keptReply(kept).includes("I left /" + n), "kept removals lost " + n);
  const linkers = nums(1, 6).map((n) => ({ path: "src/routes/l" + n + ".tsx", source: '<a href="/gone">gone</a>' }));
  const byPath = new Map([["src/routes/gone.tsx", { path: "src/routes/gone.tsx", source: "x" }], ...linkers.map((l) => [l.path, l])]);
  const { kept: k } = takePagesAway(byPath, ["src/routes/gone.tsx"], []);
  assert.deepEqual(k[0].from, linkers.map((l) => l.path), "the pages that link to it were cut");
  assert.ok(keptReply(k).includes("/l6"), "the sentence lost the sixth linking page");
});

test("SUGGEST 1 — A DESIGNER'S SUGGESTIONS PAST ITS LIMIT ARE KEPT FOR THE RECORD, NEVER OFFERED; every suggestion offered, from every designer, reaches the reply's facts and the screen", () => {
  const over = [];
  assert.deepEqual(cleanSuggestions(["Idea a", "Idea b", "Idea c", "Idea d", "Idea e", "idea A"], over), ["Idea a", "Idea b", "Idea c"]);
  assert.equal(MAX_SUGGESTIONS, 3);
  assert.deepEqual(over, ["Idea d", "Idea e"], "a fourth suggestion vanished");
  const body = { ok: true, changed: ["src/routes/index.tsx"], suggestions: nums(1, 5).map((n) => "Idea number " + n) };
  const f = facts(body).find((t) => t.startsWith("note: Something they did not ask for"));
  assert.ok(f, JSON.stringify(facts(body)));
  for (const s of body.suggestions) assert.ok(f.includes(s), "the reply's fact lost " + s);
  const shown = screen(body);
  for (const s of body.suggestions) assert.ok(shown.includes(s), "the screen lost " + s);
});

test("NOTDONE 1 — AN ADDITION'S PART READS ITS OWN REPORT: requirements not done and work kept out make it done in part; what is set up, already there or unseen, starter rows and empty tables do not, and a missing page is said once", () => {
  const body = {
    ok: true, changed: ["src/routes/index.tsx"], missingPages: ["/gallery"],
    requirementsTold: [
      { need: "A", told: "still-to-do", state: "missing" }, { need: "B", told: "unsupported", state: "failed", why: "x" },
      { need: "C", told: "blocked", state: "blocked" }, { need: "D", told: "not-tracked", state: "over-cap" },
      { need: "E", told: "set-up", state: "unverified" }, { need: "F", told: "already-there", state: "configured" }, { need: "G", told: "unseen", state: "unknown" },
    ],
    warningsTold: [
      { what: "qr", name: "menu-code" }, { what: "held-page", name: "/posters", added: true }, { what: "held-section", name: "hero", added: false },
      { what: "page", name: "/gallery" }, { what: "seed", name: "breads", why: "none-went-in" }, { what: "fill", name: "stock" },
    ],
  };
  assert.deepEqual(notDoneOf(body, "addon").map((x) => [x.what, x.why]), [
    ["/gallery", "missing"], ["A", "still-to-do"], ["B", "unsupported"], ["C", "blocked"], ["D", "not-tracked"],
    ["menu-code", "qr"], ["/posters", "held-page"], ["hero", "held-section"],
  ]);
  const row = (b) => ({ state: "done", result: { status: 200, body: JSON.stringify(b) } });
  assert.equal(editJobOutcome(row(body), "addon"), "partial");
  const clean = { ok: true, changed: ["src/routes/index.tsx"], requirementsTold: [{ need: "E", told: "set-up", state: "unverified" }], warningsTold: [{ what: "seed", name: "breads", why: "has-rows" }, { what: "fill", name: "stock" }] };
  assert.deepEqual(notDoneOf(clean, "addon"), []);
  assert.equal(editJobOutcome(row(clean), "addon"), "done");
});
