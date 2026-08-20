import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  sortSlots, applySort, sortDigest, sortColumns, sortReply, sortRefusal, SORT_DIRS, MAX_SORT_SLOTS,
} from "../builder/site-order.mjs";
import { DATA_TOOL, readSortChange, dataRequest, runDataEdit } from "../builder/site-apply.mjs";
import { GENERATED_DIR } from "./fixtures/generated.mjs";

const page = (p, body) => ({ path: p, source: `export default function P() {\n  ${body}\n  return null;\n}\n` });
const TABLES = [
  { name: "dishes", columns: ["name", "price", "category"], rows: [{ id: 1, name: "Fade" }] },
  { name: "hours", columns: ["day", "opens"], rows: [{ id: 1, day: "Monday" }] },
];

// ── FINDING EVERY LIST ──────────────────────────────────────────────────────

test("sortSlots reads a literal options object", () => {
  const s = sortSlots([page("index.tsx", `const d = useRows<Dish>("dishes", { order: "name", dir: "asc" });`)]);
  assert.equal(s.length, 1);
  assert.equal(s[0].table, "dishes");
  assert.equal(s[0].order, "name");
  assert.equal(s[0].dir, "asc");
  assert.equal(s[0].hook, "useRows");
});

test("a call with NO options is found, with somewhere to put them", () => {
  // Three different actions — none, a literal, and one we cannot read — and
  // collapsing any two of them is a bug.
  const s = sortSlots([page("index.tsx", `const d = useRows<Deal>("deals");`)]);
  assert.equal(s[0].order, "");
  assert.ok(s[0].insertAt > 0);
  assert.ok(!s[0].computed);
});

test("A COMPUTED OPTIONS OBJECT IS REFUSED, NEVER REWRITTEN", () => {
  // The reference page writes exactly this, and a rewrite there either drops
  // the filter or produces something that does not compile.
  const s = sortSlots([page("book.tsx", `const a = usePublicRows<{ time: string }>("appointments", date ? { date } : undefined);`)]);
  assert.equal(s.length, 1);
  assert.equal(s[0].computed, true);
  assert.equal(s[0].optsAt, undefined, "a refused slot offers no write point");
});

test("a generic holding braces does not defeat the scan", () => {
  // `usePublicRows<{ slot_date: string; slot_time: string }>(` is committed
  // generator output: the `>` closing the generic is not the first one.
  const s = sortSlots([page("book.tsx", `const a = usePublicRows<{ slot_date: string; slot_time: string }>("bookings", { order: "slot_date" });`)]);
  assert.equal(s.length, 1);
  assert.equal(s[0].table, "bookings");
  assert.equal(s[0].hook, "usePublicRows");
  assert.equal(s[0].order, "slot_date");
});

test("A COMPUTED `order` INSIDE A LITERAL OBJECT IS REFUSED TOO", () => {
  // The object is readable and the property is not — overwriting a span that
  // is not a string literal is what breaks a build.
  const s = sortSlots([page("index.tsx", `const d = useRows("dishes", { order: col, dir: "asc" });`)]);
  assert.equal(s[0].computed, true);
});

test("A LIST QUOTED IN A COMMENT IS NOT A LIST", () => {
  // The template's own prose quotes `useRows(...)` while explaining the API,
  // and blanking must preserve length or every offset after it shifts.
  const src = page("index.tsx", `// like useRows("ghosts", { order: "id" })\n  const d = useRows("dishes", { order: "name" });`);
  const s = sortSlots([src]);
  assert.deepEqual(s.map((x) => x.table), ["dishes"]);
  assert.equal(src.source.slice(s[0].orderSpan.at, s[0].orderSpan.to), "name");
});

test("a page with no source or no path is skipped rather than throwing", () => {
  assert.deepEqual(sortSlots([null, { path: "a.tsx" }, { source: `useRows("x")` }]), []);
  assert.deepEqual(sortSlots(null), []);
  assert.deepEqual(sortSlots(undefined), []);
});

test("a nested object does not confuse which `order` is the call's own", () => {
  const s = sortSlots([page("index.tsx", `const d = useRows("dishes", { filter: { order: "wrong" }, order: "right" });`)]);
  assert.equal(s[0].order, "right");
});

// ── REWRITING IT ────────────────────────────────────────────────────────────

test("SITE-WIDE IS THE POINT — one table read on two pages moves together", () => {
  // The `page` layer edits ONE page, so a table read on the home page and the
  // menu page comes out in two different orders. That is the failure
  // `orderingMoved` can report and cannot fix.
  const pages = [
    page("index.tsx", `const d = useRows("dishes", { order: "name", dir: "asc" });`),
    page("menu.tsx", `const d = useRows("dishes", { order: "name", dir: "asc" });`),
  ];
  const out = applySort(pages, "dishes", "price", "asc");
  assert.deepEqual(out.changed, ["index.tsx", "menu.tsx"]);
  assert.equal(out.moved, 2);
  for (const s of sortSlots(out.pages)) assert.equal(s.order, "price");
});

test("a call with no options gets them inserted", () => {
  const out = applySort([page("index.tsx", `const d = useRows<Deal>("deals");`)], "deals", "created_at", "desc");
  assert.match(out.pages[0].source, /useRows<Deal>\("deals", \{ order: "created_at", dir: "desc" \}\)/);
});

test("A FILTER IN THE OBJECT SURVIVES THE REWRITE", () => {
  // The object holds things that are not ours — `{ date }` is a filter — so it
  // is edited in place rather than rebuilt from the two properties this cares
  // about. Rebuilding drops the filter and the page fetches the wrong rows.
  const out = applySort([page("x.tsx", `const r = useRows("bookings", { date, limit: 20, order: "id", dir: "desc" });`)], "bookings", "slot", "asc");
  assert.match(out.pages[0].source, /date, limit: 20, order: "slot", dir: "asc"/);
});

test("an options object with NEITHER property gets both inserted", () => {
  const out = applySort([page("y.tsx", `const r = useRows("bookings", { date });`)], "bookings", "slot", "desc");
  assert.equal(out.moved, 1);
  const s = sortSlots(out.pages)[0];
  assert.equal(s.order, "slot");
  assert.equal(s.dir, "desc");
  assert.match(out.pages[0].source, /date/, "the filter survives");
});

test("two lists in one file are both written, and the offsets stay right", () => {
  // BACK TO FRONT, like every other structural editor here: each write changes
  // the length of the source. The first is rewritten to a LONGER column name
  // deliberately, so a forward pass lands the second write in the wrong place.
  const src = page("index.tsx",
    `const a = useRows("dishes", { order: "id", dir: "asc" });\n  const b = useRows("dishes", { order: "id", dir: "asc" });`);
  const out = applySort([src], "dishes", "a_much_longer_column", "desc");
  assert.equal(out.moved, 2);
  for (const s of sortSlots(out.pages)) {
    assert.equal(s.order, "a_much_longer_column");
    assert.equal(s.dir, "desc");
  }
});

test("a list already in that order is not a change", () => {
  // Republishing to write back the bytes already there costs a container run
  // and archives a version describing a change that did not happen.
  const out = applySort([page("index.tsx", `const d = useRows("dishes", { order: "name", dir: "asc" });`)], "dishes", "name", "asc");
  assert.equal(out.moved, 0);
  assert.deepEqual(out.changed, []);
});

test("a missing direction is treated as ascending, on both sides of the comparison", () => {
  const out = applySort([page("index.tsx", `const d = useRows("dishes", { order: "name" });`)], "dishes", "name", "asc");
  assert.equal(out.moved, 0, "no dir written and asc asked for is already true");
});

test("an unknown direction falls back to ascending rather than being written raw", () => {
  const out = applySort([page("index.tsx", `const d = useRows("dishes", { order: "name", dir: "asc" });`)], "dishes", "price", "sideways");
  assert.equal(sortSlots(out.pages)[0].dir, "asc");
});

test("a computed call is refused and named, and other pages still move", () => {
  const pages = [
    page("index.tsx", `const d = useRows("dishes", { order: "name" });`),
    page("book.tsx", `const d = usePublicRows("dishes", date ? { date } : undefined);`),
  ];
  const out = applySort(pages, "dishes", "price", "asc");
  assert.deepEqual(out.changed, ["index.tsx"]);
  assert.deepEqual(out.refused, [{ page: "book.tsx", why: "computed" }]);
});

test("a table nobody reads, an empty column and no pages all change nothing", () => {
  const pages = [page("index.tsx", `const d = useRows("dishes", { order: "name" });`)];
  assert.deepEqual(applySort(pages, "ghosts", "id", "asc").changed, []);
  assert.deepEqual(applySort(pages, "dishes", "", "asc").changed, []);
  assert.deepEqual(applySort(pages, "", "id", "asc").changed, []);
  assert.deepEqual(applySort(null, "dishes", "id", "asc").changed, []);
});

// ── WHAT MAY BE SORTED BY ───────────────────────────────────────────────────

test("A COLUMN THE TABLE DOES NOT HAVE IS REFUSED, and this is the important one", () => {
  // PostgREST answers a sort by an unknown column with a 400, `useRows` turns
  // that into the list's error state, and the owner is left with an EMPTY list
  // on every page reading it — worse than the order they disliked, and silent.
  const r = readSortChange(reply({ table: "dishes", column: "invented" }), TABLES);
  assert.equal(r.refused, "no-such-column");
  // A REFUSAL AND NOT SILENCE, and the difference is what the owner can do
  // next. Returning null sent this to "I couldn't match that to anything the
  // site stores", which is wrong — the list is right there — and unactionable.
  assert.equal(r.dir, undefined, "a refusal carries no direction to apply");
});

test("the refusal names what the list DOES have", () => {
  const said = sortRefusal(readSortChange(reply({ table: "dishes", column: "spiciness" }), TABLES));
  assert.match(said, /dishes has nothing called spiciness\./);
  assert.match(said, /It has name, price, category — say which of those to order by\./);
  // `id` and `created_at` are accepted and NOT offered: they are the
  // platform's own, and reading them back to a café owner is noise.
  assert.doesNotMatch(said, /created_at/);
});

test("a table with nothing but platform columns refuses without an empty offer", () => {
  const said = sortRefusal({ table: "t", column: "x", columns: ["id", "created_at"] });
  assert.match(said, /t has nothing called x\./);
  assert.doesNotMatch(said, /It has/);
  assert.equal(sortRefusal({}), " has nothing called .", "a bare call does not throw");
});

test("A REFUSED COLUMN NEVER REACHES applySort", () => {
  // It is the one shape that would rewrite a page into a sort the data API
  // answers with a 400, emptying the list on every page that reads it.
  return runDataEdit({ send: async () => dataReply({ changes: [], order: { table: "dishes", column: "spiciness" } }), apply: async () => true }, {
    instruction: "x", tables: TABLES,
    pages: [page("i.tsx", `const d = useRows("dishes", { order: "name" });`)],
  }).then((out) => {
    assert.equal(out.ok, false);
    assert.equal(out.reason, "no-change");
    assert.equal(out.sortPages, undefined, "nothing was rewritten");
    assert.match(out.msg, /dishes has nothing called spiciness/);
  });
});

test("A LIST NO PAGE READS IS NOT 'ALREADY IN THAT ORDER'", () => {
  // That sentence is a lie about a table nothing shows, and the truth is a fact
  // the owner can act on: the rows exist and no page displays them.
  return runDataEdit({ send: async () => dataReply({ changes: [], order: { table: "hours", column: "day" } }), apply: async () => true }, {
    instruction: "x", tables: TABLES,
    pages: [page("i.tsx", `const d = useRows("dishes", { order: "name" });`)],
  }).then((out) => {
    assert.equal(out.reason, "no-change");
    assert.match(out.msg, /Nothing on the site shows hours yet/);
    assert.doesNotMatch(out.msg, /already comes out/);
  });
});

test("`id` and `created_at` are always allowed, because newest-first is the ask", () => {
  // The schema engine stamps both on every table and neither is in the declared
  // column list, so without them "put the newest at the top" is refused.
  assert.deepEqual(sortColumns(TABLES, "dishes"), ["name", "price", "category", "id", "created_at"]);
  assert.ok(readSortChange(reply({ table: "dishes", column: "created_at", dir: "desc" }), TABLES));
});

test("an unknown table has no column list rather than an empty one", () => {
  // An empty list reads as "this table has no columns", which would refuse
  // every sort on it; null is "we do not know", which the caller refuses on.
  assert.equal(sortColumns(TABLES, "ghosts"), null);
});

test("a non-string table or column is refused rather than coerced", () => {
  // `String(["a","b"])` is "a,b" — the coercion bug this repo has recorded on
  // `normalizeRole` and on a table's `access`.
  assert.equal(readSortChange(reply({ table: ["dishes"], column: "name" }), TABLES), null);
  assert.equal(readSortChange(reply({ table: "dishes", column: ["name"] }), TABLES), null);
});

test("an absent or malformed order field is simply no order change", () => {
  assert.equal(readSortChange({ content: [{ type: "tool_use", input: {} }] }, TABLES), null);
  assert.equal(readSortChange(reply(null), TABLES), null);
  assert.equal(readSortChange(reply(["dishes"]), TABLES), null);
  assert.equal(readSortChange({ content: [] }, TABLES), null);
  assert.equal(readSortChange(null, TABLES), null);
});

test("an unknown direction is normalised, never passed through", () => {
  assert.equal(readSortChange(reply({ table: "dishes", column: "name", dir: "sideways" }), TABLES).dir, "asc");
  assert.deepEqual(SORT_DIRS, ["asc", "desc"]);
});

function reply(order) {
  return { content: [{ type: "tool_use", input: { changes: [], order } }] };
}

// ── WHAT THE MODEL IS SHOWN ─────────────────────────────────────────────────

test("the digest names each list, its order and how many pages read it", () => {
  const pages = [
    page("index.tsx", `const d = useRows("dishes", { order: "name", dir: "asc" });`),
    page("menu.tsx", `const d = useRows("dishes", { order: "name", dir: "asc" });`),
  ];
  const d = sortDigest(sortSlots(pages), TABLES);
  assert.match(d, /dishes — ordered by name asc {2}\(read on 2 pages\)/);
  assert.match(d, /dishes: name, price, category/);
});

test("A LIST THE PAGES ALREADY DISAGREE ABOUT IS SAID SO", () => {
  // That is the exact state this lane fixes, and showing one of the two orders
  // at random invites an answer that changes one of them.
  const pages = [
    page("index.tsx", `const d = useRows("dishes", { order: "name" });`),
    page("menu.tsx", `const d = useRows("dishes", { order: "price" });`),
  ];
  assert.match(sortDigest(sortSlots(pages), TABLES), /\[the pages DISAGREE about this today\]/);
});

test("a list with no order says so rather than being left blank", () => {
  const d = sortDigest(sortSlots([page("i.tsx", `const d = useRows("dishes");`)]), TABLES);
  assert.match(d, /ordered by nothing in particular/);
});

test("a table whose columns we do not know says LEAVE IT ALONE", () => {
  const d = sortDigest(sortSlots([page("i.tsx", `const d = useRows("ghosts", { order: "x" });`)]), TABLES);
  assert.match(d, /ghosts: \(unknown — leave this one alone\)/);
});

test("a site with no lists gets no block at all", () => {
  assert.equal(sortDigest([], TABLES), "");
  assert.equal(sortDigest(null, TABLES), "");
});

// ── WHAT THE CUSTOMER IS TOLD ───────────────────────────────────────────────

test("NOTHING MOVED IS NOT A SUCCESS", () => {
  // The first draft said "✅ appointments now comes out in order of time — on 0
  // pages", which is a success sentence over a change that did not happen. It
  // is reachable on the ordinary path: a table read only through a computed
  // options object refuses every slot.
  const said = sortReply({ table: "appointments", order: "time", changed: [], refused: [{ page: "book.tsx" }] });
  assert.doesNotMatch(said, /✅/);
  assert.match(said, /book\.tsx/);
  assert.match(said, /couldn't change how appointments is ordered/);
});

test("already in that order is its own sentence, not a failure and not a tick", () => {
  const said = sortReply({ table: "dishes", order: "price", changed: [], refused: [] });
  assert.doesNotMatch(said, /✅/);
  assert.match(said, /already comes out in that order/);
});

test("a success names the column, the direction and how many pages", () => {
  const said = sortReply({ table: "dishes", order: "price", dir: "asc", changed: ["a.tsx", "b.tsx"] });
  assert.match(said, /✅ dishes now comes out in order of price, lowest first — on 2 pages\./);
  assert.match(sortReply({ table: "d", order: "c", dir: "desc", changed: ["a.tsx"] }), /highest first — on 1 page\./);
});

test("a partial success still names what was left alone", () => {
  const said = sortReply({ table: "dishes", order: "price", changed: ["a.tsx"], refused: [{ page: "book.tsx" }] });
  assert.match(said, /✅/);
  assert.match(said, /I left book\.tsx alone/);
});

// ── THE LANE ────────────────────────────────────────────────────────────────

const dataReply = (input) => ({ content: [{ type: "tool_use", input }] });

test("runDataEdit SENDS the lists in its request", () => {
  // Every other lane test hands back a canned reply, so the request itself was
  // never looked at — the lane could stop passing the pages and the model would
  // be asked to change an order it was never shown. Two mutants in a row have
  // lived in exactly that gap elsewhere in this repo.
  let sent = null;
  return runDataEdit({ send: async (req) => { sent = req; return dataReply({ changes: [] }); }, apply: async () => true }, {
    instruction: "cheapest first", tables: TABLES,
    pages: [page("i.tsx", `const d = useRows("dishes", { order: "name", dir: "asc" });`)],
  }).then(() => {
    assert.match(sent.messages[0].content, /THE LISTS THIS SITE SHOWS/);
    assert.match(sent.messages[0].content, /dishes — ordered by name asc/);
  });
});

test("A CALLER THAT PASSES NO PAGES SENDS THE REQUEST IT ALWAYS SENT", () => {
  // The block is omitted rather than empty, so nothing that does not use this
  // feature changes shape — and the prompt cost is paid only by sites that
  // have a list to reorder.
  const req = dataRequest({ instruction: "x", tables: TABLES });
  assert.doesNotMatch(req.messages[0].content, /THE LISTS THIS SITE SHOWS/);
});

test("an order-only change publishes pages and writes no rows", () => {
  let applied = 0;
  return runDataEdit({ send: async () => dataReply({ changes: [], order: { table: "dishes", column: "price", dir: "asc" } }), apply: async () => { applied++; return true; } }, {
    instruction: "cheapest first", tables: TABLES,
    pages: [page("i.tsx", `const d = useRows("dishes", { order: "name", dir: "asc" });`)],
  }).then((out) => {
    assert.equal(out.ok, true);
    assert.equal(applied, 0, "no row was written");
    assert.deepEqual(out.sortChanged, ["i.tsx"]);
    assert.ok(out.sortPages, "the rewritten pages come back for the caller to publish");
    assert.match(out.sortMsg, /✅ dishes now comes out in order of price/);
  });
});

test("THE MODULE NEVER PUBLISHES — the pages come back and the caller decides", () => {
  // The row half of this lane is live the moment it commits and needs no
  // container, so a publish dep here would put one on every price change.
  //
  // COMMENTS BLANKED FIRST, length-preserving, and this went red without it:
  // the comment EXPLAINING that the caller publishes contains the word. Prose
  // describing a rule contains the rule's spelling — the recurring own-goal
  // this repo has now recorded four times.
  const src = fs.readFileSync(new URL("../builder/site-apply.mjs", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  assert.match(src, /export async function runDataEdit/, "the blanker did not eat the file");
  assert.doesNotMatch(src, /deps\.publish|recompileAndPublish/);
});

test("a plain row change carries no sortPages, so nothing is recompiled", () => {
  return runDataEdit({ send: async () => dataReply({ changes: [{ table: "dishes", id: 1, values: { name: "Skin fade" } }] }), apply: async () => true }, {
    instruction: "rename it", tables: TABLES,
    pages: [page("i.tsx", `const d = useRows("dishes", { order: "name" });`)],
  }).then((out) => {
    assert.equal(out.ok, true);
    assert.equal(out.sortPages, null);
    assert.deepEqual(out.sortChanged, []);
  });
});

test("A REORDER THAT LANDED SURVIVES EVERY ROW WRITE FAILING", () => {
  // The pages really did change, and reporting `write` would tell the owner
  // nothing happened while the caller is about to publish a site where it did.
  return runDataEdit({ send: async () => dataReply({ changes: [{ table: "dishes", id: 1, values: { name: "X" } }], order: { table: "dishes", column: "price" } }), apply: async () => { throw new Error("nope"); } }, {
    instruction: "x", tables: TABLES,
    pages: [page("i.tsx", `const d = useRows("dishes", { order: "name" });`)],
  }).then((out) => {
    assert.equal(out.ok, true);
    assert.equal(out.failed, 1);
    assert.deepEqual(out.sortChanged, ["i.tsx"]);
  });
});

test("a refused reorder is `no-change` with its reason, not `no-match`", () => {
  // The model found the list and we could not rewrite it, which is a different
  // sentence and a different next step from "nothing matched".
  return runDataEdit({ send: async () => dataReply({ changes: [], order: { table: "dishes", column: "price" } }), apply: async () => true }, {
    instruction: "x", tables: TABLES,
    pages: [page("b.tsx", `const d = usePublicRows("dishes", date ? { date } : undefined);`)],
  }).then((out) => {
    assert.equal(out.ok, false);
    assert.equal(out.reason, "no-change");
    assert.match(out.msg, /I left b\.tsx alone/);
  });
});

test("a reply naming neither rows nor an order is still `no-match`", () => {
  return runDataEdit({ send: async () => dataReply({ changes: [] }), apply: async () => true }, {
    instruction: "x", tables: TABLES, pages: [page("i.tsx", `const d = useRows("dishes");`)],
  }).then((out) => {
    assert.equal(out.reason, "no-match");
    assert.equal(out.msg, undefined, "there is nothing honest to say about a list nobody named");
  });
});

// ── THE WIRING, WHICH IS WHERE TWELVE FEATURES HAVE DIED ─────────────────────

test("the data tool offers an order, and says what it cannot do", () => {
  const d = DATA_TOOL.input_schema.properties.order.description;
  // AN ARBITRARY SEQUENCE IS NOT A SORT, and a model told only "set the order"
  // will pick a column that happens to put two rows the right way round and
  // move everything else on the list.
  assert.match(d, /sequence somebody chose rather than a sort/);
  assert.deepEqual(DATA_TOOL.input_schema.properties.order.required, ["table", "column"]);
  assert.deepEqual(DATA_TOOL.input_schema.properties.order.properties.dir.enum, SORT_DIRS);
  // THE SILENT FAILURE IS NAMED. A sort by a column that does not exist shows
  // an EMPTY list rather than a differently ordered one.
  assert.match(DATA_TOOL.input_schema.properties.order.properties.column.description, /EMPTY list/);
});

test("the worker hands the pages to the data lane and publishes only a reorder", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('if (eLayer === "data")');
  assert.ok(at > 0);
  const end = w.indexOf('if (eLayer === "rules")', at);
  assert.ok(end > at);
  const block = w.slice(at, end);
  // WITHOUT THE PAGES THE WHOLE FEATURE IS DEAD and every test above still
  // passes — the module is correct and never asked.
  assert.match(block, /runDataEdit\([\s\S]*?pages: eSrc/);
  // AND THE ANSWER REACHES THE CUSTOMER, at both ends of the wire.
  assert.match(block, /sortMsg: dOut\.sortMsg/);
  const c = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /e\.sortMsg/);
});

test("the sort is charged like every other model call on this lane", () => {
  // A refusal used to answer `cost: 0`, which was honest when the only refusal
  // was "nothing matched" and stopped being so the moment a reorder could be
  // refused after a paid call.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('if (eLayer === "data")');
  const block = w.slice(at, w.indexOf('if (eLayer === "rules")', at));
  const refusal = block.indexOf('ok: false, error: dOut.reason');
  assert.ok(refusal > 0);
  assert.match(block.slice(refusal, refusal + 200), /cost: await eCharge\(dOut\.usage\)/);
});

// ── THE CORPUS, WHICH IS WHAT DECIDES WHETHER THIS CAN EXIST ────────────────

test("driven over every page the GENERATOR wrote: every slot is a real write point", () => {
  // These are committed eval output — the only corpus in this repo written by
  // the thing being scanned — plus the reference pages, which carry the two
  // computed shapes.
  const found = [];
  const read = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"))
    .map((f) => ({ path: f, source: fs.readFileSync(path.join(dir, f), "utf8") }));

  const evals = GENERATED_DIR;
  for (const site of fs.readdirSync(evals)) {
    const d = path.join(evals, site);
    if (!fs.statSync(d).isDirectory()) continue;
    const pages = read(d);
    for (const s of sortSlots(pages)) found.push({ ...s, src: pages.find((p) => p.path === s.page).source });
  }
  const refs = new URL("../builder/lovable/template/src/routes/", import.meta.url).pathname;
  const rp = read(refs);
  for (const s of sortSlots(rp)) found.push({ ...s, src: rp.find((p) => p.path === s.page).source });

  // The floor first: a scan that silently stopped matching would report a clean
  // corpus and prove nothing. Measured: 14 across the eval sites and the
  // reference pages.
  assert.ok(found.length >= 12, "lists were found: " + found.length);
  assert.ok(found.length < MAX_SORT_SLOTS, "the cap is not what stopped the scan");

  for (const s of found) {
    if (s.computed) continue;
    if (s.insertAt != null) {
      // The insertion point is the end of the table string, so what precedes it
      // must really be that string.
      assert.equal(s.src.slice(s.insertAt - s.table.length - 2, s.insertAt), '"' + s.table + '"', s.page);
      continue;
    }
    // EVERY RECORDED SPAN MUST HOLD WHAT IT CLAIMS, because those offsets are
    // what get rewritten and one that does not corrupts the page.
    if (s.orderSpan) assert.equal(s.src.slice(s.orderSpan.at, s.orderSpan.to), s.order, s.page);
    if (s.dirSpan) assert.equal(s.src.slice(s.dirSpan.at, s.dirSpan.to), s.dir, s.page);
    assert.equal(s.src[s.optsAt], "{", s.page + " options object");
    assert.equal(s.src[s.optsTo], "}", s.page + " options object");
  }
  // AND BOTH REFUSABLE SHAPES ARE REALLY EXERCISED, or the `computed` half of
  // this is calibrated against fixtures alone.
  assert.ok(found.some((s) => s.computed), "the corpus carries a computed options object");
  assert.ok(found.some((s) => s.insertAt != null), "the corpus carries a call with no options");
});

test("A REAL GENERATED PAGE'S OPENING HOURS CAN BE REORDERED", () => {
  // The measured case this whole module exists for: committed generator output
  // reads `useRows<Hour>("hours", { order: "day", dir: "asc" })` — a week of
  // opening hours sorted ALPHABETICALLY, so the site reads Friday, Monday,
  // Saturday, Sunday, Thursday, Tuesday, Wednesday.
  const f = path.join(GENERATED_DIR, "menu-1", "index.tsx");
  const pages = [{ path: "index.tsx", source: fs.readFileSync(f, "utf8") }];
  const before = sortSlots(pages).find((s) => s.table === "hours");
  assert.ok(before, "the alphabetical-hours case is still in the corpus");
  assert.equal(before.order, "day");

  const out = applySort(pages, "hours", "id", "asc");
  assert.deepEqual(out.changed, ["index.tsx"]);
  assert.equal(sortSlots(out.pages).find((s) => s.table === "hours").order, "id");
  // AND NOTHING ELSE ON THE PAGE MOVED — two other lists are read in it.
  const others = sortSlots(out.pages).filter((s) => s.table !== "hours");
  assert.deepEqual(others.map((s) => s.table + ":" + s.order), ["dishes:name", "chefs:name"]);
});
